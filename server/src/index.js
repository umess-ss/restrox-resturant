import 'express-async-errors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import logger from './config/logger.js';
import { initSocket } from './socket/index.js';
import { setIO } from './socket/io.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = initSocket(httpServer);
setIO(io); // make io available globally

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`WebSocket server ready`);
  });
});
