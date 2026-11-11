import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, keccak256, toUtf8Bytes } from 'ethers';
import { compileV2 } from './build-v2.mjs';

const evm = ganache.provider({chain: {chainId: 31337}, miner: {timestampIncrement: 0}, logging: {quiet: true}});
const checks = [];
try {
  let provider = new BrowserProvider(evm);
  const [reviewer, a, b] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
  const artifact = compileV2();
  const propertyId = keccak256(toUtf8Bytes('PROPERTICHAIN:SYNTHETIC:GRANDPARK:ORIGAMI:PILOT-V2'));
  const digest = keccak256(toUtf8Bytes('synthetic valuation evidence'));
  const deploy = async () => {
    const result = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, reviewer).deploy(propertyId);
    await result.waitForDeployment();
    return result;
  };
  const contract = await deploy();
  const deploymentGas = (await contract.deploymentTransaction().wait()).gasUsed;
  const now = async () => BigInt((await evm.request({method: 'eth_getBlockByNumber', params: ['latest', false]})).timestamp);
  const advance = async seconds => {
    await evm.request({method: 'evm_increaseTime', params: [seconds]});
    await evm.request({method: 'evm_mine', params: []});
  };
  const send = async tx => (await tx).wait();
  const reject = (action, name) => assert.rejects(action, error => error.revert?.name === name);
  await reject(() => contract.connect(a).setPrice.staticCall(digest, 9999999999n), 'Unauthorized');
  await reject(() => contract.issue.staticCall(a.address), 'PriceExpired');
  await send(contract.setPrice(digest, await now() + 86400n));
  await send(contract.issue(a.address));
  await reject(() => contract.issue.staticCall(a.address), 'InvalidState');
  await reject(() => contract.connect(a).closePeriod.staticCall(), 'Unauthorized');
  await reject(() => contract.closePeriod.staticCall(), 'InvalidState');
  checks.push('reviewer permissions and one-time issuance enforced');
  await advance(50);
  await send(contract.connect(a).transferShares(b.address, 400));
  assert.equal(await contract.balance(a.address), 600n);
  assert.equal(await contract.balance(b.address), 400n);
  await reject(() => contract.connect(a).transferShares.staticCall(b.address, 601), 'InvalidState');
  await send(contract.revokePrice());
  await reject(() => contract.connect(a).transferShares.staticCall(b.address, 1), 'PriceExpired');
  await send(contract.setPrice(digest, await now() + 86400n));
  await send(contract.setPaused(true));
  await reject(() => contract.connect(a).transferShares.staticCall(b.address, 1), 'Paused');
  await reject(() => contract.connect(b).setPaused.staticCall(false), 'Unauthorized');
  await send(contract.setPaused(false));
  checks.push('400-share transfer, insufficient balance, revoked pricing, pause and recovery checked');
  // Recreate signers after a simulated delay without resetting the chain.
  await advance(50);
  provider = new BrowserProvider(evm);
  const returningA = contract.connect(await provider.getSigner(1));
  const returningB = contract.connect(await provider.getSigner(2));
  assert.equal(await returningA.balance(a.address), 600n);
  await send(contract.closePeriod());
  assert.equal(await contract.end() - await contract.start(), 100n);
  assert.equal(await contract.claimable(a.address), 4_800_000n);
  assert.equal(await contract.claimable(b.address), 1_200_000n);
  await reject(() => contract.closePeriod.staticCall(), 'InvalidState');
  await reject(() => returningA.transferShares.staticCall(b.address, 1), 'InvalidState');
  await reject(() => returningA.claim.staticCall(), 'InvalidState');
  await send(contract.fund({value: 2_000_000}));
  await reject(() => returningA.claim.staticCall(), 'InvalidState');
  await reject(() => contract.fund.staticCall({value: 4_000_001}), 'InvalidState');
  await send(contract.fund({value: 4_000_000}));
  await send(contract.revokePrice());
  await send(contract.setPaused(true));
  await reject(() => returningA.claim.staticCall(), 'Paused');
  await send(contract.setPaused(false));
  await send(returningA.claim());
  await send(returningB.claim());
  const vault = await evm.request({method: 'eth_getBalance', params: [contract.target, 'latest']});
  assert.equal(BigInt(vault), 0n);
  await reject(() => returningA.claim.staticCall(), 'DuplicateClaim');
  await reject(() => returningB.claim.staticCall(), 'DuplicateClaim');
  checks.push('explicit close, fresh signers, partial funding, overfunding, both payouts and duplicate rejection checked');
  const fullTransfer = await deploy();
  await send(fullTransfer.setPrice(digest, await now() + 86400n));
  await send(fullTransfer.issue(a.address));
  await advance(50);
  await send(fullTransfer.connect(a).transferShares(b.address, 1000));
  await advance(50);
  await send(fullTransfer.revokePrice());
  await send(fullTransfer.closePeriod());
  await send(fullTransfer.fund({value: 6_000_000}));
  assert.equal(await fullTransfer.balance(a.address), 0n);
  assert.equal(await fullTransfer.claimable(a.address), 3_000_000n);
  await send(fullTransfer.connect(a).claim());
  await send(fullTransfer.connect(b).claim());
  checks.push('zero current balance retains earned rent; expired price allows closing and settlement');
  const result = {
    network: 'Local EVM', chainId: 31337, contractName: 'OrigamiRehearsalV2', deploymentGas: Number(deploymentGas),
    periodControl: 'Reviewer closes explicitly; no preset 20-minute deadline',
    periodSeconds: 100, transferAtSeconds: 50, supply: 1000, closingBalances: [600, 400], claimsWei: [4800000, 1200000],
    signerRecreation: 'Local BrowserProvider and signers recreated; mobile wallet reconnection is unverified',
    checks, bscTestnetDeployment: false
  };
  if (process.argv.includes('--write')) fs.writeFileSync(new URL('../dist/pilot-v2-local-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await evm.disconnect();
}
