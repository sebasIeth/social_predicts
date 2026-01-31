import express from 'express';
import Poll from '../models/Poll';

const router = express.Router();

// @route   POST /api/polls
// @desc    Create a new poll
router.post('/', async (req, res) => {
    try {
        const { contractPollId, title, options, commitEndTime, revealEndTime, isCommunity } = req.body;

        const update: any = { title, options, commitEndTime, revealEndTime };
        if (typeof isCommunity !== 'undefined') {
            update.isCommunity = isCommunity;
        }

        const poll = await Poll.findOneAndUpdate(
            { contractPollId },
            {
                $set: update,
                $setOnInsert: { isCommunity: (typeof isCommunity !== 'undefined') ? isCommunity : false }
            },
            { new: true, upsert: true }
        );
        res.json(poll);
    } catch (err: any) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/polls
// @desc    Get all polls
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};

        if (type === 'community') {
            query = { isCommunity: true };
        } else if (type === 'official') {
            query = { isCommunity: false };
        }

        const polls = await Poll.find(query).sort({ createdAt: -1 });
        res.json(polls);
    } catch (err: any) {
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/polls/:id
// @desc    Get poll by ID
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) return res.status(404).json({ msg: 'Poll not found' });
        res.json(poll);
    } catch (err: any) {
        res.status(500).send('Server Error');
    }
});

export default router;
