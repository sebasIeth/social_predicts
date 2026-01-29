import express from 'express';
import User from '../models/User';

const router = express.Router();

// @route   POST /api/users/record-win
// @desc    Increment games won for a user
router.post('/record-win', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        console.log(`Recording win for ${walletAddress}`);

        if (!walletAddress) {
            return res.status(400).json({ msg: 'Wallet address is required' });
        }

        const user = await User.findOneAndUpdate(
            { walletAddress },
            { $inc: { gamesWon: 1 }, $set: { lastActive: new Date() } },
            { new: true, upsert: true }
        );

        res.json(user);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/leaderboard
// @desc    Get top users by wins
router.get('/leaderboard', async (req, res) => {
    try {
        const users = await User.find().sort({ gamesWon: -1 }).limit(10);

        const leaderboard = users.map(user => ({
            address: user.walletAddress,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0
        }));

        res.json(leaderboard);
    } catch (err: any) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

export default router;
