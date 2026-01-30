const hre = require("hardhat");

async function main() {
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
    console.log("Deploying OraclePoll to Base with USDC:", usdcAddress);

    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const oraclePoll = await OraclePoll.deploy(usdcAddress);

    await oraclePoll.waitForDeployment();

    console.log("OraclePoll deployed to:", await oraclePoll.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
