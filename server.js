const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

// HTTP server and Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now, can be restricted later
    methods: ['GET', 'POST', 'DELETE']
  }
});

// Middleware setup
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve static files from 'uploads'
app.use(bodyParser.json()); // Parse JSON bodies

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// MongoDB connection (replace with your MongoDB connection string)
mongoose.connect('mongodb+srv://nopref:LifeLess23@love.n3a2u.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schema for photos
const photoSchema = new mongoose.Schema({
  url: String,
  timestamp: { type: Date, default: Date.now }, // Default to current date
});
const Photo = mongoose.model('Photo', photoSchema);

// Multer configuration for storing uploaded files
const storage = multer.diskStorage({
  destination: 'uploads/', // Destination folder for uploads
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Append original file extension
  }
});
const upload = multer({ storage });

// API Endpoints

// 1. **Upload photo** endpoint
app.post('/api/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `https://backend-production-8c13.up.railway.app/uploads/${req.file.filename}`;
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    // Broadcast new photo to all clients
    io.emit('photoUploaded', { url: fileUrl, timestamp: newPhoto.timestamp, _id: newPhoto._id });

    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, timestamp: newPhoto.timestamp, _id: newPhoto._id });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

// 2. **Fetch all photos** endpoint
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ timestamp: -1 }); // Return photos sorted by newest first
    res.json(photos);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
});

// 3. **Delete photo** endpoint
app.delete('/api/photos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const photo = await Photo.findByIdAndDelete(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const fileName = path.basename(photo.url); // Get the filename from the URL
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Check if the file exists before attempting deletion
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Failed to delete photo file:', err);
          return res.status(500).json({ message: 'Failed to delete photo file' });
        }

        // Notify all clients of the deleted photo
        io.emit('photoDeleted', id);
        res.json({ message: 'Photo deleted successfully', id });
      });
    } else {
      io.emit('photoDeleted', id);
      res.json({ message: 'Photo deleted from database but file not found', id });
    }
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
