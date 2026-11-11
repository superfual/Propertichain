import fs from 'node:fs';
import crypto from 'node:crypto';
import solc from 'solc';
import { Interface, keccak256, toUtf8Bytes } from 'ethers';

export function compileV2() {
  const source = fs.readFileSync(new URL('./RehearsalV2.sol', import.meta.url), 'utf8');
  const result = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources: { 'RehearsalV2.sol': { content: source } },
    settings: {
      evmVersion: 'shanghai',
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  })));
  const errors = result.errors?.filter(item => item.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join('\n'));
  return result.contracts['RehearsalV2.sol'].OrigamiRehearsalV2;
}

if (process.argv.includes('--write')) {
  const artifact = compileV2();
  const abi = new Interface(artifact.abi);
  const propertyId = keccak256(toUtf8Bytes('PROPERTICHAIN:SYNTHETIC:GRANDPARK:ORIGAMI:PILOT-V2'));
  const bytecode = '0x' + artifact.evm.bytecode.object;
  const plan = {
    chainId: 97,
    contractName: 'OrigamiRehearsalV2',
    compiler: solc.version(),
    evmVersion: 'shanghai',
    optimizerRuns: 200,
    propertyId,
    abi: artifact.abi,
    bytecode,
    deploymentData: bytecode + abi.encodeDeploy([propertyId]).slice(2),
    bytecodeSha256: crypto.createHash('sha256').update(Buffer.from(bytecode.slice(2), 'hex')).digest('hex'),
    deployed: false
  };
  fs.writeFileSync(new URL('../dist/pilot-v2-plan.json', import.meta.url), JSON.stringify(plan, null, 2) + '\n');
  console.log('Wrote pilot-v2-plan.json. No deployment was submitted.');
}
