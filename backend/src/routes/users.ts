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
// @desc    Get top users by wins + specific user rank
router.get('/leaderboard', async (req, res) => {
    try {
        const { address } = req.query;

        // 1. Get Top 10
        const topUsers = await User.find().sort({ gamesWon: -1 }).limit(10);

        const formatUser = (user: any) => ({
            address: user.walletAddress,
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

                // Calculate rank regardless (so UI knows the number) or just for those outside?
                // Plan said: "If userRank exists and isn't in top 10".
                // But we probably want the rank number for the user even if they are in top 10? 
                // Currently UI just uses index + 1. That works for top 10.
                // For outside top 10, we need the DB rank.

                if (!inTop10) {
                    // Count how many users have strictly more wins
                    const betterPlayers = await User.countDocuments({ gamesWon: { $gt: user.gamesWon } });
                    // Handle ties: For ties, we can just say they are rank X (where X is 1 + betterPlayers).
                    // This is standard competition ranking (1, 2, 2, 4)

                    userRank = {
                        rank: betterPlayers + 1,
                        ...formatUser(user)
                    };
                }
            }
        }

        res.json({ leaderboard, userRank });
    } catch (err: any) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

export default router;
