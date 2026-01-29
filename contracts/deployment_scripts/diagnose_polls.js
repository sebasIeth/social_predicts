
const hre = require("hardhat");

const ORACLE_POLL_ADDRESS = "0x3651dA7d501fD54e58c0aF64E221c4Fe22957eC5";

async function main() {
    const OraclePoll = await hre.ethers.getContractAt("OraclePoll", ORACLE_POLL_ADDRESS);
    const nextPollId = await OraclePoll.nextPollId();
    console.log("Current nextPollId:", nextPollId.toString());

    for (let i = 0; i < Number(nextPollId); i++) {
        const p = await OraclePoll.polls(i);
        const now = Math.floor(Date.now() / 1000);
        const diff = Number(p.commitEndTime) - now;

        console.log(`Poll ${i}: ${p.question}`);
        console.log(`  Commit End: ${p.commitEndTime.toString()}`);
        console.log(`  Remaining: ${diff}s`);
        console.log(`  Phase: ${diff > 0 ? "VOTING" : "EXPIRED"}`);
    }
}

main().catch(console.error);
