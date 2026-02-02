import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Poll from '../src/models/Poll';
import connectDB from '../src/config/db';

dotenv.config();

const fixPolls = async () => {
    try {
        await connectDB();
        console.log("Connected to DB");

        const pollsToFix = [4, 5, 6, 7, 8]; // Check recent attempts

        for (const id of pollsToFix) {
            const res = await Poll.updateOne(
                { contractPollId: id },
                { $set: { isCommunity: false } } // Set to Official
            );
            console.log(`Poll ${id} update result (Official):`, res);
        }

        console.log("Done. Exiting...");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

fixPolls();
