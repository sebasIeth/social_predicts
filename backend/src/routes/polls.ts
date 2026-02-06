import express from 'express';
import Poll from '../models/Poll';

const router = express.Router();

// @route   POST /api/polls
// @desc    Create a new poll
router.post('/', async (req, res) => {
    try {
        const { contractPollId, title, options, commitEndTime, revealEndTime, isCommunity, creator } = req.body;

        const update: PollUpdate = { title, options, commitEndTime, revealEndTime, creator };
        if (typeof isCommunity !== 'undefined') {
            update.isCommunity = isCommunity;
        }

        const updateOp: { $set: PollUpdate; $setOnInsert?: { isCommunity: boolean } } = { $set: update };
        if (typeof isCommunity === 'undefined') {
            updateOp.$setOnInsert = { isCommunity: false };
        }

        const poll = await Poll.findOneAndUpdate(
            { contractPollId },
            updateOp,
            { new: true, upsert: true }
        );
        res.json(poll);
    } catch {
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/polls/sync
// @desc    Trigger poll data refresh
router.post('/sync', async (_req, res) => {
    res.json({ msg: 'Sync triggered' });
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
        } else if (type === 'mypolls' && req.query.creator) {
            query = { creator: req.query.creator };
        }

        const polls = await Poll.find(query).sort({ createdAt: -1 });
        res.json(polls);
    } catch {
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
    } catch {
        res.status(500).send('Server Error');
    }
});

interface PollUpdate {
    title: string;
    options: string[];
    commitEndTime: number;
    revealEndTime: number;
    creator: string;
    isCommunity?: boolean;
}

export default router;
