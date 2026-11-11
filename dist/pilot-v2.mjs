import { Interface, formatEther } from './pilot-v2-ethers.mjs';
import { PilotRPC, PilotReader, address, restore, save, withTimeout, chainId, explorer, testnet, hex } from './pilot-v2-core.mjs';

const $ = id => document.getElementById(id);
const english = new URL(location.href).searchParams.get('lang') === 'en';
const t = (vi, en) => english ? en : vi;
if (english) {
  document.documentElement.lang = 'en';
  for (const node of document.querySelectorAll('[data-en]')) node.textContent = node.dataset.en;
}
const rpc = new PilotRPC();
const session = restore(localStorage);
const linkedContract = address(new URL(location.href).searchParams.get('contract'));
if (linkedContract && linkedContract !== session.contract) {
  if (session.pending) {
    $('status').textContent = t('Có giao dịch cũ đang chờ. Đọc hợp đồng đã lưu để xử lý trước khi đổi hợp đồng.', 'A previous transaction is pending. Resolve the saved contract before switching.');
  } else session.contract = linkedContract;
}
$('contract').value = session.contract;
$('recipient').value = session.recipient;
let plan, reader, abi, digest, state, wallet, walletAccount = '', walletChain = 0n;
let head = null;
let preview = null, sending = false, connecting = false, readVersion = 0, connectVersion = 0;
const wallets = new Map();
const observedProviders = new WeakSet();
const transactionActions = ['deploy', 'anchor', 'issue', 'transfer', 'revoke', 'pause', 'resume', 'close', 'fund', 'claim'];
const zeroHash = '0x' + '0'.repeat(64);
const persist = () => {
  try { save(localStorage, session); }
  catch { throw new Error(t('Không lưu được tiến độ. Bật lưu trữ của trình duyệt trước khi ký.', 'Progress cannot be saved. Enable browser storage before signing.')); }
};
const message = text => { $('status').textContent = text; };
function failure(error) {
  if (english && String(error.message).includes('Mã hợp đồng không khớp')) return 'The deployed contract bytecode does not match V2.';
  if (english && String(error.message).includes('Sai mã tài sản')) return 'The contract property ID does not match this V2 pilot.';
  if (String(error.message).includes('User closed modal')) return t('Đã đóng cửa sổ kết nối. Có thể mở lại.', 'Connection window closed. You may open it again.');
  if (error.code === 4001) return t('Anh đã hủy yêu cầu trong ví.', 'Request rejected in the wallet.');
  let detail = error.data?.data || error.data;
  if (typeof detail === 'string') {
    try { return t('Hợp đồng từ chối với lỗi ', 'Contract reverted with ') + abi.parseError(detail).name; } catch {}
  }
  return error.shortMessage || error.message || String(error);
}
async function run(task) {
  try { await task(); }
  catch (error) { message(failure(error)); }
  finally { render(); }
}
function addWallet(id, name, provider) {
  if (!provider?.request || [...wallets.values()].some(item => item.provider === provider)) return;
  wallets.set(id, { name, provider });
  const option = document.createElement('option'); option.value = id; option.textContent = name;
  $('wallet-choice').append(option); render();
}
window.addEventListener('eip6963:announceProvider', event => {
  const { info, provider } = event.detail || {};
  if (info?.uuid && info?.name) addWallet(info.uuid, info.name, provider);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
for (const [index, provider] of (window.ethereum?.providers || [window.ethereum]).entries()) {
  const name = provider?.isTrust ? 'Trust Wallet' : provider?.isBinance ? 'Binance Wallet' : t('Ví trình duyệt', 'Browser wallet');
  addWallet('injected-' + index, name, provider);
}
if (window.trustwallet) addWallet('trust', 'Trust Wallet', window.trustwallet);
function dataList(node, rows) {
  node.replaceChildren(...rows.flatMap(([key, value]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = key; dd.textContent = String(value); return [dt, dd];
  }));
}
function link(node, url, label) {
  const a = document.createElement('a'); a.href = url; a.textContent = label; node.replaceChildren(a);
}
const same = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const holder = account => state?.holders[account?.toLowerCase()];
function render() {
  const connected = Boolean(walletAccount && walletChain === chainId);
  const isA = connected && same(walletAccount, state?.reviewer);
  const idle = !sending && !session.pending;
  const validPrice = state && state.priceHash === digest && state.expiry > state.now;
  const open = state?.start > 0n && state.end === 0n;
  const recipient = address($('recipient').value.trim());
  const validB = recipient && !same(recipient, state?.reviewer);
  const current = holder(walletAccount);
  const enabled = {
    deploy: connected && !session.contract && Boolean(plan),
    anchor: isA && !validPrice,
    issue: isA && state.start === 0n && validPrice && !state.paused,
    transfer: isA && open && validPrice && !state.paused && validB && current?.balance === 1000n,
    revoke: isA && open && state.expiry > state.now && !state.paused,
    pause: isA && !state.paused,
    resume: isA && state.paused,
    close: isA && open && !state.paused && validB && holder(recipient)?.balance === 400n && state.now > state.start,
    fund: isA && state.end > 0n && state.funded < 6000000n && !state.paused,
    claim: connected && state?.end > 0n && state.funded === 6000000n && !state.paused && current?.claimable > 0n && !current.claimed
  };
  for (const id of transactionActions) $(id).disabled = !idle || !enabled[id];
  $('connect').disabled = connecting || !wallets.size;
  $('binance').disabled = connecting;
  $('switch').disabled = !wallet || connecting;
  $('load').disabled = Boolean(session.pending || sending) || !reader;
  $('refresh').disabled = !reader;
  $('send').disabled = !preview || !idle;
  $('probe-price').disabled = !state || !validB || !open || state.expiry > state.now || state.paused;
  $('probe-pause').disabled = !state?.paused || !validB || !open;
  $('duplicate').disabled = !holder(session.account)?.claimed || state?.paused;
  $('wallet-state').textContent = walletAccount
    ? t('Ví đang kết nối ', 'Connected wallet ') + walletAccount + ' · Chain ID ' + walletChain
    : t('Chưa kết nối ví. Đọc tiến độ vẫn hoạt động.', 'Wallet disconnected. Reading progress remains available.');
  $('recovery').hidden = !session.pending;
  $('cancelled').disabled = Boolean(session.pending?.hash || sending);
  if (session.pending) $('pending-note').textContent = session.pending.hash
    ? t('Đã gửi giao dịch. Bấm Đọc tiến độ để kiểm tra biên nhận. ', 'Transaction submitted. Read progress to check its receipt. ') + session.pending.hash
    : t('Yêu cầu ký chưa có mã giao dịch. Kiểm tra Activity trong ví. Nếu đã gửi, dán hash bên dưới. Chỉ xác nhận hủy sau khi đã hủy yêu cầu chưa ký trong ví.', 'The signing request has no transaction hash. Check wallet Activity. If sent, paste its hash below. Confirm cancellation only after cancelling the unsigned request in the wallet.');
  if (session.contract) {
    link($('contract-link'), explorer + '/address/' + session.contract, t('Hợp đồng V2 trên BscScan ↗', 'V2 contract on BscScan ↗'));
    const url = new URL(location.href); url.searchParams.set('contract', session.contract);
    link($('share-link'), url.href, t('Mở cùng hợp đồng trên thiết bị khác (sao chép liên kết này)', 'Open this contract on another device (copy this link)'));
  }
  if (!state && head) dataList($('state'), [['Chain ID', '97'], [t('Block Testnet đã đọc', 'Read Testnet block'), BigInt(head.number)]]);
  if (state) {
    const rows = [
      [t('Block đã đọc', 'Read block'), state.block],
      [t('Ví A / người vận hành', 'Wallet A / operator'), state.reviewer],
      [t('Hồ sơ giá', 'Valuation record'), validPrice ? t('Đúng digest và còn hiệu lực', 'Expected digest, valid') : state.priceHash === zeroHash ? t('Chưa ghi', 'Not recorded') : t('Cần làm mới', 'Needs renewal')],
      [t('Kỳ thuê', 'Rental period'), state.end > 0n ? t('Đã đóng', 'Closed') : open ? t('Đang mở, A chủ động đóng khi xong', 'Open, A closes when ready') : t('Chưa phát hành', 'Not issued')],
      [t('Vận hành', 'Operations'), state.paused ? t('Tạm dừng', 'Paused') : t('Đang hoạt động', 'Active')],
      [t('Quỹ đã cấp', 'Funded'), state.funded + ' / 6000000 wei tBNB']
    ];
    for (const account of [...new Set([state.reviewer, session.recipient, session.account].filter(Boolean).map(x => x.toLowerCase()))]) {
      const h = holder(account); if (!h) continue;
      const label = same(account, state.reviewer) ? 'A' : same(account, session.recipient) ? 'B' : account;
      rows.push([t('Ví ', 'Wallet ') + label, `${h.balance} ${t('phần', 'shares')} · ${h.claimable} wei ${t('có thể nhận', 'claimable')} · ${h.claimed ? t('đã nhận', 'claimed') : t('chưa nhận', 'unclaimed')}`]);
    }
    dataList($('state'), rows);
  }
  $('history').replaceChildren(...session.history.map(item => {
    const li = document.createElement('li');
    link(li, explorer + '/tx/' + item.hash, `${item.label} · ${item.status || 'pending'} · ${item.hash}`); return li;
  }));
}
async function refresh() {
  const version = ++readVersion;
  if (!reader) return;
  if (session.pending?.hash) await receipt();
  if (!session.contract) head = await rpc.call('eth_getBlockByNumber', ['latest', false]);
  if (session.contract) {
    const reviewer = await reader.value(session.contract, 'reviewer');
    const next = await reader.state(session.contract, [reviewer, session.recipient, session.account]);
    if (version === readVersion) state = next;
  }
  render();
}
async function receipt() {
  const pending = session.pending;
  if (!pending?.hash) return;
  const result = await rpc.call('eth_getTransactionReceipt', [pending.hash]);
  if (!result) { message(t('Giao dịch đang chờ xác nhận. Có thể rời trang và đọc lại sau.', 'Transaction pending. You may leave and read again later.')); return; }
  const success = BigInt(result.status) === 1n;
  if (success && pending.action === 'deploy') {
    const contract = address(result.contractAddress);
    if (!contract) throw new Error(t('Biên nhận không tạo hợp đồng.', 'Receipt did not create a contract.'));
    await reader.verify(contract);
    if (!same(await reader.value(contract, 'reviewer'), pending.from)) throw new Error('Reviewer mismatch');
    session.contract = contract; $('contract').value = contract;
  }
  const history = session.history.find(x => x.hash === pending.hash);
  if (history) { history.status = success ? 'confirmed' : 'failed'; history.blockNumber = result.blockNumber; }
  session.pending = null; persist();
  message(success ? t('Giao dịch đã xác nhận thành công.', 'Transaction confirmed successfully.') : t('Giao dịch thất bại. Mở BscScan để kiểm tra.', 'Transaction failed. Inspect it on BscScan.'));
}
async function connect(provider, version) {
  let accounts = await withTimeout(provider.request({method: 'eth_accounts'}), t('Đọc phiên ví', 'Reading wallet session')).catch(() => []);
  if (!address(accounts[0])) accounts = await withTimeout(provider.request({method: 'eth_requestAccounts'}), t('Kết nối ví', 'Wallet connection'), 30000);
  const network = BigInt(await withTimeout(provider.request({method: 'eth_chainId'}), 'Chain ID'));
  if (version !== connectVersion) return;
  if (!address(accounts[0])) throw new Error(t('Ví chưa cấp địa chỉ.', 'Wallet returned no address.'));
  wallet = provider; walletAccount = address(accounts[0]); walletChain = network;
  session.account = walletAccount; persist();
  if (provider.on && !observedProviders.has(provider)) {
    observedProviders.add(provider);
    provider.on('accountsChanged', () => { if (wallet === provider) { walletAccount = ''; preview = null; $('preview').hidden = true; render(); message(t('Ví đã đổi tài khoản. Bấm kết nối lại để xác nhận địa chỉ.', 'Wallet account changed. Reconnect to confirm the address.')); } });
    provider.on('chainChanged', () => { if (wallet === provider) { walletChain = 0n; preview = null; $('preview').hidden = true; render(); message(t('Mạng ví đã thay đổi. Kết nối lại để kiểm tra.', 'Wallet network changed. Reconnect to verify.')); } });
  }
  await refresh();
  message(network === chainId ? t('Đã kết nối Testnet 97. Chọn bước đang mở.', 'Connected to Testnet 97. Choose an available step.') : t('Ví đang ở mạng khác. Chọn Chuyển sang Testnet 97.', 'Wallet is on another network. Choose Switch to Testnet 97.'));
}
async function assertWallet() {
  if (!wallet) throw new Error(t('Kết nối ví trước khi ký.', 'Connect a wallet before signing.'));
  const [accounts, network] = await Promise.all([
    withTimeout(wallet.request({method: 'eth_accounts'}), 'Wallet accounts'),
    withTimeout(wallet.request({method: 'eth_chainId'}), 'Chain ID')
  ]);
  if (!same(accounts[0], walletAccount) || BigInt(network) !== chainId) {
    walletAccount = ''; walletChain = 0n;
    throw new Error(t('Địa chỉ hoặc mạng trong ví đã đổi. Kết nối lại.', 'Wallet account or network changed. Reconnect.'));
  }
}
async function prepare(action, name, args = [], value = 0n) {
  if (session.pending || sending) return;
  await assertWallet();
  await refresh();
  const tx = { from: walletAccount, data: action === 'deploy' ? plan.deploymentData : abi.encodeFunctionData(name, args), value: hex(value) };
  if (action !== 'deploy') tx.to = session.contract;
  const [gas, gasPrice, funds] = await Promise.all([
    rpc.call('eth_estimateGas', [tx]), rpc.call('eth_gasPrice'), rpc.call('eth_getBalance', [walletAccount, 'latest'])
  ]);
  tx.gas = hex((BigInt(gas) * 120n + 99n) / 100n); tx.gasPrice = gasPrice; tx.chainId = '0x61';
  const fee = BigInt(tx.gas) * BigInt(gasPrice);
  if (BigInt(funds) < fee + value) throw new Error(t('Ví thiếu tBNB cho gas và giá trị gửi.', 'Insufficient tBNB for gas and transaction value.'));
  preview = { action, tx, label: $(action).textContent };
  dataList($('preview-data'), [
    [t('Thao tác', 'Action'), preview.label], ['Chain ID', '97'],
    [t('Ví ký', 'Signing wallet'), tx.from], [t('Đích', 'Destination'), tx.to || t('Tạo hợp đồng V2 mới', 'Create a new V2 contract')],
    [t('Giá trị gửi', 'Transaction value'), formatEther(value) + ' tBNB'],
    [t('Gas giới hạn', 'Gas limit'), BigInt(tx.gas)],
    [t('Phí theo gas giới hạn và giá gas hiện tại', 'Fee at gas limit and current gas price'), formatEther(fee) + ' tBNB'],
    [t('Xác nhận', 'Confirmation'), t('Kiểm tra phí cuối trong ví trước khi ký.', 'Review the final fee in your wallet before signing.')]
  ]);
  $('preview').hidden = false; $('preview').scrollIntoView({behavior: 'smooth', block: 'start'});
  message(t('Đã ước tính gas. Kiểm tra rồi chọn Mở ví để ký.', 'Gas estimated. Review and choose Open wallet to sign.'));
}
$('send').onclick = () => run(async () => {
  if (!preview || sending || session.pending) return;
  sending = true; render();
  try {
    await assertWallet();
    await rpc.call('eth_estimateGas', [preview.tx]);
    const selected = preview; preview = null; $('preview').hidden = true;
    session.pending = { action: selected.action, label: selected.label, from: selected.tx.from, tx: selected.tx };
    persist(); render();
    message(t('Đang chờ anh ký trong ví. Nếu ví không phản hồi, kiểm tra Activity rồi dùng phần khôi phục bên dưới.', 'Waiting for the wallet signature. If it stalls, check Activity and use the recovery controls below.'));
    try {
      const hash = await withTimeout(wallet.request({method: 'eth_sendTransaction', params: [selected.tx]}), t('Yêu cầu ký trong ví', 'Wallet signature request'), 90000);
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Wallet returned no transaction hash');
      session.pending.hash = hash;
      session.history.push({ hash, label: selected.label, status: 'pending' }); persist();
      await refresh();
      if (session.pending) message(t('Đã gửi. Bấm Đọc tiến độ để kiểm tra biên nhận.', 'Submitted. Read progress to check the receipt.'));
    } catch (error) {
      if (error.code === 4001) { session.pending = null; persist(); }
      throw error;
    }
  } finally { sending = false; }
});
$('cancel-preview').onclick = () => { preview = null; $('preview').hidden = true; render(); };
$('connect').onclick = () => run(async () => {
  const selected = wallets.get($('wallet-choice').value);
  if (!selected) throw new Error(t('Chưa phát hiện tiện ích ví. Mở trong trình duyệt DApp của ví.', 'No wallet detected. Open in the wallet DApp browser.'));
  const version = ++connectVersion; connecting = true; message(t('Đang chờ kết nối ví…', 'Waiting for wallet connection…')); render();
  try { await connect(selected.provider, version); } finally { connecting = false; }
});
$('binance').onclick = () => run(async () => {
  const version = ++connectVersion; connecting = true; message(t('Đang chờ kết nối ví…', 'Waiting for wallet connection…')); render();
  try {
    const { connectBinanceWallet } = await import('./pilot-v2-binance.mjs');
    const session = await withTimeout(connectBinanceWallet(), t('Binance Wallet / QR', 'Binance Wallet / QR'), 30000);
    if (version === connectVersion) await connect(session.provider, version);
  } finally { connecting = false; }
});
$('switch').onclick = () => run(async () => {
  if (!wallet) return;
  try { await withTimeout(wallet.request({method: 'wallet_switchEthereumChain', params: [{chainId: '0x61'}]}), 'Switch network', 30000); }
  catch (error) {
    if (Number(error.code) !== 4902) throw error;
    await withTimeout(wallet.request({method: 'wallet_addEthereumChain', params: [testnet]}), 'Add network', 30000);
    await withTimeout(wallet.request({method: 'wallet_switchEthereumChain', params: [{chainId: '0x61'}]}), 'Switch network', 30000);
  }
  await connect(wallet, ++connectVersion);
});
$('refresh').onclick = () => run(async () => { message(t('Đang đọc BSC Testnet…', 'Reading BSC Testnet…')); await refresh(); if (!session.pending) message(t('Đã đọc tiến độ trên chuỗi.', 'On-chain progress loaded.')); });
$('load').onclick = () => run(async () => {
  if (session.pending || sending) throw new Error(t('Xử lý giao dịch đang chờ trước.', 'Resolve the pending transaction first.'));
  const contract = address($('contract').value.trim());
  if (!contract) throw new Error(t('Địa chỉ hợp đồng chưa hợp lệ.', 'Invalid contract address.'));
  await reader.verify(contract); session.contract = contract; state = null; preview = null; $('preview').hidden = true; persist();
  await refresh(); message(t('Đã xác minh mã hợp đồng V2 và đọc tiến độ.', 'V2 bytecode verified and progress loaded.'));
});
$('recipient').onchange = () => run(async () => {
  const recipient = address($('recipient').value.trim());
  if ($('recipient').value.trim() && !recipient) throw new Error(t('Địa chỉ ví B chưa hợp lệ.', 'Invalid wallet B address.'));
  if (same(recipient, state?.reviewer)) throw new Error(t('Ví B phải khác ví A.', 'Wallet B must differ from wallet A.'));
  session.recipient = recipient || ''; preview = null; $('preview').hidden = true; persist(); await refresh();
});
$('recipient').oninput = render;
$('deploy').onclick = () => run(() => prepare('deploy'));
$('anchor').onclick = () => run(async () => {
  const block = await rpc.call('eth_getBlockByNumber', ['latest', false]);
  await prepare('anchor', 'setPrice', [digest, BigInt(block.timestamp) + 86400n]);
});
$('issue').onclick = () => run(() => prepare('issue', 'issue', [walletAccount]));
$('transfer').onclick = () => run(() => prepare('transfer', 'transferShares', [address($('recipient').value.trim()), 400n]));
$('revoke').onclick = () => run(() => prepare('revoke', 'revokePrice'));
$('pause').onclick = () => run(() => prepare('pause', 'setPaused', [true]));
$('resume').onclick = () => run(() => prepare('resume', 'setPaused', [false]));
$('close').onclick = () => run(() => prepare('close', 'closePeriod'));
$('fund').onclick = () => run(async () => { await refresh(); await prepare('fund', 'fund', [], 6000000n - state.funded); });
$('claim').onclick = () => run(() => prepare('claim', 'claim'));
async function probe(name, args, expected, from) {
  await refresh();
  try { await rpc.call('eth_call', [{from, to: session.contract, data: abi.encodeFunctionData(name, args)}, 'latest']); }
  catch (error) {
    const raw = error.data?.data || error.data;
    let parsed; try { parsed = abi.parseError(raw); } catch {}
    if (parsed?.name !== expected) throw error;
    message(t('Đã xác nhận hợp đồng chặn với lỗi ', 'Confirmed contract rejection with ') + expected + t(' qua eth_call. Không phát giao dịch.', ' via eth_call. No transaction broadcast.'));
    return;
  }
  throw new Error(t('Lệnh chưa bị chặn như dự kiến. Hãy đọc lại trạng thái.', 'The expected rejection was not observed. Refresh state.'));
}
$('probe-price').onclick = () => run(() => probe('transferShares', [session.recipient, 1n], 'PriceExpired', state.reviewer));
$('probe-pause').onclick = () => run(() => probe('transferShares', [session.recipient, 1n], 'Paused', state.reviewer));
$('duplicate').onclick = () => run(() => probe('claim', [], 'DuplicateClaim', session.account));
$('recover').onclick = () => run(async () => {
  const hash = $('recover-hash').value.trim();
  if (!session.pending || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error(t('Cần mã giao dịch hợp lệ.', 'A valid transaction hash is required.'));
  const tx = await rpc.call('eth_getTransactionByHash', [hash]);
  const expected = session.pending.tx;
  if (!tx || !same(tx.from, expected.from) || (tx.to || '').toLowerCase() !== (expected.to || '').toLowerCase() || tx.input.toLowerCase() !== expected.data.toLowerCase() || BigInt(tx.value) !== BigInt(expected.value)) {
    throw new Error(t('Giao dịch không khớp yêu cầu đang chờ.', 'Transaction does not match the pending request.'));
  }
  session.pending.hash = hash;
  if (!session.history.some(x => x.hash === hash)) session.history.push({hash, label: session.pending.label, status: 'pending'});
  persist(); await refresh();
});
$('cancelled').onclick = () => run(async () => {
  if (sending || session.pending?.hash) return;
  session.pending = null; persist(); message(t('Đã ghi nhận anh hủy yêu cầu chưa ký. Đọc lại trạng thái trước khi thử tiếp.', 'Unsigned request cancellation acknowledged. Read state before retrying.')); await refresh();
});
$('download').onclick = () => run(async () => {
  await refresh();
  const record = { chainId: 97, contract: session.contract, propertyId: plan.propertyId, valuationDigest: digest, pending: session.pending, transactions: session.history, state, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(record, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'propertichain-pilot-v2.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
void run(async () => {
  const [loadedPlan, data] = await Promise.all([
    fetch('./pilot-v2-plan.json').then(r => { if (!r.ok) throw new Error('Cannot load V2 plan'); return r.json(); }),
    fetch('./origami-pilot-v1.json').then(r => { if (!r.ok) throw new Error('Cannot load property record'); return r.arrayBuffer(); })
  ]);
  if (loadedPlan.chainId !== 97 || loadedPlan.deployed !== false) throw new Error('Invalid V2 plan');
  plan = loadedPlan; abi = new Interface(plan.abi); reader = new PilotReader(rpc, plan);
  digest = '0x' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
  persist();
  await refresh();
  if (!session.pending) message(session.contract ? t('Đã tải tiến độ. Kết nối ví để ký bước tiếp theo.', 'Progress loaded. Connect a wallet for the next signature.') : t('V2 sẵn sàng. Kết nối ví A trên Testnet 97 để xem trước triển khai.', 'V2 ready. Connect wallet A on Testnet 97 to preview deployment.'));
});
