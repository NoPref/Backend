const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  repeat: {
    type: String,
    enum: ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'], // Define valid repeat options
    default: 'None',
  },
  isNotified: { type: Boolean, default: false },
  token: { type: String, required: true },
});

module.exports = mongoose.model('Reminder', reminderSchema);
