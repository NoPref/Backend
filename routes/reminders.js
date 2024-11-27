// Reminder routes (routes/reminders.js)
const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');

// Create a new reminder
router.post('/', async (req, res) => {
  try {
    const { title, description, date, isNotified, repeat } = req.body;
    const reminder = new Reminder({ title, description, date, isNotified, repeat });
    await reminder.save();
    res.status(201).send(reminder);
  } catch (error) {
    res.status(400).send({ error: 'Error creating reminder', details: error.message });
  }
});

// Get all reminders
router.get('/', async (req, res) => {
  try {
    const reminders = await Reminder.find();
    res.send(reminders);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching reminders' });
  }
});

// Update a reminder
router.put('/:id', async (req, res) => {
  const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.send(reminder);
});

// Delete a reminder
router.delete('/:id', async (req, res) => {
  await Reminder.findByIdAndDelete(req.params.id);
  res.send({ message: 'Reminder deleted' });
});

module.exports = router;
