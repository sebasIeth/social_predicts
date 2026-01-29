import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    walletAddress: string;
    gamesPlayed: number;
    gamesWon: number;
    lastActive: Date;
}

const UserSchema: Schema = new Schema({
    walletAddress: { type: String, required: true, unique: true },
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', UserSchema);
