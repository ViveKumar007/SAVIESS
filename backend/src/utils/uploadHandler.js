const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary — credentials MUST come from environment variables.
// In development, set them in backend/.env. In production, use deployment secrets.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[CLOUDINARY] WARNING: Cloudinary credentials are not configured. File uploads will fail.');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Named constants ──
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const SIGNED_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes

// Configure Multer memory storage, with a shared MIME-type whitelist applied
// to every upload site in the app (visit proof, KYC docs, distribution proof, etc.)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, PDF.`));
    }
    cb(null, true);
  }
});

// Cloudinary resource_type must be known consistently at both upload and
// signed-URL-generation time — derive it the same way in both places.
const resourceTypeForMime = (mimeType) => (mimeType && mimeType.startsWith('image/') ? 'image' : 'raw');

// Helper function to stream upload to Cloudinary as an authenticated (private)
// asset — not publicly reachable by URL alone. Callers must request a
// short-lived signed URL (getSignedUrl) to actually view/download it.
const uploadStream = (fileBuffer, folder = 'saviess_uploads', mimeType = 'image/jpeg') => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return reject(new Error('Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'));
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, type: 'authenticated', resource_type: resourceTypeForMime(mimeType) },
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

// Generate a short-lived signed URL for an authenticated-delivery asset.
const getSignedUrl = (publicId, mimeType) => {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY_SECONDS;
  return cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: resourceTypeForMime(mimeType),
    sign_url: true,
    secure: true,
    expires_at: expiresAt
  });
};

// Helper function to delete assets from Cloudinary
const deleteAsset = async (publicId, mimeType = 'image/jpeg') => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary credentials are not configured.');
  }
  try {
    return await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: resourceTypeForMime(mimeType) });
  } catch (error) {
    console.error('Cloudinary delete asset error:', error);
    throw error;
  }
};

module.exports = {
  upload,
  uploadStream,
  getSignedUrl,
  deleteAsset,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
