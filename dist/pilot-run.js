const get = id => document.getElementById('run-' + id);
const status = get('status');
const explorer = 'https://testnet.bscscan.com';
const testnet = {
  chainId: '0x61',
  chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://bsc-testnet-dataseed.bnbchain.org'],
  blockExplorerUrls: [explorer]
};
const rpc = 'https://bsc-testnet-rpc.publicnode.com';
const period = 1200n;
const pool = 6000000n;
const zeroHash = '0x' + '0'.repeat(64);
const actions = ['anchor', 'issue', 'transfer', 'expire', 'probe', 'fund', 'claim', 'duplicate'];
const hex = value => '0x' + value.toString(16);
const word = value => (typeof value === 'bigint' ? value.toString(16) : value.slice(2)).padStart(64, '0');
const validAddress = value => /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);
const timeLabel = seconds => seconds ? new Date(Number(seconds) * 1000).toLocaleString('vi-VN') : 'Chưa có';
let provider, contract, signatures, digest, state, pending;
let busy = false;
const getOKX = () => window.okxwallet?.request ? window.okxwallet : window.ethereum?.isOKXWallet ? window.ethereum : null;
function deadline(promise, seconds, label) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' không phản hồi trong ' + seconds +
      ' giây. Nút đã mở lại. Đóng yêu cầu cũ trong ví nếu còn hiện.')), seconds * 1000);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

function walletRequest(wallet, method, params = []) {
  const result = wallet.request({ method, params });
  if (method === 'eth_sendTransaction') return result;
  const labels = {
    eth_requestAccounts: 'Kết nối ví',
    eth_chainId: 'Đọc mạng trong ví',
    wallet_switchEthereumChain: 'Chuyển mạng trong ví',
    wallet_addEthereumChain: 'Thêm mạng trong ví',
    eth_getBlockByNumber: 'Đọc block Testnet',
    eth_call: 'Đọc hợp đồng Testnet',
    eth_estimateGas: 'Ước tính phí gas',
    eth_getTransactionReceipt: 'Đọc biên nhận'
  };
  const isPrompt = method === 'eth_requestAccounts' || method.startsWith('wallet_');
  return deadline(result, isPrompt ? 25 : 12, labels[method] ?? 'Yêu cầu ví');
}
const request = (method, params = []) => walletRequest(provider, method, params);
const input = (name, ...args) => signatures[name] + args.map(word).join('');
const errorMessage = error => error?.code === 4001 ? 'Anh đã hủy yêu cầu trong ví.' : error?.message ?? String(error);

async function readFile(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Không tải được dữ liệu Pilot.');
  return response;
}

async function assertTestnet() {
  const current = BigInt(await request('eth_chainId'));
  if (current !== BigInt(testnet.chainId)) {
    state = undefined;
    throw new Error('Ví đang báo Chain ID ' + current + '. Bấm Chuyển sang BSC Testnet (97).');
  }
}

async function readChain(calls) {
  try {
    const queries = [['eth_chainId', []], ...calls].map(([method, params], id) =>
      ({ jsonrpc: '2.0', id, method, params }));
    const replies = await deadline(fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queries)
    }).then(response => {
      if (!response.ok) throw new Error('RPC Testnet không phản hồi.');
      return response.json();
    }), 6, 'Đọc BSC Testnet');
    const byId = new Map(replies.map(reply => [reply.id, reply.result]));
    if (BigInt(byId.get(0)) !== 97n || queries.some(({ id }) => byId.get(id) == null)) {
      throw new Error('RPC trả về trạng thái thiếu hoặc sai mạng.');
    }
    return calls.map((_, i) => byId.get(i + 1));
  } catch {
    return Promise.all(calls.map(([method, params]) => request(method, params)));
  }
}

