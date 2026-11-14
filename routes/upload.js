const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { PassThrough } = require('stream'); // 🚀 For memory-efficient streaming

// 🔒 SECURITY FIRST: Ensure Cloudinary credentials are loaded from Environment Variables
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('⚠️ CRITICAL: Cloudinary environment variables are missing! Uploads will fail.');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // 🔒 SECURITY FIRST: Validate file type (Only allow images)
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed!'), false);
    }
  }
});

// Upload route
// ⚠️ CRITICAL SECURITY WARNING: 
// You MUST protect this route with 'authenticateToken' or 'requireAdmin' middleware in server.js 
// to prevent anonymous users from spamming your Cloudinary quota.
// Example in server.js: app.use('/api/upload', authenticateToken, uploadRoutes);
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ No file uploaded' });
    }

    // 🚀 HIGH TRAFFIC: Use upload_stream instead of base64 conversion to save memory
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: 'fight-p2p', 
        resource_type: 'image' // 🔒 SECURITY: Restrict to image only (no videos/scripts)
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ message: '❌ Upload failed: ' + error.message });
        }
        
        res.json({
          message: '✅ Image uploaded successfully',
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    );

    // Pipe the file buffer directly to Cloudinary (Memory Efficient)
    const bufferStream = new PassThrough();
    bufferStream.end(req.file.buffer);
    bufferStream.pipe(uploadStream);

  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ message: '❌ Upload failed: ' + error.message });
  }
});

module.exports = router;
