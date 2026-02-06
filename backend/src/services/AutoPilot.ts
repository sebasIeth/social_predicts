import { ethers } from 'ethers';
import Vote from '../models/Vote';
import PollModel from '../models/Poll';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../constants';

const POLLING_INTERVAL = 10 * 1000; // 10 seconds for faster feedback

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

        for (const poll of activePolls) {
            await this.processRevealForPoll(poll);
        }
    }

    private async processRevealForPoll(poll: { contractPollId: number }) {
        if (!this.contract) return;

        const votesToReveal = await Vote.find({
            pollId: poll.contractPollId,
            revealed: { $ne: true }
        });

        for (const vote of votesToReveal) {
            try {
                const tx = await this.contract.adminRevealVote(
                    vote.pollId,
                    vote.voterAddress,
                    vote.commitmentIndex,
                    vote.optionIndex,
                    vote.salt
                );

                await tx.wait();
                vote.revealed = true;
                await vote.save();
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : '';
                if (errorMessage.includes("Already revealed")) {
                    vote.revealed = true;
                    await vote.save();
                }
            }
        }
    }

    private async handleClaims() {
        if (!this.contract) return;

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

    private async processClaimForPoll(pollId: number, votes: IVoteDocument[]) {
        if (!this.contract) return;

        try {
            const pollInfo = await this.contract.polls(pollId);
            const isResolved = pollInfo[5];
            const winningOptionIndex = Number(pollInfo[6]);

            const dbPoll = await PollModel.findOne({ contractPollId: pollId });
            const now = Math.floor(Date.now() / 1000);

            if (!isResolved && dbPoll && now > dbPoll.revealEndTime) {
                try {
                    const tx = await this.contract.resolvePoll(pollId);
                    await tx.wait();
                    const updatedInfo = await this.contract.polls(pollId);
                    if (updatedInfo[5]) {
                        await this.processWinners(pollId, Number(updatedInfo[6]), votes);
                    }
                } catch {
                    // Resolution may fail if already resolved or no votes
                }
            } else if (isResolved) {
                await this.processWinners(pollId, winningOptionIndex, votes);
            }
        } catch {
            // Error checking poll for claims
        }
    }

    private async processWinners(pollId: number, winningOption: number, votes: IVoteDocument[]) {
        if (!this.contract) return;

        const winningVotes = votes.filter(v => v.optionIndex === winningOption);

        for (const vote of winningVotes) {
            try {
                const tx = await this.contract.adminClaimReward(
                    pollId,
                    vote.voterAddress,
                    vote.commitmentIndex
                );

                await tx.wait();
                vote.rewardClaimed = true;
                await vote.save();
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : '';
                if (errorMessage.includes("Already claimed")) {
                    vote.rewardClaimed = true;
                    await vote.save();
                }
            }
        }
    }
}

interface IVoteDocument {
    pollId: number;
    voterAddress: string;
    optionIndex: number;
    commitmentIndex: number;
    salt: string;
    revealed?: boolean;
    rewardClaimed?: boolean;
    save(): Promise<unknown>;
}
