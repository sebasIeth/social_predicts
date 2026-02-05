import mongoose, { Schema, Document } from 'mongoose';

export interface IPoll extends Document {
    contractPollId: number;
    title: string;
    options: string[];
    commitEndTime: number;
    revealEndTime: number;
    createdAt: Date;
    isCommunity: boolean;
    creator: string;
}

import { getCollectionName } from '../utils';

const PollSchema: Schema = new Schema({
    contractPollId: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    options: { type: [String], required: true },
    commitEndTime: { type: Number, required: true },
    revealEndTime: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    isCommunity: { type: Boolean, default: false },
    creator: { type: String, required: false }
});

export default mongoose.model<IPoll>(getCollectionName('Poll'), PollSchema);
