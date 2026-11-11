import { Interface, getAddress } from './pilot-v2-ethers.mjs';

export const chainId = 97n;
export const explorer = 'https://testnet.bscscan.com';
export const storageKey = 'propertichain-pilot-v2';
export const rpcUrls = ['https://bsc-testnet-rpc.publicnode.com', 'https://bsc-testnet-dataseed.bnbchain.org'];
export const testnet = {
  chainId: '0x61', chainName: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls, blockExplorerUrls: [explorer]
};
export const hex = number => '0x' + number.toString(16);
export const address = value => { try { return getAddress(value); } catch { return null; } };
export async function withTimeout(promise, label, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ' chưa phản hồi. Có thể đọc lại trạng thái hoặc kết nối lại.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export function restore(storage) {
  try {
    const data = JSON.parse(storage.getItem(storageKey) || '{}');
    return {
      contract: address(data.contract) || '', recipient: address(data.recipient) || '',
      account: address(data.account) || '',
      pending: data.pending && typeof data.pending === 'object' ? data.pending : null,
      history: Array.isArray(data.history) ? data.history.filter(x => /^0x[0-9a-f]{64}$/i.test(x.hash || '')).slice(-40) : []
    };
  } catch { return { contract: '', recipient: '', account: '', pending: null, history: [] }; }
}
export function save(storage, session) { storage.setItem(storageKey, JSON.stringify(session)); }
export function verifyRuntime(actual, plan) {
  let deployed = actual.slice(2).toLowerCase();
  const expected = plan.runtimeBytecode.slice(2).toLowerCase();
  if (!expected || deployed.length !== expected.length) throw new Error('Mã hợp đồng không khớp bản V2 đã biên dịch.');
  for (const refs of Object.values(plan.immutableReferences)) {
    for (const { start, length } of refs) {
      deployed = deployed.slice(0, start * 2) + '0'.repeat(length * 2) + deployed.slice((start + length) * 2);
    }
  }
  if (deployed !== expected) throw new Error('Mã hợp đồng không khớp bản V2 đã biên dịch.');
}
export class PilotRPC {
  constructor(urls = rpcUrls, expectedChain = chainId, transport = (...args) => fetch(...args)) {
    this.urls = urls; this.expectedChain = expectedChain; this.transport = transport;
  }
  async call(method, params = []) {
    let last;
    for (const url of this.urls) {
      try {
        const reply = await withTimeout(this.transport(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
            { jsonrpc: '2.0', id: 2, method, params }
          ])
        }).then(async response => {
          if (!response.ok) throw new Error('RPC HTTP ' + response.status);
          return response.json();
        }), 'RPC Testnet', 8000);
        if (!Array.isArray(reply)) throw new Error('RPC trả về dữ liệu không hợp lệ.');
        const network = reply.find(x => x.id === 1);
        const result = reply.find(x => x.id === 2);
        if (BigInt(network?.result || 0) !== this.expectedChain) throw new Error('RPC trả về sai mạng.');
        if (result?.error) {
          const error = new Error(result.error.message);
          error.data = result.error.data;
          error.rpcRevert = true;
          throw error;
        }
        if (!result || !Object.hasOwn(result, 'result')) throw new Error('RPC thiếu kết quả.');
        return result.result;
      } catch (error) {
        if (error.rpcRevert) throw error;
        last = error;
      }
    }
    throw last;
  }
}
export class PilotReader {
  constructor(rpc, plan) { this.rpc = rpc; this.plan = plan; this.abi = new Interface(plan.abi); }
  async value(contract, name, args = [], block = 'latest') {
    const result = await this.rpc.call('eth_call', [{ to: contract, data: this.abi.encodeFunctionData(name, args) }, block]);
    return this.abi.decodeFunctionResult(name, result)[0];
  }
  async verify(contract) {
    verifyRuntime(await this.rpc.call('eth_getCode', [contract, 'latest']), this.plan);
    if (await this.value(contract, 'propertyId') !== this.plan.propertyId) throw new Error('Sai mã tài sản pilot V2.');
  }
  async state(contract, accounts = []) {
    await this.verify(contract);
    const block = await this.rpc.call('eth_getBlockByNumber', ['latest', false]);
    const names = ['reviewer', 'priceHash', 'expiry', 'start', 'end', 'funded', 'paused'];
    const values = await Promise.all(names.map(name => this.value(contract, name, [], block.number)));
    const result = Object.fromEntries(names.map((name, i) => [name, values[i]]));
    result.now = BigInt(block.timestamp); result.block = BigInt(block.number);
    result.holders = {};
    for (const holder of [...new Set(accounts.filter(Boolean))]) {
      const entries = await Promise.all(['balance', 'claimed', 'claimable'].map(name => this.value(contract, name, [holder], block.number)));
      result.holders[holder.toLowerCase()] = { balance: entries[0], claimed: entries[1], claimable: entries[2] };
    }
    return result;
  }
}
