import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import pollRoutes from './routes/polls';
import voteRoutes from './routes/votes';
import userRoutes from './routes/users';

dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/polls', pollRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5001;

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
