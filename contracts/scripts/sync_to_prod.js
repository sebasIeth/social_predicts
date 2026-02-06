require('dotenv').config();
const { ethers } = require("hardhat");
const axios = require("axios");

const PROD_API_URL = "https://social-predicts-kohl.vercel.app";

async function main() {
    const ORACLE_POLL_ADDRESS = "0xE4c7651160582F9B78E96d0cc17E997d7bbC04d1";
    const OraclePoll = await ethers.getContractFactory("OraclePoll");
    const oraclePoll = OraclePoll.attach(ORACLE_POLL_ADDRESS);

    const pollIds = [2, 3];

    for (const id of pollIds) {
        console.log(`Fetching Poll ${id}...`);
        const poll = await oraclePoll.polls(id);
        const options = await oraclePoll.getPollOptions(id);

        const payload = {
            contractPollId: Number(id),
            title: poll.question,
            options: [...options],
            commitEndTime: Number(poll.commitEndTime),
            revealEndTime: Number(poll.revealEndTime),
            isCommunity: false,
            creator: poll.creator
        };

        console.log(`Syncing Poll ${id} to Prod...`, payload);

        try {
            await axios.post(`${PROD_API_URL}/api/polls`, payload);
            console.log(`Success syncing Poll ${id}`);
        } catch (err) {
            console.error(`Failed to sync Poll ${id}:`, err.message);
            if (err.response) {
                console.error("Response:", err.response.data);
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
