const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads')); // Serve static files from 'uploads'

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Socket.IO middleware for access in routes
app.use((req, res, next) => {
  req.io = app.get('socketio');
  next();
});

// Route handlers
app.use('/api/lovenotes', require('./routes/lovenotes'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/reminders', require('./routes/reminders'));

module.exports = app;
