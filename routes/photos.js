require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const Photo = require('../models/Photo');
const router = express.Router();
const path = require('path');
const { Readable } = require('stream'); 

const auth = new google.auth.GoogleAuth({
  keyFile: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to upload to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    // Convert Buffer to Readable stream
    const fileStream = Readable.from(fileBuffer);

    const media = {
      mimeType,
      body: fileStream,
    };

    const res = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    return `https://drive.google.com/uc?id=${res.data.id}`;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error.message);
    throw error;
  }
};

// Helper function to format date
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB');
};

// Route to upload photo
router.post('/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = await uploadToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    req.io.emit('photoUploaded', { url: fileUrl, _id: newPhoto._id });
    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, _id: newPhoto._id });
  } catch (error) {
    console.error('Photo upload error:', error.message);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

// Route to fetch all photos
router.get('/', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ timestamp: -1 });
    const formattedPhotos = photos.map(photo => ({
      ...photo.toObject(),
      timestamp: formatDate(photo.timestamp)
    }));
    res.json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
});

// Route to delete photo by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const photo = await Photo.findByIdAndDelete(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const fileId = photo.url.split('id=')[1];
    await drive.files.delete({ fileId });

    req.io.emit('photoDeleted', id);
    res.json({ message: 'Photo deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
