const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 5000;

// Wrap app in an HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',  // Adjust for production to specific origins
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://nopref:LifeLess23@love.n3a2u.mongodb.net/?retryWrites=true&w=majority');

const loveNoteSchema = new mongoose.Schema({
  note: String,
});

const LoveNote = mongoose.model('LoveNote', loveNoteSchema);

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
    
    // Emit a 'noteAdded' event with the new note data
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

    // Emit a 'noteDeleted' event with the note's ID
    io.emit('noteDeleted', id);

    res.json({ message: 'Note deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete the note' });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
