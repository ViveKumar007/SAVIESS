const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret'
});

// Configure Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max limit
  }
});

// Helper function to stream upload to Cloudinary
const uploadStream = (fileBuffer, folder = 'saviess_uploads') => {
  return new Promise((resolve, reject) => {
    // Robust fallback for mock testing in case Cloudinary variables are missing
    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud') {
      console.log('Using Mock Cloudinary Upload Stream');
      return resolve({
        secure_url: `https://res.cloudinary.com/mock_cloud/image/upload/v1234567890/saviess_mock_${Date.now()}.png`,
        public_id: `mock_public_id_${Date.now()}`,
        bytes: fileBuffer.length,
        format: 'png'
      });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (error) {
          console.error('Cloudinary stream upload error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// Helper function to delete assets from Cloudinary
const deleteAsset = async (publicId) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud') {
    console.log('Using Mock Cloudinary Deletion for ID:', publicId);
    return { result: 'ok' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete asset error:', error);
    throw error;
  }
};

module.exports = {
  upload,
  uploadStream,
  deleteAsset
};
