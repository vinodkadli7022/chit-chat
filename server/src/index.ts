import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
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

// Root endpoint: welcome message & redirect to frontend
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>ChatStream API</title>
    <meta http-equiv="refresh" content="1; url=http://localhost:5173" />
    <style>
      body { font-family: system-ui, sans-serif; background: #090d16; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .card { background: #131b2e; border: 1px solid #1e293b; padding: 2rem; border-radius: 1rem; text-align: center; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
      h2 { margin: 0 0 0.5rem 0; color: #fff; }
      p { color: #94a3b8; font-size: 0.875rem; }
      a { display: inline-block; margin-top: 1rem; padding: 0.6rem 1.2rem; background: #4f46e5; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; }
      a:hover { background: #4338ca; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>⚡ ChatStream Messaging API</h2>
      <p>Backend services and WebSockets are live on port 5000.</p>
      <a href="http://localhost:5173">Open ChatStream Web App (port 5173) &rarr;</a>
    </div>
  </body>
</html>`);
});

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
