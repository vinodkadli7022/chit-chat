import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import conversationRoutes from './routes/conversation.routes';
import messageRoutes from './routes/message.routes';
import mediaRoutes from './routes/media.routes';
import { setupSocketIO } from './socket/socketHandler';
import { prisma } from './db';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 10000
});

// Middleware
app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploaded media with cache headers
app.use('/uploads', express.static(config.uploadDir, {
  maxAge: '1d',
  immutable: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/media', mediaRoutes);

// Healthcheck & diagnostic route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve production client build (SPA)
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];
const clientDistPath = possibleClientPaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`Serving static client from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Fallback if client is not built
  app.get('/', (req, res) => {
    res.json({
      status: 'ChatStream API Live',
      message: 'Client dist not found. Run npm run build in client directory.'
    });
  });
}

// Setup Socket.IO real-time events
setupSocketIO(io);

// Server startup
server.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`WebSocket server initialized on port ${config.port}`);
  console.log(`Uploads served from: ${config.uploadDir}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('HTTP & Socket.IO server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
