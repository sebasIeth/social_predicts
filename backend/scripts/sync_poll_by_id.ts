import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ethers } from 'ethers';
import Poll from '../src/models/Poll';
import connectDB from '../src/config/db';

dotenv.config();

const ORACLE_POLL_ADDRESS = "0xCf9334fCD39d87df96420F18E6Fe117B81170e84";
const ABI = [
    "function polls(uint256) view returns (uint256 id, string question, uint256 commitEndTime, uint256 revealEndTime, uint256 totalStake, bool resolved, uint256 winningOptionIndex)",
    "function getPollOptions(uint256) view returns (string[])",
    "function nextPollId() view returns (uint256)"
];
// Using a reliable public RPC
const RPC_URL = "https://mainnet.base.org";

const syncPoll = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(ORACLE_POLL_ADDRESS, ABI, provider);

        // Fetch valid poll count
        const nextId = await contract.nextPollId();
        const pollId = Number(nextId) - 1;

        if (pollId < 0) {
            console.log("No polls to sync.");
            process.exit(0);
        }

        console.log(`Fetching Latest Poll ${pollId} from Blockchain...`);

        const pollData = await contract.polls(pollId);
        const options = await contract.getPollOptions(pollId);

        console.log("Found Poll:", pollData.question);

        const update = {
            contractPollId: Number(pollData.id),
            title: pollData.question,
            options: Array.from(options),
            commitEndTime: Number(pollData.commitEndTime),
            revealEndTime: Number(pollData.revealEndTime),
            isCommunity: false // Admin created meant to be Official
        };

        const res = await Poll.findOneAndUpdate(
            { contractPollId: pollId },
            { $set: update, $setOnInsert: { createdAt: new Date() } },
            { new: true, upsert: true }
        );

        console.log("Synced Poll:", res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

syncPoll();
