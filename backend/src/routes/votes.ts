import express from 'express';
import Vote from '../models/Vote';
import User from '../models/User';

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
                    from: 'polls',
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

export default router;
