const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const port = 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://nopref:LifeLess23@love.n3a2u.mongodb.net/?retryWrites=true&w=majority');

const loveNoteSchema = new mongoose.Schema({
  note: String,
});

const LoveNote = mongoose.model('LoveNote', loveNoteSchema);

// Endpoint to get all notes
app.get('/api/lovenotes', async (req, res) => {
  try {
    const notes = await LoveNote.find();
    res.json(notes);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint to create a new note
app.post('/api/lovenotes', async (req, res) => {
  try {
    const newNote = new LoveNote({
      note: req.body.note,
    });
    await newNote.save();
    
    // Emit event to all connected clients
    io.emit('newNote', newNote);

    res.status(201).json({ note: newNote });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Endpoint to delete a note by ID
app.delete('/api/lovenotes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedNote = await LoveNote.findByIdAndDelete(id);

    if (!deletedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Emit event to update clients after deletion
    io.emit('deleteNote', id);

    res.json({ message: 'Note deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete the note' });
  }
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
