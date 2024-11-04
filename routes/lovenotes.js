const express = require('express');
const LoveNote = require('../models/LoveNote');
const router = express.Router();

// Fetch all love notes
router.get('/', async (req, res) => {
  try {
    const notes = await LoveNote.find();
    res.json(notes);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Add new love note
router.post('/', async (req, res) => {
  try {
    const newNote = new LoveNote({
      note: req.body.note,
    });
    await newNote.save();
    
    req.io.emit('noteAdded', newNote);
    res.status(201).json({ note: newNote });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Delete love note by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedNote = await LoveNote.findByIdAndDelete(id);

    if (!deletedNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    req.io.emit('noteDeleted', id);
    res.json({ message: 'Note deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete the note' });
  }
});

module.exports = router;
