require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const { PassThrough } = require('stream');
const Photo = require('../models/Photo');
const router = express.Router();
const path = require('path');

// Load the service account key JSON file
const serviceAccount = path.join(__dirname, '../birthday-442719-bafc4e875af0.json');

// Configure Multer for memory storage


// Google Drive API setup
const auth = new google.auth.GoogleAuth({
  keyFile: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/drive.file'], // The service account only needs access to the Drive API
});


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
const drive = google.drive({ version: 'v3', auth });

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to upload to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    const fileMetadata = {
      name: fileName,
      parents: ['your-google-drive-folder-id'], // The folder ID you shared with the service account
    };
    const media = {
      mimeType: mimeType,
      body: Buffer.from(fileBuffer, 'utf8'), // Use 'fileBuffer' directly for image uploads
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
    res.status(500).json({ message: 'Photo upload failed', error: error.message });
    throw error;
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

    // Upload the file to Google Drive
    const fileUrl = await uploadToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    req.io.emit('photoUploaded', { url: fileUrl, _id: newPhoto._id });
    res.status(201).json({ message: 'Photo uploaded successfully', url: fileUrl, _id: newPhoto._id });
  } catch (error) {
    console.error('Photo upload error:', error);
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

    const fileId = photo.url.split('id=')[1];  // Extract Google Drive file ID from URL
    await drive.files.delete({ fileId });

    req.io.emit('photoDeleted', id);
    res.json({ message: 'Photo deleted successfully', id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
