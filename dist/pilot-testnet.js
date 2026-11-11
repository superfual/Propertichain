const chainId = 97n;
const explorer = 'https://testnet.bscscan.com';
const get = id => document.getElementById(id);
const connect = get('wallet-connect');
const deploy = get('wallet-deploy');
const qr = get('wallet-qr');
const recheck = get('wallet-receipt');
const status = get('wallet-status');
const preview = get('wallet-preview');
const evidence = get('wallet-evidence');
const injected = window.ethereum;
let wallet;
let plan;
let txHash;

const request = (method, params = []) => wallet.request({ method, params });

async function ensureTestnet() {
  if (BigInt(await request('eth_chainId')) !== chainId) {
    throw new Error('Hãy chuyển ví sang BNB Smart Chain Testnet (Chain ID 97).');
  }
}

function resetPlan() {
  plan = undefined;
  deploy.disabled = true;
  preview.hidden = true;
}

function link(label, path) {
  const item = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.href = explorer + path;
  anchor.textContent = label;
  item.append(anchor);
  evidence.append(item);
}

function handleError(error) {
  status.textContent = error.code === 4001 ? 'Yêu cầu đã được hủy trong ví.' : error.message;
}

async function prepare(address) {
  await ensureTestnet();
  if (!address) throw new Error('Ví chưa cung cấp địa chỉ.');
  const response = await fetch('pilot-rehearsal-deploy-optimized.json');
  if (!response.ok) throw new Error('Chưa tải được mã hợp đồng thử.');
  const artifact = await response.json();
  if (BigInt(artifact.chainId) !== chainId || !/^0x[0-9a-f]+$/i.test(artifact.bytecode)) {
    throw new Error('Mã triển khai không hợp lệ.');
  }
  const transaction = { from: address, data: artifact.bytecode, value: '0x0', chainId: '0x61' };
  const [gas, price, balance] = await Promise.all([
    request('eth_estimateGas', [transaction]),
    request('eth_gasPrice'),
    request('eth_getBalance', [address, 'latest'])
  ]).then(values => values.map(BigInt));
  await ensureTestnet();
  const [active] = await request('eth_accounts');
  if (active?.toLowerCase() !== address.toLowerCase()) throw new Error('Ví đã đổi tài khoản. Hãy kết nối lại.');
  const gasLimit = (gas * 115n + 99n) / 100n;
  const fee = gasLimit * price;
  preview.textContent = 'Ví ' + address + ' · Gas ước tính ' + gas.toLocaleString('vi-VN') +
    ' · Giới hạn đề xuất ' + gasLimit.toLocaleString('vi-VN') +
    ' · Phí tối đa theo giá gas hiện tại khoảng ' + (Number(fee) / 1e18).toFixed(8) + ' tBNB. Xem phí cuối trong ví.';
  preview.hidden = false;
  if (balance < fee) throw new Error('Ví thử chưa đủ tBNB để trả phí ước tính.');
  plan = { ...transaction, gas: '0x' + gasLimit.toString(16) };
  deploy.disabled = false;
  status.textContent = 'Ví đã sẵn sàng. Bấm triển khai để xem yêu cầu ký trong ví.';
}

async function checkReceipt() {
  await ensureTestnet();
  const receipt = await request('eth_getTransactionReceipt', [txHash]);
  if (!receipt) {
    status.textContent = 'Giao dịch đã gửi và đang chờ xác nhận. Anh có thể mở BscScan hoặc kiểm tra lại.';
    return;
  }
  if (BigInt(receipt.status) !== 1n || !/^0x[0-9a-f]{40}$/i.test(receipt.contractAddress ?? '')) {
    status.textContent = 'Giao dịch không tạo được hợp đồng. Gas đã dùng: ' +
      BigInt(receipt.gasUsed ?? 0).toLocaleString('vi-VN') + '. Xem biên nhận trên BscScan trước khi thử lại.';
    recheck.hidden = true;
    return;
  }
  const bytecode = await request('eth_getCode', [receipt.contractAddress, 'latest']);
  if (bytecode === '0x') throw new Error('RPC chưa trả về mã hợp đồng. Hãy kiểm tra lại.');
  evidence.replaceChildren();
  link('Giao dịch triển khai · ' + txHash, '/tx/' + txHash);
  link('Địa chỉ hợp đồng · ' + receipt.contractAddress, '/address/' + receipt.contractAddress);
  recheck.hidden = true;
  status.textContent = 'Triển khai thành công trên BSC Testnet. Gửi mã giao dịch để cập nhật hồ sơ Pilot.';
}

function toggleConnectionButtons(busy) {
  connect.disabled = busy || !injected?.request;
  qr.disabled = busy;
}

function selectWallet(provider) {
  if (wallet === provider) return;
  wallet?.removeListener?.('chainChanged', walletChanged);
  wallet?.removeListener?.('accountsChanged', walletChanged);
  wallet = provider;
  wallet.on?.('chainChanged', walletChanged);
  wallet.on?.('accountsChanged', walletChanged);
}

async function connectWith(getSession) {
  resetPlan();
  toggleConnectionButtons(true);
  try {
    const { provider, address } = await getSession();
    selectWallet(provider);
    await prepare(address);
  } catch (error) {
    handleError(error);
  } finally {
    toggleConnectionButtons(Boolean(txHash));
  }
}

connect.addEventListener('click', () => connectWith(async () => {
  selectWallet(injected);
  await ensureTestnet();
  const [address] = await request('eth_requestAccounts');
  return { provider: injected, address };
}));

qr.addEventListener('click', () => connectWith(async () => {
  status.textContent = 'Đang mở kết nối Binance Wallet. Trên máy tính, quét QR bằng Binance Wallet trong ứng dụng Binance.';
  const { connectBinanceWallet } = await import('./pilot-binance-connect.mjs');
  return connectBinanceWallet();
}));

deploy.addEventListener('click', async () => {
  deploy.disabled = true;
  toggleConnectionButtons(true);
  try {
    await ensureTestnet();
    const [active] = await request('eth_accounts');
    if (!plan || active?.toLowerCase() !== plan.from.toLowerCase()) throw new Error('Hãy kết nối lại ví.');
    const hash = await request('eth_sendTransaction', [plan]);
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Ví chưa trả về mã giao dịch hợp lệ.');
    txHash = hash;
    link('Giao dịch triển khai · ' + txHash, '/tx/' + txHash);
    recheck.hidden = false;
    await checkReceipt();
  } catch (error) {
    handleError(error);
    if (!txHash) {
      resetPlan();
      toggleConnectionButtons(false);
    }
  }
});

recheck.addEventListener('click', async () => {
  recheck.disabled = true;
  try {
    await checkReceipt();
  } catch (error) {
    handleError(error);
  } finally {
    recheck.disabled = false;
  }
});

function walletChanged() {
  resetPlan();
  if (!txHash) status.textContent = 'Ví hoặc mạng đã đổi. Hãy kết nối lại để kiểm tra.';
}

toggleConnectionButtons(false);
status.textContent = injected?.request
  ? 'Chọn ví trình duyệt hoặc Binance Wallet Keyless / QR.'
  : 'Chưa phát hiện ví trình duyệt. Chọn Binance Wallet Keyless / QR để kết nối điện thoại.';