function render() {
  const ready = !busy && !pending && state;
  const s = state;
  const hasPrice = Boolean(s && s.priceHash === digest && s.expiry > s.now);
  const issued = Boolean(s?.start);
  const active = issued && s.now < s.end;
  const moved = issued && s.reviewerBalance === 600n;
  const closedWithAOnly = issued && s.now >= s.end && s.reviewerBalance === 1000n;
  get('settlement-note').textContent = closedWithAOnly
    ? 'Kỳ đã đóng khi A còn giữ đủ 1.000 phần. Cấp quỹ và nhận thuê sẽ thanh toán toàn bộ quỹ thử cho A. B không có phần để nhận.'
    : '';
  const recipient = get('recipient').value.trim();
  const mayTransfer = validAddress(recipient) && recipient.toLowerCase() !== s?.account;
  const enabled = {
    anchor: s?.isReviewer && !issued && !hasPrice,
    issue: s?.isReviewer && !issued && hasPrice,
    transfer: s?.isReviewer && active && hasPrice && s.balance === 1000n && s.now >= s.start + period / 2n && mayTransfer,
    expire: s?.isReviewer && active && moved && hasPrice && s.expiry > s.now + 90n && s.end > s.now + 100n,
    probe: s?.isReviewer && moved && s.expiry <= s.now && mayTransfer,
    fund: s?.isReviewer && (moved || closedWithAOnly) && s.funded < pool,
    claim: issued && s.now >= s.end && s.funded === pool && s.balance > 0n && !s.claimed,
    duplicate: s?.claimed
  };
  for (const action of actions) get(action).disabled = !ready || !enabled[action];
  get('connect').disabled = busy || !contract;
  get('okx').disabled = busy || !contract || !getOKX();
  get('injected').disabled = busy || !contract || !window.ethereum?.request;
  get('switch').disabled = busy || !provider;
  get('refresh').disabled = busy || !contract || !(provider || window.ethereum?.request);
  if (!s) {
    get('state').replaceChildren();
    return;
  }
  const entries = [
    ['Ví đang kết nối', s.account + (s.isReviewer ? ' · Ví A' : '')],
    ['Dấu vân tay giá trên chuỗi', s.priceHash === zeroHash ? 'Chưa ghi' : s.priceHash],
    ['Giá hết hạn', timeLabel(s.expiry)],
    ['Bắt đầu · giữa kỳ · kết thúc', [s.start, s.start ? s.start + period / 2n : 0n, s.end].map(timeLabel).join(' · ')],
    ['Phần của ví đang kết nối', s.balance.toString()],
    ['Quỹ đã cấp', s.funded + ' wei tBNB'],
    ['Trạng thái nhận thuê của ví', s.claimed ? 'Đã nhận' : 'Chưa nhận']
  ];
  get('state').replaceChildren(...entries.flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    return [dt, dd];
  }));
}

async function refresh() {
  await assertTestnet();
  const [account] = await request('eth_accounts');
  if (!validAddress(account ?? '')) throw new Error('Ví chưa cấp quyền cho trang.');
  const [block] = await readChain([['eth_getBlockByNumber', ['latest', false]]]);
  const at = block.number;
  const call = (name, ...args) => ['eth_call', [{ to: contract, data: input(name, ...args) }, at]];
  const [reviewer, priceHash, expiry, start, end, funded, balance, claimed] = await readChain([
    ...['reviewer', 'priceHash', 'expiry', 'start', 'end', 'funded'].map(name => call(name)),
    call('balance', account),
    call('claimed', account)
  ]);
  const reviewerAddress = '0x' + reviewer.slice(-40).toLowerCase();
  state = {
    account: account.toLowerCase(), isReviewer: account.toLowerCase() === reviewerAddress, priceHash,
    expiry: BigInt(expiry), start: BigInt(start), end: BigInt(end), funded: BigInt(funded),
    balance: BigInt(balance), claimed: BigInt(claimed) !== 0n, now: BigInt(block.timestamp),
    reviewerBalance: BigInt(account.toLowerCase() === reviewerAddress ? balance : (await readChain([call('balance', reviewerAddress)]))[0])
  };
}

