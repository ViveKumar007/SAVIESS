const express = require('express');
const router = express.Router();

const { verifyToken, checkRole } = require('../middleware/auth');
const { upload } = require('../utils/uploadHandler');

// Controllers
const authController = require('../controllers/authController');
const applicationController = require('../controllers/applicationController');
const inventoryController = require('../controllers/inventoryController');
const visitController = require('../controllers/visitController');
const dashboardController = require('../controllers/dashboardController');
const clinicalController = require('../controllers/clinicalController');

// ----------------------------------------------------------------------------
// 1. Auth Module
// ----------------------------------------------------------------------------
router.post('/auth/register', authController.register); // Restricted inside controller based on user presence
router.post('/auth/login', authController.login);
router.get('/auth/profile', verifyToken, authController.getProfile);
router.put('/auth/change-password', verifyToken, authController.changePassword);
router.post(
  '/auth/provision',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  authController.provisionUser
);

// ----------------------------------------------------------------------------
// 1b. Location Lookups (Districts & Blocks for dropdowns)
// ----------------------------------------------------------------------------
router.get('/districts', verifyToken, async (req, res) => {
  try {
    const pool = require('../config/db');
    const [districts] = await pool.query('SELECT id, name FROM districts ORDER BY name ASC');
    res.json({ success: true, data: districts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});
router.get('/blocks', verifyToken, async (req, res) => {
  try {
    const pool = require('../config/db');
    const { districtId } = req.query;
    let query = 'SELECT id, district_id, name FROM blocks';
    const params = [];
    if (districtId) {
      query += ' WHERE district_id = ?';
      params.push(parseInt(districtId));
    }
    query += ' ORDER BY name ASC';
    const [blocks] = await pool.query(query, params);
    res.json({ success: true, data: blocks });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});

// ----------------------------------------------------------------------------
// 2. Onboarding & Applications Module
// ----------------------------------------------------------------------------
router.post(
  '/applications', 
  upload.array('files', 5), 
  applicationController.submitApplication
); // Publicly submissible, but handles auth user log context if present
router.get(
  '/applications', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager', 'field_officer']), 
  applicationController.getApplications
);
router.put(
  '/applications/:id/status', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  applicationController.updateStatus
);

// ----------------------------------------------------------------------------
// 3. Inventory & Logistics Module
// ----------------------------------------------------------------------------
router.get(
  '/inventory/central', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  inventoryController.getCentralInventory
);
router.post(
  '/inventory/central/restock', 
  verifyToken, 
  checkRole(['super_admin', 'program_director']), 
  inventoryController.addCentralStock
);
router.post(
  '/inventory/dispatch', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  inventoryController.dispatchToRhp
);
router.get(
  '/inventory/rhp/:rhpId', 
  verifyToken, 
  inventoryController.getRhpInventory
);

// Toolkits sub-module
router.get(
  '/inventory/toolkits', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  inventoryController.getToolkitInventory
);
router.post(
  '/inventory/toolkits/restock', 
  verifyToken, 
  checkRole(['super_admin', 'program_director']), 
  inventoryController.addToolkits
);
router.post(
  '/inventory/toolkits/issue', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  inventoryController.issueToolkit
);

// Requisitions / Indents sub-module
router.post(
  '/indents', 
  verifyToken, 
  checkRole(['rhp']), 
  inventoryController.raiseIndent
);
router.get(
  '/indents', 
  verifyToken, 
  inventoryController.getIndents
);
router.put(
  '/indents/:id/status', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  inventoryController.updateIndentStatus
);

// ----------------------------------------------------------------------------
// 4. Clinical Features Module (Patient, Screening, Dispensing)
// ----------------------------------------------------------------------------
router.post(
  '/patients', 
  verifyToken, 
  checkRole(['rhp']), 
  clinicalController.registerPatient
);
router.post(
  '/screenings', 
  verifyToken, 
  checkRole(['rhp']), 
  clinicalController.logScreening
);
router.post(
  '/dispensings', 
  verifyToken, 
  checkRole(['rhp']), 
  clinicalController.dispenseGlasses
);
router.get(
  '/dispensings/:id/pdf', 
  verifyToken, 
  clinicalController.getDispensingPdf
);
router.get(
  '/patients', 
  verifyToken, 
  checkRole(['rhp']), 
  clinicalController.getPatients
);
router.get(
  '/rhps', 
  verifyToken, 
  clinicalController.getAllRhps
);

// ----------------------------------------------------------------------------
// 5. Visits & Live Location Module
// ----------------------------------------------------------------------------
router.get(
  '/visits', 
  verifyToken, 
  visitController.getVisits
);
router.post(
  '/visits/log', 
  verifyToken, 
  checkRole(['field_officer']), 
  upload.single('photo'), 
  visitController.logVisit
);
router.post(
  '/visits/location', 
  verifyToken, 
  checkRole(['field_officer']), 
  visitController.postLocation
);
router.get(
  '/visits/live', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  visitController.getAllLiveLocations
);
router.post(
  '/visits/stop-tracking', 
  verifyToken, 
  checkRole(['field_officer']), 
  visitController.stopTracking
);

// ----------------------------------------------------------------------------
// 6. Analytics Dashboard Module
// ----------------------------------------------------------------------------
router.get(
  '/dashboard/summary', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  dashboardController.getDashboardSummary
);
router.get(
  '/dashboard/fo-daily', 
  verifyToken, 
  checkRole(['super_admin', 'program_director', 'field_manager']), 
  dashboardController.getFoDailySummary
);

// Admin Data Table Routes — View all records entered by FOs and RHPs
router.get(
  '/dashboard/patients',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  dashboardController.getAllPatients
);
router.get(
  '/dashboard/screenings',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  dashboardController.getAllScreenings
);
router.get(
  '/dashboard/dispensings',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  dashboardController.getAllDispensings
);
router.get(
  '/dashboard/visits',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  dashboardController.getAllVisits
);

module.exports = router;
