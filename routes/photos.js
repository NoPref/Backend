require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const Photo = require('../models/Photo');
const router = express.Router();

// Load environment variables
const { 
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET, 
  GOOGLE_REDIRECT_URI, 
  GOOGLE_REFRESH_TOKEN, 
  GOOGLE_DRIVE_FOLDER_ID 
} = process.env;

// Initialize OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Set refresh token for OAuth2
oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

// Set up Google Drive API
const drive = google.drive({ version: 'v3', auth: oAuth2Client });

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB file size limit

// Function to upload to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: Buffer.from(fileBuffer),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Return public URL
    const fileUrl = `https://drive.google.com/uc?id=${response.data.id}`;
    return fileUrl;
  } catch (error) {
    throw new Error(`Failed to upload to Google Drive: ${error.message}`);
  }
};

// Helper function to format date
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB'); // Format as DD/MM/YYYY
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

    const formattedTimestamp = formatDate(newPhoto.timestamp);

    req.io.emit('photoUploaded', { url: fileUrl, timestamp: formattedTimestamp, _id: newPhoto._id });
    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, timestamp: formattedTimestamp, _id: newPhoto._id });
  } catch (error) {
    res.status(500).json({ message: `Upload failed: ${error.message}` });
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

    const fileId = photo.url.split('id=')[1];  // Extract Google Drive file ID from URL
    await drive.files.delete({ fileId });

    req.io.emit('photoDeleted', id);
    res.json({ message: 'Photo deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
