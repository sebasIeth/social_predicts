
const hre = require("hardhat");

const ORACLE_POLL_ADDRESS = "0x3651dA7d501fD54e58c0aF64E221c4Fe22957eC5";

async function main() {
    const contract = await hre.ethers.getContractAt("OraclePoll", ORACLE_POLL_ADDRESS);
    try {
        const p = await contract.polls(5);
        console.log("Poll 5 data:", p);
    } catch (e) {
        console.error("Failed to fetch Poll 5:", e.message);
    }
}

main().catch(console.error);
