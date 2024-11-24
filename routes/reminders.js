// Reminder routes (routes/reminders.js)
const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');

// Create a new reminder
router.post('/reminders', async (req, res) => {
  const reminder = new Reminder(req.body);
  await reminder.save();
  res.status(201).send(reminder);
});

// Get all reminders
router.get('/reminders', async (req, res) => {
  const reminders = await Reminder.find();
  res.send(reminders);
});

// Update a reminder
router.put('/reminders/:id', async (req, res) => {
  const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.send(reminder);
});

// Delete a reminder
router.delete('/reminders/:id', async (req, res) => {
  await Reminder.findByIdAndDelete(req.params.id);
  res.send({ message: 'Reminder deleted' });
});

module.exports = router;
