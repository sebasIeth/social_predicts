import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import pollRoutes from './routes/polls';
import voteRoutes from './routes/votes';
import openfortRoutes from './routes/openfort';

const result = dotenv.config({ path: __dirname + '/../.env' });
if (result.error) {
    console.log("Dotenv error:", result.error);
    dotenv.config();
}
console.log("Env loaded. Mongo URI:", process.env.MONGODB_URI);

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
