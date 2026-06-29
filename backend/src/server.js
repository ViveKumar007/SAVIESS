require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

const db = require('./config/db');
const apiRoutes = require('./routes/api');
const { processLocationTracking } = require('./controllers/visitController');

const app = express();
const server = http.createServer(app);

// Startup validation for critical environment variables
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables.');
  process.exit(1);
}

// Configure CORS to allow communication from local react client
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

app.use(express.json());

// Bind REST routes
app.use('/api/v1', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Socket JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  const tokenStr = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
  try {
    const decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    console.error('Socket JWT authentication failed:', error.message);
    return next(new Error('Invalid socket authentication token'));
  }
});

// Manage socket connections
io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`User connected to Socket.io: ${user.email} (${user.role})`);

  // Admins/Managers/Directors join the central admin monitoring room
  if (['super_admin', 'program_director', 'field_manager'].includes(user.role)) {
    socket.join('admin');
    console.log(`Admin user ${user.email} joined 'admin' sockets room`);
  }

  // Event: FO registers start of shift/tracking
  socket.on('fo_start_tracking', () => {
    if (user.role === 'field_officer' && user.profileId) {
      socket.join(`fo:${user.profileId}`);
      console.log(`Field Officer ${user.email} started tracking`);
      
      // Notify admins that FO is online
      io.to('admin').emit('admin_fo_status', {
        foId: user.profileId,
        email: user.email,
        status: 'online'
      });
    }
  });

  // Event: Location update from Field Officer device
  socket.on('fo_location_update', async (data) => {
    if (user.role !== 'field_officer' || !user.profileId) {
      return;
    }

    const { latitude, longitude, accuracy, batteryLevel } = data;
    if (latitude === undefined || longitude === undefined) {
      return;
    }

    try {
      // Upsert into live locations & insert breadcrumb logs
      await processLocationTracking(user.profileId, latitude, longitude, accuracy, batteryLevel);
      
      // Broadcast live location details to the admins monitoring dashboard
      io.to('admin').emit('admin_location_update', {
        foId: user.profileId,
        firstName: user.firstName || 'Field',
        lastName: user.lastName || 'Officer',
        email: user.email,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : null,
        batteryLevel: batteryLevel ? parseInt(batteryLevel) : null,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error(`Error saving socket location update for FO ${user.profileId}:`, error.message);
    }
  });

  // Event: FO stops tracking manually
  socket.on('fo_stop_tracking', async () => {
    if (user.role === 'field_officer' && user.profileId) {
      try {
        // Delete from live coordinates
        await db.query('DELETE FROM fo_live_location WHERE fo_id = ?', [user.profileId]);
        
        // Notify admins that FO logged offline
        io.to('admin').emit('admin_fo_status', {
          foId: user.profileId,
          email: user.email,
          status: 'offline'
        });
        console.log(`Field Officer ${user.email} stopped tracking`);
      } catch (error) {
        console.error('Error handling fo_stop_tracking:', error.message);
      }
    }
  });

  // Handle disconnection (auto mark offline)
  socket.on('disconnect', async () => {
    console.log(`User disconnected from Socket.io: ${user.email}`);
    
    if (user.role === 'field_officer' && user.profileId) {
      try {
        // Clean up active location pins to avoid ghost tracks
        await db.query('DELETE FROM fo_live_location WHERE fo_id = ?', [user.profileId]);
        
        // Broadcast offline switch to admins
        io.to('admin').emit('admin_fo_status', {
          foId: user.profileId,
          email: user.email,
          status: 'offline'
        });
      } catch (error) {
        console.error('Error marking FO offline on socket disconnect:', error.message);
      }
    }
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`SAVIESS VEP Backend Server listening on port ${PORT}`);
});
