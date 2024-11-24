const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  isNotified: { type: Boolean, default: false },
});

module.exports = mongoose.model('Reminder', reminderSchema);
