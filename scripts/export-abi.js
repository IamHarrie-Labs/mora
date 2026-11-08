// Writes the contract ABIs into the web app. Run: npm run abi
const fs = require("fs");
const path = require("path");
const read = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, `../artifacts/contracts/${n}.sol/${n}.json`))).abi;
const out = path.join(__dirname, "../web/src/lib/abi.ts");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  "// Generated from Hardhat artifacts by `npm run abi` in the repo root. Do not edit.\n" +
    `export const vaultAbi = ${JSON.stringify(read("MoraVault"))} as const;\n` +
    `export const factoryAbi = ${JSON.stringify(read("MoraFactory"))} as const;\n` +
    `export const tokenAbi = ${JSON.stringify(read("MockUSDC"))} as const;\n`
);
console.log(`wrote ${out}`);
