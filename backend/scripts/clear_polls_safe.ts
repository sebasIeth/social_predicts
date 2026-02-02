import mongoose from 'mongoose';
import Poll from '../src/models/Poll';
import Vote from '../src/models/Vote';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const clearPolls = async () => {
    try {
        console.log('Connecting to MongoDB...');
        console.log('URI:', process.env.MONGODB_URI);
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined');
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        console.log('Deleting all Polls...');
        const pollsResult = await Poll.deleteMany({});
        console.log(`Deleted ${pollsResult.deletedCount} polls.`);

        console.log('Deleting all Votes...');
        const votesResult = await Vote.deleteMany({});
        console.log(`Deleted ${votesResult.deletedCount} votes.`);

        console.log('Database polls cleared successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing DB:', err);
        process.exit(1);
    }
};

clearPolls();
