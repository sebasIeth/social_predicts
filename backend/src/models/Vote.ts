import mongoose, { Schema, Document } from 'mongoose';

export interface IVote extends Document {
    pollId: number;
    voterAddress: string;
    optionIndex: number;
    commitmentIndex: number;
    salt: string;
    timestamp: Date;
    revealed?: boolean;
    rewardClaimed?: boolean;
}

const VoteSchema: Schema = new Schema({
    pollId: { type: Number, required: true },
    voterAddress: { type: String, required: true },
    optionIndex: { type: Number, required: true },
    commitmentIndex: { type: Number, required: true },
    salt: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    revealed: { type: Boolean, default: false }, // Track if revealed on-chain
    rewardClaimed: { type: Boolean, default: false } // Track if reward claimed
});

// Multiple votes per address allowed
// Removed unique index

export default mongoose.model<IVote>('Vote', VoteSchema);
