require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const Photo = require('../models/Photo');
const router = express.Router();
const path = require('path');
const { Readable } = require('stream');

// Rebuild the service account key JSON dynamically
const serviceAccountKey = {
  type: process.env.type,
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key.replace(/\\n/g, '\n'), // Ensure newlines are preserved
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri,
  token_uri: process.env.token_uri,
  auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.client_x509_cert_url,
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
    console.log('Service Account Key:', serviceAccountKey);
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

    // Save the file URL in the database
    const newPhoto = new Photo({ url: fileUrl });
    await newPhoto.save();

    // Emit the uploaded photo event for real-time updates
    req.io.emit('photoUploaded', { url: fileUrl, _id: newPhoto._id });

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
