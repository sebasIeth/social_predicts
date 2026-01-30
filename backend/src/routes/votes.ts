import express from 'express';
import Vote from '../models/Vote';

const router = express.Router();

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
        res.json(vote);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/user/:address', async (req, res) => {
    console.log(`GET /api/votes/user/${req.params.address} - Start`);
    try {
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
