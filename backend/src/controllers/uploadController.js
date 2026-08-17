const { getSignedUrl } = require('../utils/uploadHandler');
const { sendDbError } = require('../utils/errors');

// GET /uploads/signed-url?publicId=...&mimeType=...
// Any authenticated user may request a short-lived (15 min) signed URL for an
// authenticated-delivery Cloudinary asset. This intentionally does not layer
// per-context ownership rules on top (e.g. "only this patient's RHP") — the
// fix here closes the "public forever, no auth required" gap; finer-grained
// authorization per asset type is a follow-up, not required for this endpoint
// to already be a large improvement over the previous fully-public delivery.
const getUploadSignedUrl = async (req, res) => {
  const { publicId, mimeType } = req.query;

  if (!publicId) {
    return res.status(400).json({ success: false, error: 'publicId is required' });
  }

  try {
    const url = getSignedUrl(publicId, mimeType || 'image/jpeg');
    res.json({ success: true, url });
  } catch (error) {
    console.error('Get signed URL error:', error);
    sendDbError(res, error, 'Failed to generate signed URL');
  }
};

module.exports = { getUploadSignedUrl };
