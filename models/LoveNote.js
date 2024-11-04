const mongoose = require('mongoose');

const loveNoteSchema = new mongoose.Schema({
  note: String,
});

module.exports = mongoose.model('LoveNote', loveNoteSchema);
