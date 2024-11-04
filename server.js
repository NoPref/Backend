const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs')

const app = express();
const port = 5000;

// HTTP server and Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://nopref:LifeLess23@love.n3a2u.mongodb.net/?retryWrites=true&w=majority');

// Define schema for photos
const photoSchema = new mongoose.Schema({
  url: String,
  timestamp: Date,
});
const Photo = mongoose.model('Photo', photoSchema);

// Multer configuration for storing uploaded files
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Upload photo endpoint
app.post('/api/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    const fileUrl = `https://backend-production-8c13.up.railway.app/uploads/${req.file.filename}`;
    const timestamp = new Date();

    // Save photo to database
    const newPhoto = new Photo({ url: fileUrl, timestamp });
    await newPhoto.save();

    // Broadcast the new photo to all connected clients
    io.emit('photoUploaded', { url: fileUrl, timestamp });

    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, timestamp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

// Fetch all photos endpoint
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await Photo.find();
    res.json(photos);
  } catch (err) {
    res.status(500).send(err);
  }
});


// Delete photo endpoint
// Delete photo endpoint
app.delete('/api/photos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const photo = await Photo.findByIdAndDelete(id);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete the photo file from uploads directory
    const fileName = photo.url.split('/').pop(); // Extract filename from URL
    fs.unlink(path.join('uploads', fileName), (err) => {
      if (err) {
        console.error('Failed to delete photo file:', err);
        return res.status(500).json({ error: 'Failed to delete photo file' });
      }

      // Only emit after the file has been deleted
      io.emit('photoDeleted', id);
      res.json({ message: 'Photo deleted successfully', id });
    });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete the photo' });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
