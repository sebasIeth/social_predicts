
const hre = require("hardhat");

const ORACLE_POLL_ADDRESS = "0x3651dA7d501fD54e58c0aF64E221c4Fe22957eC5";
const USER_ADDRESS = "0xE2b7ACdC0580e329E5998ff0948654FF495917DA";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
    const OraclePoll = await hre.ethers.getContractAt("OraclePoll", ORACLE_POLL_ADDRESS);
    const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);

    const nextPollId = await OraclePoll.nextPollId();
    console.log("Next Poll ID:", nextPollId.toString());

    for (let i = 0; i < Number(nextPollId); i++) {
        const poll = await OraclePoll.polls(i);
        console.log(`Poll ${i}:`, {
            question: poll.question,
            commitEndTime: poll.commitEndTime.toString(),
            revealEndTime: poll.revealEndTime.toString(),
            totalStake: poll.totalStake.toString(),
            now: Math.floor(Date.now() / 1000)
        });
    }

    const allowance = await USDC.allowance(USER_ADDRESS, ORACLE_POLL_ADDRESS);
    const balance = await USDC.balanceOf(USER_ADDRESS);

    console.log("User USDC Balance:", balance.toString());
    console.log("Contract Allowance:", allowance.toString());
}

main().catch(console.error);
