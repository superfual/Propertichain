import assert from 'node:assert/strict';
import fs from 'node:fs';

// Run the real entry module with a provider injected before module evaluation.
// No blockchain transaction is sent by this regression harness.
const mode = process.argv[2] || 'legacy';
class Element {
  constructor() { this.value = ''; this.textContent = ''; this.disabled = false; this.hidden = false; this.children = []; }
  append(node) { this.children.push(node); if (!this.value) this.value = node.value || ''; }
  replaceChildren(...nodes) { this.children = nodes; }
  scrollIntoView() {}
}
const nodes = new Map();
const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
globalThis.document = { documentElement: {}, getElementById: node, querySelectorAll: () => [], createElement: () => new Element() };
globalThis.location = { href: 'https://example.test/pilot-v2?lang=vi' };
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
const listeners = new Map(), walletEvents = new Map();
const account = '0x1111111111111111111111111111111111111111';
let walletNetwork = '0x61', sendRequests = 0;
const provider = {
  isBinance: true,
  request: async ({method}) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account];
    if (method === 'eth_chainId') return walletNetwork;
    if (method === 'eth_sendTransaction') sendRequests++;
    throw new Error('Unexpected wallet request: ' + method);
  },
  on: (event, callback) => walletEvents.set(event, callback)
};
globalThis.window = {
  ethereum: mode === 'legacy' ? provider : mode === 'multiple' ? {providers: [provider, {...provider,isBinance:false,isTrust:true}]} : undefined,
  addEventListener: (event, callback) => listeners.set(event, callback),
  dispatchEvent: event => {
    if (mode === 'eip6963' && event.type === 'eip6963:requestProvider') {
      listeners.get('eip6963:announceProvider')({detail: {info: {uuid: 'test-wallet', name: 'Binance Wallet'}, provider}});
    }
  }
};
const plan = JSON.parse(fs.readFileSync(new URL('../dist/pilot-v2-plan.json', import.meta.url)));
const dataset = fs.readFileSync(new URL('../dist/origami-pilot-v1.json', import.meta.url));
globalThis.fetch = async (url, options) => {
  if (String(url).includes('pilot-v2-plan.json')) return {ok:true,json:async()=>plan};
  if (String(url).includes('origami-pilot-v1.json')) return {ok:true,arrayBuffer:async()=>dataset.buffer.slice(dataset.byteOffset,dataset.byteOffset+dataset.byteLength)};
  const queries = JSON.parse(options.body);
  return {ok:true,json:async()=>queries.map(query => {
    const results = {
      eth_chainId: '0x61', eth_getBlockByNumber: {number:'0x123',timestamp:'0x123456'},
      eth_estimateGas:'0xd0000', eth_gasPrice:'0x3b9aca00', eth_getBalance:'0x1000000000000000'
    };
    assert.ok(Object.hasOwn(results,query.method),query.method);
    return {id:query.id,jsonrpc:'2.0',result:results[query.method]};
  })};
};
await import('../dist/pilot-v2.mjs');
for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
assert.match(node('status').textContent,/V2 sẵn sàng/);
assert.equal(typeof node('connect').onclick,'function');
assert.equal(typeof node('refresh').onclick,'function');
assert.equal(node('connect').disabled,mode === 'none');
await node('refresh').onclick();
assert.match(node('status').textContent,/Đã đọc tiến độ/);
if (mode !== 'none') {
  await node('connect').onclick();
  assert.match(node('wallet-state').textContent,/1111111111111111111111111111111111111111/);
  assert.equal(node('deploy').disabled,false);
  await node('deploy').onclick();
  assert.equal(node('preview').hidden,false);
  assert.equal(node('send').disabled,false);
  assert.equal(sendRequests,0);
  node('cancel-preview').onclick();
  walletNetwork = '0x38'; walletEvents.get('chainChanged')();
  assert.equal(node('deploy').disabled,true);
  walletNetwork = '0x61';
  await node('connect').onclick();
  assert.equal(node('deploy').disabled,false);
}
console.log('PASS startup, read, connection, preview and reconnect with provider mode: ' + mode);
