const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Upload photo
router.post('/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `https://backend-production-8c13.up.railway.app/uploads/${req.file.filename}`;
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    req.io.emit('photoUploaded', { url: fileUrl, timestamp: newPhoto.timestamp, _id: newPhoto._id });
    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, timestamp: newPhoto.timestamp, _id: newPhoto._id });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

// Fetch all photos
router.get('/', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ timestamp: -1 });
    res.json(photos);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
});

// Delete photo by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const photo = await Photo.findByIdAndDelete(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const fileName = path.basename(photo.url);
    const filePath = path.join(__dirname, '../uploads', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Failed to delete photo file:', err);
          return res.status(500).json({ message: 'Failed to delete photo file' });
        }

        req.io.emit('photoDeleted', id);
        res.json({ message: 'Photo deleted successfully', id });
      });
    } else {
      req.io.emit('photoDeleted', id);
      res.json({ message: 'Photo deleted from database but file not found', id });
    }
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
