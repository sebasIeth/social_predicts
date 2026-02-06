import express from 'express';
import User from '../models/User';

const router = express.Router();

// @route   POST /api/users/record-win
// @desc    Increment games won for a user
router.post('/record-win', async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ msg: 'Wallet address is required' });
        }

        const user = await User.findOneAndUpdate(
            { walletAddress },
            { $inc: { gamesWon: 1 }, $set: { lastActive: new Date() } },
            { new: true, upsert: true }
        );

        res.json(user);
    } catch {
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/users/update
// @desc    Update user alias/profile
router.post('/update', async (req, res) => {
    try {
        const { walletAddress, alias } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ msg: 'Wallet address required' });
        }

        const user = await User.findOneAndUpdate(
            { walletAddress },
            { $set: { alias, lastActive: new Date() } },
            { new: true, upsert: true }
        );
        res.json(user);
    } catch {
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/users/leaderboard
// @desc    Get top users by wins + specific user rank
router.get('/leaderboard', async (req, res) => {
    try {
        const { address } = req.query;

        // 1. Get Top 10
        const topUsers = await User.find().sort({ gamesWon: -1 }).limit(10);

        const formatUser = (user: any) => ({
            address: user.walletAddress,
            alias: user.alias || user.walletAddress, // Fallback to address
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0
        });

        const leaderboard = topUsers.map(formatUser);

        // 2. Get User Rank (if not in top 10)
        let userRank = null;
        if (address) {
            const user = await User.findOne({ walletAddress: address });
            if (user) {
                // Check if user is already in top 10
                const inTop10 = topUsers.some(u => u.walletAddress === address);

                if (!inTop10) {
                    const betterPlayers = await User.countDocuments({ gamesWon: { $gt: user.gamesWon } });
                    userRank = {
                        rank: betterPlayers + 1,
                        ...formatUser(user)
                    };
                }
            }
        }

        res.json({ leaderboard, userRank });
    } catch {
        res.status(500).send('Server Error');
    }
});

export default router;
