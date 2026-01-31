
import mongoose from 'mongoose';
import Vote from '../src/models/Vote';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/social-market');
        console.log('MongoDB Connected');

        const count = await Vote.countDocuments();
        console.log(`Total Votes in DB: ${count}`);

        const votes = await Vote.find().limit(5);
        console.log('Sample Votes:', votes);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
