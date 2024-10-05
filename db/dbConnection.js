// dbConnection.js
import mongoose from 'mongoose';

const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB connected: ${uri}`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1); // Exit with failure
    }
};

export default connectDB;
