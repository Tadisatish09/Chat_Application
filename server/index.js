const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB, getDbType } = require('./db');
const { initSocketIO } = require('./socket');
const { startMediaCleanupCron, cleanupExpiredMedia } = require('./cronCleanup');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const messagesRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads (media, voice notes, photos)
const serverUploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(serverUploadsDir)) {
  fs.mkdirSync(serverUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(serverUploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);

// Manual Admin Trigger for 90-day Cleanup (useful for testing/maintenance)
app.post('/api/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.query.days || req.body.days || 90, 10);
    const result = await cleanupExpiredMedia(days);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database Health & Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: getDbType(),
    dbName: process.env.DB_NAME || 'chat',
    timestamp: new Date().toISOString()
  });
});

// Initialize Socket.IO handlers
initSocketIO(io);

// Start server
async function start() {
  try {
    await initDB();
    
    // Start 90-day automated media cleanup cron job
    startMediaCleanupCron();

    server.listen(PORT, () => {
      console.log(`===========================================`);
      console.log(`🚀 Chat WebSocket Server running on port ${PORT}`);
      console.log(`📁 Database: ${getDbType().toUpperCase()} (DB: "${process.env.DB_NAME || 'chat'}")`);
      console.log(`🌐 API Ready at http://localhost:${PORT}/api/health`);
      console.log(`===========================================`);
    });
  } catch (err) {
    console.error('Fatal Server Initialization Error:', err);
    process.exit(1);
  }
}

start();
