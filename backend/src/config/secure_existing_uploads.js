/**
 * One-off script: convert already-uploaded Cloudinary assets from public to
 * authenticated delivery, so existing proof photos / KYC documents aren't
 * left permanently public after uploadHandler.js switched new uploads over.
 *
 * Run once, manually, from a terminal with working DB + Cloudinary connectivity:
 *   node backend/src/config/secure_existing_uploads.js
 *
 * Not wired into npm run dev / seed — this only needs to run a single time.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const resourceTypeForMime = (mimeType) => (mimeType && mimeType.startsWith('image/') ? 'image' : 'raw');

const secureAsset = async (publicId, mimeType) => {
  if (!publicId) return { skipped: true };
  try {
    await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      to_type: 'authenticated',
      resource_type: resourceTypeForMime(mimeType)
    });
    return { ok: true };
  } catch (error) {
    // Already-authenticated assets, or ones that no longer exist, will error here — log and continue.
    return { ok: false, error: error.message };
  }
};

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'saviess_vep',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });

  console.log('Securing existing Cloudinary uploads (converting to authenticated delivery)...');
  let converted = 0, failed = 0, skipped = 0;

  // 1. proof_uploads (visit proof, legacy application uploads)
  const [proofs] = await conn.query('SELECT id, public_id, mime_type FROM proof_uploads');
  for (const row of proofs) {
    const result = await secureAsset(row.public_id, row.mime_type);
    if (result.skipped) skipped++;
    else if (result.ok) converted++;
    else { failed++; console.warn(`  proof_uploads#${row.id} (${row.public_id}): ${result.error}`); }
  }
  console.log(`  proof_uploads: ${proofs.length} rows processed`);

  // 2. rhp_application_documents (Aadhaar/PAN/registration cert scans)
  const [docs] = await conn.query('SELECT id, public_id, mime_type FROM rhp_application_documents');
  for (const row of docs) {
    const result = await secureAsset(row.public_id, row.mime_type);
    if (result.skipped) skipped++;
    else if (result.ok) converted++;
    else { failed++; console.warn(`  rhp_application_documents#${row.id} (${row.public_id}): ${result.error}`); }
  }
  console.log(`  rhp_application_documents: ${docs.length} rows processed`);

  // 3. pd_fo_distribution (eyeglass distribution proof — mime type not stored, default to image)
  const [dists] = await conn.query('SELECT id, proof_public_id FROM pd_fo_distribution');
  for (const row of dists) {
    const result = await secureAsset(row.proof_public_id, 'image/jpeg');
    if (result.skipped) skipped++;
    else if (result.ok) converted++;
    else { failed++; console.warn(`  pd_fo_distribution#${row.id} (${row.proof_public_id}): ${result.error}`); }
  }
  console.log(`  pd_fo_distribution: ${dists.length} rows processed`);

  console.log(`\nDone. Converted: ${converted}, skipped (no public_id): ${skipped}, failed: ${failed}`);
  await conn.end();
})().catch(e => {
  console.error('Secure existing uploads failed:', e.message);
  process.exit(1);
});
