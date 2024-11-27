require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const Photo = require('../models/Photo');
const router = express.Router();
const path = require('path');
const { Readable } = require('stream');

const serviceAccountKey = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
};

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Function to upload to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    console.log('Service Account Keys:', serviceAccountKey);
    console.log('File buffer:', fileBuffer);
    console.log('File name:', fileName);
    console.log('Mime type:', mimeType);


    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const fileStream = Readable.from(fileBuffer); // Convert buffer to stream

    const media = {
      mimeType,
      body: fileStream,
    };

    console.log('File Metadata:', fileMetadata);
    console.log('Media:', media);

    const res = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    // Make the file publicly accessible
    const permissionsRes = await drive.permissions.create({
      fileId: res.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log('Permissions Response:', permissionsRes.data);
    console.log('Google Drive Response:', res.data);

    return res.data.webContentLink || res.data.webViewLink;
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
    // Check if file was uploaded
    if (!req.file) {
      console.error('No file uploaded:', req.body);
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Log the file details to verify content
    console.log('Uploaded File:', req.file);
    console.log('File MIME Type:', req.file.mimetype);

    // Validate MIME type (optional)
    const validMimeTypes = ['image/jpeg', 'image/png'];
    if (!validMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    // Upload the photo to Google Drive
    const fileUrl = await uploadToGoogleDrive(req.file.buffer, req.file.originalname, req.file.mimetype);

    const match = fileUrl.match(/id=([^&]+)/);
    const fileId = match ? match[1] : null;

    if (!fileId) {
      console.error('Failed to extract fileId from fileUrl:', fileUrl);
      return res.status(500).json({ message: 'Failed to upload photo: fileId extraction error' });
    }

    // Save the file URL in the database
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    // Emit the uploaded photo event for real-time updates
    req.io.emit('photoUploaded', {
      _id: newPhoto._id,
      id: fileId, // Extracted from Google Drive URL
      url: fileUrl,
      timestamp: formatDate(newPhoto.timestamp),
    });

    // Send the success response
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

    // Format the photos with the extracted ID
    const formattedPhotos = photos.map((photo) => {
      const match = photo.url.match(/id=([^&]+)/); // Extract ID from the URL
      const fileId = match ? match[1] : null;

      return {
        ...photo.toObject(),
        id: fileId, // Add extracted ID
        timestamp: formatDate(photo.timestamp),
      };
    });

    res.json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch photos' });
  }
});

// Route to delete photo by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete photo from database
    const photo = await Photo.findByIdAndDelete(id);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Extract fileId from the photo URL
    const match = photo.url.match(/id=([^&]+)/);
    const fileId = match ? match[1] : null;

    if (!fileId) {
      return res.status(400).json({ message: 'Invalid photo URL format' });
    }

    // Delete the file from Google Drive
    await drive.files.delete({ fileId });

    // Notify frontend via Socket.io
    req.io.emit('photoDeleted', id);

    // Respond with success
    res.json({ message: 'Photo deleted successfully', id });
  } catch (error) {
    console.error('Error deleting photo:', error.response?.data || error.message);

    if (error.code === 404) {
      return res.status(404).json({ message: 'File not found on Google Drive' });
    }

    res.status(500).json({ message: 'Failed to delete the photo' });
  }
});

module.exports = router;
