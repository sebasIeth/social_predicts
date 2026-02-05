require('dotenv').config();
const mongoose = require('mongoose');

const clean = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const collections = await mongoose.connection.db.collections();

        for (let collection of collections) {
            console.log(`Dropping ${collection.collectionName}...`);
            await collection.drop();
        }

        console.log('Database cleared successfully.');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

clean();
