const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const Photo = require('../models/Photo');
const router = express.Router();

// Load OAuth2 credentials for Google Drive
const credentials = require('../config/credentials.json');  // Place your credentials.json here
const { client_id, client_secret, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Set the refresh token here (from OAuth Playground or other means)
const refreshToken = '1//04LZthDi1ZJC5CgYIARAAGAQSNwF-L9IrwaBpduEb4_TG2pUNTK6DmmfvsODbZa8DOvpzqwzT73eXvJmoySX5_ZJujVAAn1p6YHk'; // Put your refresh token here
oAuth2Client.setCredentials({ refresh_token: refreshToken });

// Google Drive API setup
const drive = google.drive({ version: 'v3', auth: oAuth2Client });

// Configure Multer for memory storage (no disk storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to format date as DD/MM/YYYY
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB');  // Formats as DD/MM/YYYY
};

// Upload photo to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: ['1dT9C2jUmd8FWTFZXehKJVB8pBX_a37iE'],  // Specify the folder ID in your Google Drive
    };
    const media = {
      mimeType,
      body: Buffer.from(fileBuffer, 'utf8'),
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

    // Generate a public URL
    const url = `https://drive.google.com/uc?id=${res.data.id}`;
    return url;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};

// Upload photo route
router.post('/uploadPhoto', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload the file to Google Drive
    const fileUrl = await uploadToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    const formattedTimestamp = formatDate(newPhoto.timestamp);

    req.io.emit('photoUploaded', { url: fileUrl, timestamp: formattedTimestamp, _id: newPhoto._id });
    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, timestamp: formattedTimestamp, _id: newPhoto._id });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

// Fetch all photos route
router.get('/', async (req, res) => {
  try {
    const photos = await Photo.find().sort({ timestamp: -1 });

    // Format each photo's timestamp
    const formattedPhotos = photos.map(photo => ({
      ...photo.toObject(),
      timestamp: formatDate(photo.timestamp)
    }));

    res.json(formattedPhotos);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
});

// Delete photo by ID (from database and Google Drive)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const photo = await Photo.findByIdAndDelete(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const fileId = photo.url.split('id=')[1];  // Extract the Google Drive file ID from the URL

    await drive.files.delete({ fileId });

    req.io.emit('photoDeleted', id);
    res.json({ message: 'Photo deleted successfully', id });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
