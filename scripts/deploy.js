// Deploys MockUSDC (testnet only) and the MoraFactory. Vaults are created per user from the web app.
// Usage: DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
// Optional: USDC_ADDRESS to use an existing token (e.g. Circle's Base Sepolia USDC) instead of MockUSDC.
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`network ${network.name}, deployer ${deployer.address}`);

  let usdc = process.env.USDC_ADDRESS;
  if (!usdc) {
    const mock = await (await ethers.getContractFactory("MockUSDC")).deploy();
    await mock.waitForDeployment();
    usdc = await mock.getAddress();
    console.log(`MockUSDC ${usdc}`);
  }

  const factory = await (await ethers.getContractFactory("MoraFactory")).deploy(usdc);
  await factory.waitForDeployment();
  console.log(`MoraFactory ${await factory.getAddress()}`);
  console.log(`MoraVault implementation ${await factory.implementation()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
