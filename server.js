const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path')

const app = express();
const port = 5000;

// Wrap app in an HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(cors());
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  }
});

mongoose.connect('mongodb+srv://nopref:LifeLess23@love.n3a2u.mongodb.net/?retryWrites=true&w=majority');

// Define schema for love notes
const loveNoteSchema = new mongoose.Schema({
  note: String,
});
const LoveNote = mongoose.model('LoveNote', loveNoteSchema);

const photoSchema = new mongoose.Schema({
  url: String,
  timestamp: String,
});
const Photo = mongoose.model('Photo', photoSchema);

// Love Notes endpoints
app.get('/api/lovenotes', async (req, res) => {
  try {
    const notes = await LoveNote.find();
    res.json(notes);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/api/lovenotes', async (req, res) => {
  try {
    const newNote = new LoveNote({
      note: req.body.note,
    });
    await newNote.save();
    
    io.emit('noteAdded', newNote);
    res.status(201).json({ note: newNote });
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete('/api/lovenotes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedNote = await LoveNote.findByIdAndDelete(id);

    if (!deletedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    io.emit('noteDeleted', id);
    res.json({ message: 'Note deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete the note' });
  }
});

app.post('/api/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    const url = `https://your-backend-url.com/uploads/${req.file.filename}`;
    const timestamp = new Date().toISOString().split('T')[0];
    const newPhoto = new Photo({ url, timestamp });
    await newPhoto.save();

    io.emit('photoAdded', newPhoto); // Notify clients

    res.status(201).json(newPhoto);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get('/api/photos', async (req, res) => {
  try {
    const photos = await Photo.find();
    res.json(photos);
  } catch (err) {
    res.status(500).send(err);
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
