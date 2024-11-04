const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./db');

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

// Assign io instance to the app
app.set('socketio', io);

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Connect to the database and start the server
const port = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