function evidence(label, hash) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = explorer + '/tx/' + hash;
  link.textContent = label + ' · ' + hash;
  item.append(link);
  get('txs').append(item);
}

async function checkReceipt() {
  const receipt = await request('eth_getTransactionReceipt', [pending]);
  if (!receipt) {
    status.textContent = 'Đang chờ xác nhận. Bấm Đọc lại trạng thái để kiểm tra.';
    return;
  }
  pending = undefined;
  status.textContent = BigInt(receipt.status) === 1n
    ? 'Giao dịch đã xác nhận. Trạng thái bên dưới được đọc từ hợp đồng.'
    : 'Giao dịch thất bại. Mở liên kết BscScan bên dưới để kiểm tra.';
}

async function interact(task) {
  if (busy) return;
  busy = true;
  render();
  try {
    await task();
  } catch (error) {
    status.textContent = errorMessage(error);
  } finally {
    busy = false;
    render();
  }
}

async function connectWallet(nextProvider) {
  status.textContent = 'Đã nhận ví. Đang kiểm tra mạng và đọc hợp đồng Testnet…';
  provider = nextProvider;
  state = undefined;
  await refresh();
  if (pending) await checkReceipt();
  else status.textContent = 'Đã kết nối BSC Testnet. Chọn bước đang mở.';
}

async function sign(action, name, args = [], value = 0n) {
  await interact(async () => {
    const previous = state.account;
    state = undefined;
    await refresh();
    if (state.account !== previous) throw new Error('Ví đã đổi. Hãy kiểm tra trạng thái và chọn lại bước.');
    const tx = { from: state.account, to: contract, data: input(name, ...args), value: hex(value), chainId: '0x61' };
    const gas = BigInt(await request('eth_estimateGas', [tx]));
    tx.gas = hex((gas * 115n + 99n) / 100n);
    await assertTestnet();
    const [activeAccount] = await request('eth_accounts');
    if (activeAccount?.toLowerCase() !== tx.from) throw new Error('Ví đã đổi tài khoản. Hãy đọc lại trạng thái.');
    status.textContent = 'Kiểm tra giao dịch và phí gas trong ví trước khi ký.';
    const hash = await request('eth_sendTransaction', [tx]);
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Ví chưa trả về mã giao dịch.');
    pending = hash;
    evidence(get(action).textContent, hash);
    await checkReceipt();
    await refresh();
  });
}

async function probe(name, args, expected, success) {
  await interact(async () => {
    await refresh();
    const tx = { from: state.account, to: contract, data: input(name, ...args) };
    const response = await deadline(fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [tx, 'latest'] })
    }), 12, 'RPC Testnet');
    if (!response.ok) throw new Error('RPC không phản hồi. Hãy thử đọc lại trạng thái.');
    const { error } = await response.json();
    if (!error) {
      status.textContent = 'Lệnh mô phỏng chưa bị chặn. Kiểm tra lại trạng thái hợp đồng.';
      return;
    }
    const selector = signatures[expected];
    if (!selector) throw new Error('Thiếu mã kiểm tra ' + expected + '.');
    const reported = [error.data, error.data?.data, error.message];
    if (!reported.some(item => typeof item === 'string' && item.toLowerCase().includes(selector.toLowerCase()))) {
      throw new Error('RPC chưa xác nhận lỗi ' + expected + '. Chi tiết: ' + error.message);
    }
    status.textContent = success;
  });
}

