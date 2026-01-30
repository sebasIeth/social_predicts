import { ethers } from 'ethers';
import Vote from '../models/Vote';
import PollModel from '../models/Poll'; // Assuming we sync polls or just use chain
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../constants';

const POLLING_INTERVAL = 60 * 1000; // 1 minute

export class AutoPilotService {
    private provider?: ethers.JsonRpcProvider;
    private wallet?: ethers.Wallet;
    private contract?: ethers.Contract;
    private isRunning: boolean = false;

    constructor() {
        const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        const privateKey = process.env.PRIVATE_KEY;

        if (!privateKey) {
            console.warn("AutoPilot: No PRIVATE_KEY found. Service disabled.");
            return;
        }

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, this.wallet);
    }

    start() {
        if (!this.wallet) return;
        if (this.isRunning) return;

        console.log("AutoPilot: Starting service...");
        this.isRunning = true;
        this.runLoop();
    }

    private async runLoop() {
        if (!this.isRunning) return;

        try {
            await this.processPolls();
        } catch (error) {
            console.error("AutoPilot Error:", error);
        }

        setTimeout(() => this.runLoop(), POLLING_INTERVAL);
    }

    private async processPolls() {
        if (!this.contract) return;
        const contract = this.contract;

        // fetch latest poll ID from contract
        const nextPollId = await contract.nextPollId();
        const count = Number(nextPollId);

        console.log(`AutoPilot: Checking ${count} polls...`);

        for (let i = 0; i < count; i++) {
            try {
                await this.checkPoll(i);
            } catch (err) {
                console.error(`AutoPilot: Error processing poll ${i}`, err);
            }
        }
    }

    private async checkPoll(pollId: number) {
        if (!this.contract) return;
        const contract = this.contract;

        const poll = await contract.polls(pollId);
        const now = Math.floor(Date.now() / 1000);

        const commitEndTime = Number(poll.commitEndTime);
        const revealEndTime = Number(poll.revealEndTime);
        const resolved = poll.resolved;

        // 1. REVEAL PHASE
        if (now >= commitEndTime && now < revealEndTime) {
            // Find unrevealed votes in DB
            const votesToReveal = await Vote.find({
                pollId: pollId,
                revealed: { $ne: true }
            });

            if (votesToReveal.length === 0) return;

            console.log(`AutoPilot: Poll ${pollId} is in Reveal Phase. Found ${votesToReveal.length} pending votes.`);

            for (const vote of votesToReveal) {
                // Check if user is premium
                const isPremium = await contract.isPremium(vote.voterAddress);
                if (isPremium) {
                    console.log(`AutoPilot: Revealing vote for premium user ${vote.voterAddress}`);
                    try {
                        const tx = await contract.adminRevealVote(
                            pollId,
                            vote.voterAddress,
                            vote.commitmentIndex,
                            vote.optionIndex,
                            vote.salt
                        );
                        console.log(`AutoPilot: Transaction sent: ${tx.hash}`);
                        await tx.wait();

                        vote.revealed = true;
                        await vote.save();
                        console.log("AutoPilot: Vote revealed successfully.");
                    } catch (e: any) {
                        console.error(`AutoPilot: Failed to reveal vote for ${vote.voterAddress}:`, e.message);
                        // If already revealed (error), mark as revealed locally
                        if (e.message.includes("Already revealed")) {
                            vote.revealed = true;
                            await vote.save();
                        }
                    }
                }
            }
        }

        // 2. RESOLUTION / CLAIM PHASE
        if (now >= revealEndTime && !resolved) {
            // Attempt to resolve if we have any stake involved (or just do it generally)
            // Ideally we check if we can resolve.
            console.log(`AutoPilot: Poll ${pollId} ended. Attempting resolution...`);
            try {
                const tx = await contract.resolvePoll(pollId);
                await tx.wait();
                console.log(`AutoPilot: Poll ${pollId} resolved!`);
            } catch (e: any) {
                // Ignore error if already resolved (race condition) or can't resolve yet
                // console.log("AutoPilot: Resolution skipped/failed:", e.message);
            }
        }

        // 3. CLAIM REWARDS
        if (now >= revealEndTime) {
            // Refresh poll state to check resolved
            const updatedPoll = await contract.polls(pollId);
            if (updatedPoll.resolved) {
                const winners = await Vote.find({
                    pollId: pollId,
                    optionIndex: Number(updatedPoll.winningOptionIndex),
                    rewardClaimed: { $ne: true },
                    revealed: true // Must be revealed to win
                });

                for (const vote of winners) {
                    const isPremium = await contract.isPremium(vote.voterAddress);
                    if (isPremium) {
                        console.log(`AutoPilot: Claiming reward for ${vote.voterAddress}`);
                        try {
                            const tx = await contract.adminClaimReward(pollId, vote.voterAddress, vote.commitmentIndex);
                            await tx.wait();
                            vote.rewardClaimed = true;
                            await vote.save();
                            console.log("AutoPilot: Reward claimed!");
                        } catch (e: any) {
                            console.error(`AutoPilot: Claim failed for ${vote.voterAddress}:`, e.message);
                            if (e.message.includes("Already claimed")) {
                                vote.rewardClaimed = true;
                                await vote.save();
                            }
                        }
                    }
                }
            }
        }
    }
}
