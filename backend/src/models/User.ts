import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    walletAddress: string;
    alias?: string;
    gamesPlayed: number;
    gamesWon: number;
    lastActive: Date;
}

import { getCollectionName } from '../utils';

const UserSchema: Schema = new Schema({
    walletAddress: { type: String, required: true, unique: true },
    alias: { type: String, required: false },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>(getCollectionName('User'), UserSchema);
