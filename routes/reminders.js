// Reminder routes (routes/reminders.js)
const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const cron = require('node-cron');

// Create a new reminder
router.post('/', async (req, res) => {
  try {
    const { title, description, date, isNotified, repeat, token } = req.body;
    const reminder = new Reminder({ title, description, date: new Date(date).toISOString(), isNotified, repeat, token });
    await reminder.save();
    res.status(201).send(reminder);
  } catch (error) {
    res.status(400).send({ error: 'Error creating reminder', details: error.message });
  }
});

router.post('/tokens', async (req, res) => {
  const { token } = req.body;

  try {
    const existingToken = await Token.findOne({ token });
    if (!existingToken) {
      const newToken = new Token({ token });
      await newToken.save();
    }
    res.send({ success: true });
  } catch (error) {
    res.status(500).send({ error: 'Error saving token', details: error.message });
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
  try {
    const reminder = await Reminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.send(reminder);
  } catch (error) {
    res.status(500).send({ error: 'Error updating reminder' });
  }
});

// Delete a reminder
router.delete('/:id', async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.send({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).send({ error: 'Error deleting reminder' });
  }
});

// Push notification function
const sendNotification = async (token, title, body) => {
  try {
    const message = {
      notification: { title, body },
      token,
    };
    await admin.messaging().send(message);
    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Cron job to send notifications
cron.schedule('* * * * *', async () => {
  const now = new Date();

  const reminders = await Reminder.find({
    date: { $lte: now },
    isNotified: false,
  });

  reminders.forEach(async (reminder) => {
    const { token, title, description } = reminder;

    await sendNotification(token, title, description);

    reminder.isNotified = true;
    await reminder.save();
  });
});

module.exports = router;
