const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: Date,
  isNotified: { type: Boolean, default: false },
  repeat: {
    type: String,
    enum: ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'], // Define valid repeat options
    default: 'None',
  },
});

module.exports = mongoose.model('Reminder', reminderSchema);
