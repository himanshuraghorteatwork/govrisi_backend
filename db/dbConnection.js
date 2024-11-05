import mongoose from 'mongoose';

const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri, {
        });
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1); 
    }
};

export default connectDB;
