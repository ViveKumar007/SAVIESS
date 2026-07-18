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
const partnerController = require('../controllers/partnerController');
const kpiController = require('../controllers/kpiController');
const fieldReportController = require('../controllers/fieldReportController');
const rhpRegistrationController = require('../controllers/rhpRegistrationController');
const fieldManagerController = require('../controllers/fieldManagerController');

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

// Program Director dedicated dashboard summary
router.get(
  '/dashboard/pd-summary',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  dashboardController.getPdSummary
);

// Field Manager dedicated dashboard summary
router.get(
  '/dashboard/fm-summary',
  verifyToken,
  checkRole(['super_admin', 'field_manager']),
  dashboardController.getFmSummary
);

// ----------------------------------------------------------------------------
// 6b. Field Manager Admin Management (Super Admin only)
// ----------------------------------------------------------------------------
router.get(
  '/dashboard/field-managers',
  verifyToken,
  checkRole(['super_admin']),
  dashboardController.getFieldManagers
);
// Reassign route must come before :userId to avoid path conflict
router.put(
  '/dashboard/field-managers/reassign-fo',
  verifyToken,
  checkRole(['super_admin']),
  dashboardController.reassignFieldOfficer
);
router.get(
  '/dashboard/field-managers/:userId',
  verifyToken,
  checkRole(['super_admin']),
  dashboardController.getFieldManagerDetail
);
router.get(
  '/dashboard/field-managers/:userId/visits',
  verifyToken,
  checkRole(['super_admin']),
  dashboardController.getFieldManagerVisitHistory
);
router.put(
  '/dashboard/field-managers/:userId/status',
  verifyToken,
  checkRole(['super_admin']),
  dashboardController.updateFieldManagerStatus
);


// ----------------------------------------------------------------------------
// 7. Partner Management Module (Program Director)
// ----------------------------------------------------------------------------
router.get(
  '/partners',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  partnerController.getPartners
);
router.post(
  '/partners',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  partnerController.createPartner
);
router.put(
  '/partners/:id',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  partnerController.updatePartner
);
router.delete(
  '/partners/:id',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  partnerController.deletePartner
);

// ----------------------------------------------------------------------------
// 8. KPI Tracking Module (Program Director)
// ----------------------------------------------------------------------------
router.get(
  '/kpis/targets',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  kpiController.getTargets
);
router.post(
  '/kpis/targets',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  kpiController.setTargets
);
router.get(
  '/kpis/actuals',
  verifyToken,
  checkRole(['super_admin', 'program_director']),
  kpiController.getActuals
);

// ----------------------------------------------------------------------------
// 9. Field Reports Module (Field Officer + Field Manager)
// ----------------------------------------------------------------------------
router.get(
  '/field-reports',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager', 'field_officer']),
  fieldReportController.getFieldReports
);
router.post(
  '/field-reports',
  verifyToken,
  checkRole(['field_officer']),
  fieldReportController.submitFieldReport
);
router.put(
  '/field-reports/:id/review',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  fieldReportController.reviewFieldReport
);

// ----------------------------------------------------------------------------
// 10. Public Endpoints (No Authentication Required)
// ----------------------------------------------------------------------------
router.get('/public/states', async (req, res) => {
  try {
    const pool = require('../config/db');
    const [states] = await pool.query('SELECT id, name, code FROM states ORDER BY name ASC');
    res.json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});
router.get('/public/districts', async (req, res) => {
  try {
    const pool = require('../config/db');
    const [districts] = await pool.query('SELECT id, name FROM districts ORDER BY name ASC');
    res.json({ success: true, data: districts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
});
router.get('/public/blocks', async (req, res) => {
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
// 11. RHP Public Registration & Admin Management Module
// ----------------------------------------------------------------------------
// Public: Submit application (with file uploads)
router.post(
  '/rhp/register',
  upload.fields([
    { name: 'photograph', maxCount: 1 },
    { name: 'aadhaarDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'registrationCert', maxCount: 1 },
    { name: 'supportingDocs', maxCount: 3 }
  ]),
  rhpRegistrationController.submitRegistration
);

// Admin: List all applications (paginated, filterable)
router.get(
  '/rhp',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.getApplications
);

// Admin: Export applications
router.get(
  '/rhp/export',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.exportApplications
);

// Admin: View single application
router.get(
  '/rhp/:id',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.getApplication
);

// Admin: Update application
router.put(
  '/rhp/:id',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.updateApplication
);

// Admin: Delete application
router.delete(
  '/rhp/:id',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.deleteApplication
);

// Admin: Update application status (approve/reject)
router.put(
  '/rhp/:id/status',
  verifyToken,
  checkRole(['super_admin', 'program_director', 'field_manager']),
  rhpRegistrationController.updateStatus
);

// ----------------------------------------------------------------------------
// 12. Field Manager Module — Teams, Live Tracking, RHP Visits
// ----------------------------------------------------------------------------
router.get(
  '/fm/field-officers',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.getManagedFieldOfficers
);
router.post(
  '/fm/teams',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.createTeam
);
router.get(
  '/fm/teams',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.getTeams
);
router.put(
  '/fm/teams/:id',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.updateTeam
);
router.delete(
  '/fm/teams/:id',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.deleteTeam
);
router.post(
  '/fm/teams/:id/members',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.addTeamMembers
);
router.delete(
  '/fm/teams/:id/members/:foId',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.removeTeamMember
);
router.get(
  '/fm/team-locations',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.getTeamLocations
);
router.get(
  '/fm/rhp-visits',
  verifyToken,
  checkRole(['field_manager']),
  fieldManagerController.getRhpVisits
);

module.exports = router;
