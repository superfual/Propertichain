import fs from 'node:fs';
import crypto from 'node:crypto';
import solc from 'solc';

const source = fs.readFileSync(new URL('./Rehearsal.sol', import.meta.url), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'Rehearsal.sol': { content: source } },
  settings: {
    evmVersion: 'shanghai',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } }
  }
};

export function compileRehearsal() {
  const build = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = build.errors?.filter(item => item.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join('\n'));
  return build.contracts['Rehearsal.sol'].OrigamiRehearsal;
}

if (process.argv[2] === '--write') {
  const bytecode = compileRehearsal().evm.bytecode.object;
  const result = {
    chainId: 97,
    compiler: solc.version(),
    optimizerRuns: 200,
    bytecode: '0x' + bytecode,
    sha256: crypto.createHash('sha256').update(Buffer.from(bytecode, 'hex')).digest('hex')
  };
  fs.writeFileSync(new URL('../dist/pilot-rehearsal-deploy-optimized.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
}
