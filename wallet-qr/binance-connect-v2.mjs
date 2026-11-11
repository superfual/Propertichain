import BinanceProvider from '@binance/w3w-ethereum-provider';

let mobile;

export async function connectBinanceWallet() {
  const injected = window.ethereum;
  if (injected?.isBinance === true) {
    const [address] = await injected.request({ method: 'eth_requestAccounts' });
    return { provider: injected, address };
  }

  mobile ??= new BinanceProvider({
    chainId: 97,
    rpc: { 97: 'https://bsc-testnet-rpc.publicnode.com' },
    showQrCodeModal: true,
    lng: 'en'
  });
  try {
    const [address] = await mobile.enable(97);
    return { provider: mobile, address };
  } catch (error) {
    try { await mobile.disconnect(); } catch {}
    mobile = undefined;
    throw error;
  }
}
