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
            await this.handleReveals();
            await this.handleClaims();
        } catch (error) {
            console.error("AutoPilot Error:", error);
        }

        setTimeout(() => this.runLoop(), POLLING_INTERVAL);
    }

    private async handleReveals() {
        if (!this.contract) return;
        const now = Math.floor(Date.now() / 1000);

        // Find polls currently in reveal phase
        // commitEndTime < now < revealEndTime
        const activePolls = await PollModel.find({
            commitEndTime: { $lt: now },
            revealEndTime: { $gt: now }
        });

        if (activePolls.length > 0) {
            console.log(`AutoPilot: Found ${activePolls.length} polls in Reveal Phase.`);
        }

        for (const poll of activePolls) {
            await this.processRevealForPoll(poll);
        }
    }

    private async processRevealForPoll(poll: any) {
        if (!this.contract) return;

        // Find unrevealed votes for this poll
        const votesToReveal = await Vote.find({
            pollId: poll.contractPollId,
            revealed: { $ne: true }
        });

        for (const vote of votesToReveal) {
            try {
                // Check if user is premium
                const isPremium = await this.contract.isPremium(vote.voterAddress);

                if (isPremium) {
                    console.log(`AutoPilot: Revealing vote for premium user ${vote.voterAddress} on poll ${poll.contractPollId}`);

                    const tx = await this.contract.adminRevealVote(
                        vote.pollId,
                        vote.voterAddress,
                        vote.commitmentIndex,
                        vote.optionIndex,
                        vote.salt
                    );

                    console.log(`AutoPilot: Reveal tx sent: ${tx.hash}`);
                    await tx.wait();

                    vote.revealed = true;
                    await vote.save();
                    console.log(`AutoPilot: Vote revealed for ${vote.voterAddress}`);
                }
            } catch (err: any) {
                console.error(`AutoPilot: Failed to reveal for ${vote.voterAddress}:`, err.message);
                if (err.message && err.message.includes("Already revealed")) {
                    vote.revealed = true;
                    await vote.save();
                }
            }
        }
    }

    private async handleClaims() {
        if (!this.contract) return;
        const now = Math.floor(Date.now() / 1000);

        // Find polls that have ended (reveal time passed)
        // Optimization: Only check polls updated recently or flagged as not resolved? 
        // For now, let's query votes that are revealed but not claimed.
        // This is much more efficient than checking all polls.

        const unclaimedVotes = await Vote.find({
            revealed: true,
            rewardClaimed: { $ne: true }
        });

        if (unclaimedVotes.length === 0) return;

        // Group votes by pollId to check resolution status efficiently
        const distinctPollIds = [...new Set(unclaimedVotes.map(v => v.pollId))];

        for (const pollId of distinctPollIds) {
            await this.processClaimForPoll(pollId, unclaimedVotes.filter(v => v.pollId === pollId));
        }
    }

    private async processClaimForPoll(pollId: number, votes: any[]) {
        if (!this.contract) return;

        try {
            // Check if poll is resolved on-chain
            const pollInfo = await this.contract.polls(pollId);
            const isResolved = pollInfo[5]; // resolved bool
            const winningOptionIndex = Number(pollInfo[6]);

            // Attempt resolution if needed? 
            // The original code attempted resolution if ended but not resolved.
            // Let's keep that logic if we find an ended poll in our DB that isn't resolved.
            const dbPoll = await PollModel.findOne({ contractPollId: pollId });
            const now = Math.floor(Date.now() / 1000);

            if (!isResolved && dbPoll && now > dbPoll.revealEndTime) {
                console.log(`AutoPilot: Poll ${pollId} ended but not resolved. Attempting resolution...`);
                try {
                    const tx = await this.contract.resolvePoll(pollId);
                    await tx.wait();
                    console.log(`AutoPilot: Poll ${pollId} resolved!`);
                    // Re-fetch info
                    const updatedInfo = await this.contract.polls(pollId);
                    if (updatedInfo[5]) { // verified resolved
                        await this.processWinners(pollId, Number(updatedInfo[6]), votes);
                    }
                } catch (e: any) {
                    // console.error("AutoPilot: Resolution failed:", e.message);
                }
            } else if (isResolved) {
                await this.processWinners(pollId, winningOptionIndex, votes);
            }

        } catch (err) {
            console.error(`AutoPilot: Error checking poll ${pollId} for claims:`, err);
        }
    }

    private async processWinners(pollId: number, winningOption: number, votes: any[]) {
        if (!this.contract) return;

        // Filter only those who voted for the winner
        const winningVotes = votes.filter(v => v.optionIndex === winningOption);

        for (const vote of winningVotes) {
            try {
                const isPremium = await this.contract.isPremium(vote.voterAddress);
                if (isPremium) {
                    console.log(`AutoPilot: Claiming reward for premium user ${vote.voterAddress} on poll ${pollId}`);

                    const tx = await this.contract.adminClaimReward(
                        pollId,
                        vote.voterAddress,
                        vote.commitmentIndex
                    );

                    console.log(`AutoPilot: Claim tx sent: ${tx.hash}`);
                    await tx.wait();

                    vote.rewardClaimed = true;
                    await vote.save();
                    console.log(`AutoPilot: Reward claimed for ${vote.voterAddress}`);
                }
            } catch (err: any) {
                console.error(`AutoPilot: Failed to claim for ${vote.voterAddress}:`, err.message);
                if (err.message && err.message.includes("Already claimed")) {
                    vote.rewardClaimed = true;
                    await vote.save();
                }
            }
        }
    }
}