get('connect').onclick = () => interact(async () => {
  status.textContent = 'Đang chờ kết nối Binance Wallet. Kiểm tra yêu cầu trong ví…';
  const session = await deadline(import('./pilot-binance-connect.mjs')
    .then(({ connectBinanceWallet }) => connectBinanceWallet()), 25, 'Kết nối Binance Wallet');
  await connectWallet(session.provider);
});
get('okx').onclick = () => interact(async () => {
  const wallet = getOKX();
  if (!wallet) throw new Error('Hãy mở trang trong OKX Wallet.');
  status.textContent = 'Đang chờ OKX Wallet xác nhận kết nối…';
  await walletRequest(wallet, 'eth_requestAccounts');
  await connectWallet(wallet);
});
get('injected').onclick = () => interact(async () => {
  const wallet = window.ethereum;
  status.textContent = 'Đang kiểm tra phiên ví trình duyệt…';
  const [account] = await walletRequest(wallet, 'eth_accounts').catch(() => []);
  if (!validAddress(account ?? '')) {
    status.textContent = 'Đang chờ ví trình duyệt xác nhận kết nối…';
    await walletRequest(wallet, 'eth_requestAccounts');
  }
  await connectWallet(wallet);
});
get('switch').onclick = () => interact(async () => {
  status.textContent = 'Đang yêu cầu ví chuyển mạng. Kiểm tra thông báo trong ví…';
  state = undefined;
  if (BigInt(await request('eth_chainId')) !== BigInt(testnet.chainId)) {
    const switchChain = () => request('wallet_switchEthereumChain', [{ chainId: testnet.chainId }]);
    try {
      await switchChain();
    } catch (error) {
      const code = Number(error?.data?.originalError?.code ?? error?.code);
      if (code !== 4902) throw error;
      await request('wallet_addEthereumChain', [testnet]);
      if (BigInt(await request('eth_chainId')) !== BigInt(testnet.chainId)) await switchChain();
    }
  }
  await refresh();
  if (pending) await checkReceipt();
  else status.textContent = 'Ví đã ở BSC Testnet (97). Trạng thái hợp đồng đã được tải.';
});
get('refresh').onclick = () => interact(async () => {
  status.textContent = 'Đang đọc trạng thái từ BSC Testnet…';
  provider ??= window.ethereum;
  state = undefined;
  await refresh();
  if (pending) await checkReceipt();
  else status.textContent = 'Đã đọc trạng thái từ BSC Testnet.';
});
get('recipient').oninput = render;
get('anchor').onclick = () => sign('anchor', 'setPrice', [digest, state.now + 7200n]);
get('issue').onclick = () => sign('issue', 'issue', [state.account, period]);
get('transfer').onclick = () => sign('transfer', 'transferShares', [get('recipient').value.trim(), 400n]);
get('expire').onclick = () => sign('expire', 'setPrice', [digest, state.now + 90n]);
get('probe').onclick = () => probe('transferShares', [get('recipient').value.trim(), 1n], 'PriceExpired', 'BSC Testnet từ chối lệnh mô phỏng với lỗi PriceExpired. Kiểm tra này không gửi giao dịch.');
get('fund').onclick = () => sign('fund', 'fund', [], pool - state.funded);
get('claim').onclick = () => sign('claim', 'claim');
get('duplicate').onclick = () => probe('claim', [], 'DuplicateClaim', 'BSC Testnet từ chối lượt nhận thứ hai với lỗi DuplicateClaim. Kiểm tra này không gửi giao dịch.');

void interact(async () => {
  const [deployment, selectors, dataset] = await deadline(Promise.all([
    readFile('origami-testnet-deployment.json').then(r => r.json()),
    readFile('pilot-run-selectors.json?v=claim1').then(r => r.json()),
    readFile('origami-pilot-v1.json').then(r => r.arrayBuffer())
  ]), 12, 'Tải dữ liệu Pilot');
  if (deployment.chainId !== 97 || !validAddress(deployment.contractAddress)) throw new Error('Địa chỉ hợp đồng không hợp lệ.');
  const hashed = await crypto.subtle.digest('SHA-256', dataset);
  digest = '0x' + Array.from(new Uint8Array(hashed), byte => byte.toString(16).padStart(2, '0')).join('');
  signatures = selectors;
  contract = deployment.contractAddress;
  get('contract').href = explorer + '/address/' + contract;
  status.textContent = 'Nếu ví đã cấp quyền, chọn Đọc lại trạng thái. Nếu chưa, chọn nút kết nối ví.';
});
