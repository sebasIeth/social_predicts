
import mongoose from 'mongoose';
import Vote from '../src/models/Vote';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clearVotes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/social-market');
        console.log('MongoDB Connected');

        const result = await Vote.deleteMany({});
        console.log(`Deleted ${result.deletedCount} ghost votes.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

clearVotes();
