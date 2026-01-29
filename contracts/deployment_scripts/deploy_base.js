const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", signer.address);
    console.log("Deploying OraclePoll...");

    // Base Mainnet USDC Address
    // https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const oraclePoll = await OraclePoll.deploy(BASE_USDC_ADDRESS);

    await oraclePoll.waitForDeployment();

    console.log(
        `OraclePoll deployed to ${oraclePoll.target} with USDC address ${BASE_USDC_ADDRESS}`
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
