import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';
import { PilotReader, PilotRPC, restore, save, storageKey } from '../dist/pilot-v2-core.mjs';
const plan = JSON.parse(fs.readFileSync(new URL('../dist/pilot-v2-plan.json', import.meta.url)));
const evm = ganache.provider({chain:{chainId:31337},miner:{timestampIncrement:0},logging:{quiet:true}});
try {
 const provider = new BrowserProvider(evm);
 const a = await provider.getSigner(0), b = await provider.getSigner(1);
 const contract = await new ContractFactory(plan.abi,plan.bytecode,a).deploy(plan.propertyId);
 await contract.waitForDeployment();
 let offline = false;
 const transport = async (url, options) => {
  if (url === 'broken') throw new Error('simulated unavailable RPC');
  if (offline) throw new Error('offline');
  const requests = JSON.parse(options.body);
  const replies = await Promise.all(requests.map(async ({id, method, params}) => {
   try { return {jsonrpc:'2.0',id,result:await evm.request({method,params})}; }
   catch(error) { return {jsonrpc:'2.0',id,error:{message:error.message,data:error.data}}; }
  }));
  return {ok:true,json:async()=>replies};
 };
 const rpc = new PilotRPC(['broken','local'],31337n,transport);
 const reader = new PilotReader(rpc,plan);
 await reader.verify(contract.target);
 const values = new Map();
 const storage = {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 save(storage,{contract:contract.target,recipient:b.address,account:a.address,pending:{hash:'0x'+'1'.repeat(64)},history:[]});
 const resumed = restore(storage);
 assert.equal(resumed.contract,contract.target);
 assert.equal(resumed.pending.hash,'0x'+'1'.repeat(64));
 const reopenedReader = new PilotReader(new PilotRPC(['local'],31337n,transport),plan);
 const initial = await reopenedReader.state(resumed.contract,[a.address,b.address]);
 assert.equal(initial.start,0n);
 await (await contract.setPrice('0x'+'2'.repeat(64),9999999999n)).wait();
 await (await contract.issue(a.address)).wait();
 await evm.request({method:'evm_increaseTime',params:[10]});
 await (await contract.transferShares(b.address,400,{gasLimit:200000})).wait();
 await evm.request({method:'evm_increaseTime',params:[10]});
 await (await contract.closePeriod({gasLimit:100000})).wait();
 const read = await reopenedReader.state(resumed.contract,[a.address,b.address]);
 assert.equal(read.holders[a.address.toLowerCase()].claimable,4800000n);
 assert.equal(read.holders[b.address.toLowerCase()].claimable,1200000n);
 await assert.rejects(new PilotRPC(['local'],97n,transport).call('eth_blockNumber'),/wrong|sai/);
 const wrongPlan = {...plan,runtimeBytecode:plan.runtimeBytecode.replace('6080','6081')};
 await assert.rejects(new PilotReader(rpc,wrongPlan).verify(contract.target),/khớp/);
 values.set(storageKey,'broken JSON');
 assert.equal(restore(storage).contract,'');
 offline = true;
 await assert.rejects(rpc.call('eth_blockNumber'),/offline/);
 console.log('PASS: exact runtime match, RPC fallback, wrong chain rejection, reload persistence, independent reads, two-holder claims, corrupted storage and offline errors');
} finally {await evm.disconnect();}
