import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import pollRoutes from './routes/polls';
import voteRoutes from './routes/votes';
import openfortRoutes from './routes/openfort';

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/polls', pollRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api', openfortRoutes);

const PORT = process.env.PORT || 5001;

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
