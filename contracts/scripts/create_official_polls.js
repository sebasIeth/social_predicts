require('dotenv').config();
const hre = require("hardhat");
const { ethers } = require("hardhat");
const axios = require("axios");

const BACKEND_URL = "http://localhost:5001"; // Adjust if needed

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Creating polls with account:", deployer.address);

    // Get Contract Address (Should be in .env or hardcoded from previous step)
    // Hardcoded for safety based on recent deployment
    const ORACLE_POLL_ADDRESS = "0xE4c7651160582F9B78E96d0cc17E997d7bbC04d1";

    const OraclePoll = await ethers.getContractFactory("OraclePoll");
    const oraclePoll = OraclePoll.attach(ORACLE_POLL_ADDRESS);

    // 1. Check/Buy Premium
    const isPremium = await oraclePoll.isPremium(deployer.address);
    console.log("Is Premium?", isPremium);

    if (!isPremium) {
        console.log("Buying premium...");

        const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const IERC20 = await ethers.getContractAt("IERC20", USDC_ADDRESS);

        const balance = await IERC20.balanceOf(deployer.address);
        console.log("USDC Balance:", ethers.formatUnits(balance, 6));

        const txApprove = await IERC20.approve(ORACLE_POLL_ADDRESS, ethers.parseUnits("1", 6));
        console.log("Approving USDC...");
        await txApprove.wait(2);
        console.log("Approved USDC");

        const txBuy = await oraclePoll.buyPremium(30);
        await txBuy.wait();
        console.log("Bought Premium");
    }

    // Poll 1: L2s (ALREADY CREATED ID: 2)
    /*
    await createAndSyncPoll(oraclePoll, deployer,
        "Which L2 will have the most TVL by end of 2026?",
        ["Arbitrum", "Optimism", "Base", "ZKSync"],
        20 * 60 * 60, // 20 hours commit
        4 * 60 * 60   // 4 hours reveal
    );
    */

    // Poll 2: Web3 Communities
    await createAndSyncPoll(oraclePoll, deployer,
        "Which Web3 Community is the strongest?",
        ["Bored Apes", "Pudgy Penguins", "Farcaster", "Lens"],
        20 * 60 * 60,
        4 * 60 * 60
    );

}

async function createAndSyncPoll(contract, deployer, question, options, commitDuration, revealDuration) {
    console.log(`\nCreating Poll: "${question}"...`);

    // 1. Create on-chain
    // Listen for event to get ID
    const tx = await contract.createPoll(question, options, commitDuration, revealDuration);
    const receipt = await tx.wait();

    // Find PollCreated event
    // ABI: event PollCreated(uint256 indexed pollId, string question, uint256 commitEndTime);
    // Topic 0 is hash, Topic 1 is pollId.

    let pollId = null;
    let commitEndTime = null;

    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === 'PollCreated') {
                pollId = parsed.args[0].toString();
                commitEndTime = parsed.args[2].toString();
                break;
            }
        } catch {
            // Event parsing failed, continue
        }
    }

    if (!pollId) {
        console.error("Failed to find PollCreated event");
        return;
    }

    console.log(`Poll Created on-chain. ID: ${pollId}`);

    // 2. Sync to Backend
    // POST /api/polls
    // Body: { contractPollId, title, options, commitEndTime, revealEndTime, isCommunity: false, creator: deployer.address }

    const revealEndTime = BigInt(commitEndTime) + BigInt(revealDuration);

    try {
        await axios.post(`${BACKEND_URL}/api/polls`, {
            contractPollId: Number(pollId),
            title: question,
            options: options,
            commitEndTime: Number(commitEndTime),
            revealEndTime: Number(revealEndTime),
            isCommunity: false, // Official
            creator: deployer.address
        });
        console.log("Synced to Backend.");
    } catch (error) {
        console.error("Backend Sync Failed:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
