import express from 'express';
import Vote from '../models/Vote';
import User from '../models/User';
import Poll from '../models/Poll';

const router = express.Router();

// @route   POST /api/votes
// @desc    Cast a vote
router.post('/', async (req, res) => {
    try {
        const { pollId, voterAddress, optionIndex, commitmentIndex, salt } = req.body;

        const newVote = new Vote({
            pollId,
            voterAddress,
            optionIndex,
            commitmentIndex,
            salt
        });

        const vote = await newVote.save();

        // Update User stats
        await User.findOneAndUpdate(
            { walletAddress: voterAddress },
            { $inc: { gamesPlayed: 1 }, $set: { lastActive: new Date() } },
            { upsert: true }
        );

        res.json(vote);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/votes/user/:address
// @desc    Get voting history for a user
router.get('/user/:address', async (req, res) => {
    console.log(`GET /api/votes/user/${req.params.address} - Start`);
    try {
        // Log the search query
        const query = { voterAddress: req.params.address };
        console.log(`Searching votes for:`, query);

        const votes = await Vote.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: Poll.collection.name,
                    localField: 'pollId',
                    foreignField: 'contractPollId',
                    as: 'pollInfo'
                }
            },
            { $unwind: { path: '$pollInfo', preserveNullAndEmptyArrays: true } },
            { $sort: { timestamp: -1 } }
        ]);

        console.log(`Found ${votes.length} votes for user`);
        res.json(votes);
    } catch (err: any) {
        console.error('Aggregation Error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/votes/:address/active-reveals
// @desc    Get votes that are ready to be revealed (Poll in Reveal Phase + Not Revealed)
router.get('/:address/active-reveals', async (req, res) => {
    try {
        const voterAddress = req.params.address;
        const now = Math.floor(Date.now() / 1000);

        // Find votes by user that are NOT revealed
        // AND match polls where commitEndTime < now < revealEndTime
        const votes = await Vote.aggregate([
            {
                $match: {
                    voterAddress: voterAddress,
                    revealed: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: Poll.collection.name,
                    localField: 'pollId',
                    foreignField: 'contractPollId',
                    as: 'pollInfo'
                }
            },
            { $unwind: '$pollInfo' },
            {
                $match: {
                    'pollInfo.commitEndTime': { $lt: now },
                    'pollInfo.revealEndTime': { $gt: now }
                }
            },
            {
                $project: {
                    pollId: 1,
                    optionIndex: 1,
                    salt: 1,
                    commitmentIndex: 1,
                    pollTitle: '$pollInfo.title',
                    pollQuestion: '$pollInfo.question'
                }
            }
        ]);

        res.json(votes);
    } catch (err: any) {
        console.error("Error fetching active reveals:", err);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/votes/recent
// @desc    Get recent votes globally
router.get('/recent', async (req, res) => {
    try {
        const votes = await Vote.aggregate([
            { $sort: { timestamp: -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: Poll.collection.name,
                    localField: 'pollId',
                    foreignField: 'contractPollId',
                    as: 'pollInfo'
                }
            },
            { $unwind: { path: '$pollInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    voterAddress: 1,
                    optionIndex: 1,
                    timestamp: 1,
                    pollTitle: '$pollInfo.title',
                    pollOptions: '$pollInfo.options'
                }
            }
        ]);
        res.json(votes);
    } catch (err: any) {
        console.error("Error fetching recent votes:", err);
        res.status(500).send("Server Error");
    }
});

export default router;
