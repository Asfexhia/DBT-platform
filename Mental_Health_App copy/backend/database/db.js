import mongoose from "mongoose";
import logger from '../utils/logger.js';


export const Connection = async () => {
    const URL = process.env.MONGODB_URL;
    
    console.log('Attempting to connect to MongoDB with URL:', URL);
    console.log('MongoDB connection state before connect:', mongoose.connection.readyState);

    try {
        await mongoose.connect(URL);
        console.log ('Database connected successfully!!!');
        console.log('MongoDB connection state after connect:', mongoose.connection.readyState);
        logger.general({ event: 'db_connect_success', url: URL, state: mongoose.connection.readyState });
    } catch (error) {
        console.log ('Error while connecting with the database', error.message);
        console.log('Full error:', error);
        // Structured log for debugging connection failures
        logger.general({ event: 'db_connect_error', message: error.message, stack: error.stack, url: URL });
    }
}

export default Connection;

// Mongoose connection event logging
mongoose.connection.on('connected', () => {
    logger.general({ event: 'mongoose_connected', state: mongoose.connection.readyState });
});

mongoose.connection.on('error', (err) => {
    logger.general({ event: 'mongoose_error', message: err?.message, stack: err?.stack });
});

mongoose.connection.on('disconnected', () => {
    logger.general({ event: 'mongoose_disconnected', state: mongoose.connection.readyState });
});

mongoose.connection.on('reconnected', () => {
    logger.general({ event: 'mongoose_reconnected', state: mongoose.connection.readyState });
});