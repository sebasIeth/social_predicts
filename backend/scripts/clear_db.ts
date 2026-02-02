import mongoose from 'mongoose';
import Poll from '../src/models/Poll';
import Vote from '../src/models/Vote';
import User from '../src/models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const clearDB = async () => {
    try {
        console.log('Connecting to MongoDB...');
        console.log('URI:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected!');

        console.log('Deleting all Polls...');
        await Poll.deleteMany({});

        console.log('Deleting all Votes...');
        await Vote.deleteMany({});

        console.log('Deleting all Users (optional, to reset stats)...');
        await User.deleteMany({});

        console.log('Database cleared successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing DB:', err);
        process.exit(1);
    }
};

clearDB();
