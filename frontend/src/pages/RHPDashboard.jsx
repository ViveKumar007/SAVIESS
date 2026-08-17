import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Eye, Sparkles, Box, Hammer, ClipboardList, UserCheck, Plus, CheckCircle, ShieldAlert, FileDown, Camera } from 'lucide-react';
import { API } from '../api';

const RHPDashboard = () => {
  const [activeTab, setActiveTab] = useState('clinical');
  const [inventory, setInventory] = useState([]);
  const [patients, setPatients] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [indents, setIndents] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Dropdown lists — loaded from the real districts/blocks API, not hardcoded
  const [districts, setDistricts] = useState([]);
  const [blocks, setBlocks] = useState([]);

  // Form States: Patient Registration
  const [patFirst, setPatFirst] = useState('');
  const [patLast, setPatLast] = useState('');
  const [patGender, setPatGender] = useState('male');
  const [patAge, setPatAge] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patDistrict, setPatDistrict] = useState('');
  const [patBlock, setPatBlock] = useState('');
  const [patVillage, setPatVillage] = useState('');

  // Form States: Refraction Screening
  const [screenPatientId, setScreenPatientId] = useState('');
  const [screenDate, setScreenDate] = useState(new Date().toISOString().split('T')[0]);
  const [vaLeft, setVaLeft] = useState('6/6');
  const [vaRight, setVaRight] = useState('6/6');
  const [sphLeft, setSphLeft] = useState('0.00');
  const [sphRight, setSphRight] = useState('0.00');
  const [cylLeft, setCylLeft] = useState('0.00');
  const [cylRight, setCylRight] = useState('0.00');
  const [axisLeft, setAxisLeft] = useState('0');
  const [axisRight, setAxisRight] = useState('0');
  const [screenType, setScreenType] = useState('presbyopia');
  const [refRecommended, setRefRecommended] = useState(false);

  // Form States: Glasses Dispensing
  const [dispenseScreenId, setDispenseScreenId] = useState('');
  const [dispensePatientId, setDispensePatientId] = useState('');
  const [dispenseDate, setDispenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispLeftSph, setDispLeftSph] = useState('0.00');
  const [dispRightSph, setDispRightSph] = useState('0.00');
  const [dispFrameType, setDispFrameType] = useState('Full Rim');
  const [dispFrameColor, setDispFrameColor] = useState('Black');
  const [dispCost, setDispCost] = useState('150');
  const [dispPaid, setDispPaid] = useState('150');
  const [dispSubsidy, setDispSubsidy] = useState(false);
  const [dispSubsidyAmount, setDispSubsidyAmount] = useState('0');
  const [dispensedInvoice, setDispensedInvoice] = useState(null); // Save generated invoice details

  // Form States: Requisition Indent
  const [indentDate, setIndentDate] = useState(new Date().toISOString().split('T')[0]);
  const [indentItems, setIndentItems] = useState([{ itemName: 'Reading Glasses SPH +1.50', sku: 'RD-SPH+1.50-CYL-0.00', glassType: 'reading', leftPowerSph: '1.50', rightPowerSph: '1.50', quantityRequested: '10', unitPrice: '120' }]);

  // Proof Image Upload State (KYC / Screening photo proof)
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchDistricts();
    if (user.profileId) {
      fetchInventory();
      fetchPatients();
      fetchIndents();
    }
  }, [user.profileId]);

  // Fetch blocks when district changes
  useEffect(() => {
    if (!patDistrict) { setBlocks([]); return; }
    const loadBlocks = async () => {
      try {
        const res = await axios.get(`${API}/blocks?districtId=${patDistrict}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) setBlocks(res.data.data);
      } catch (err) { console.error('Load blocks error:', err); }
    };
    loadBlocks();
  }, [patDistrict]);

  const fetchDistricts = async () => {
    try {
      const res = await axios.get(`${API}/districts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setDistricts(res.data.data);
    } catch (err) { console.error('Load districts error:', err); }
  };

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API}/inventory/rhp/${user.profileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error('Fetch inventory error:', err);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API}/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setPatients(res.data.data);
      }
    } catch (err) {
      console.error('Fetch patients error:', err);
    }
  };

  const fetchIndents = async () => {
    try {
      const res = await axios.get(`${API}/indents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setIndents(res.data.data);
      }
    } catch (err) {
      console.error('Fetch indents error:', err);
    }
  };

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(`${API}/patients`, {
        firstName: patFirst,
        lastName: patLast,
        gender: patGender,
        age: patAge,
        phone: patPhone,
        districtId: patDistrict,
        blockId: patBlock,
        village: patVillage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSuccessMsg(`Patient ${patFirst} ${patLast} registered successfully!`);
        // Refresh from the server so the real record (with district/block names) is reflected
        fetchPatients();
        // Reset form (district/block left as-is — RHPs typically register several patients from the same village in one sitting)
        setPatFirst('');
        setPatLast('');
        setPatPhone('');
        setPatVillage('');
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Registration failed');
      setLoading(false);
    }
  };

  const handleLogScreening = async (e) => {
    e.preventDefault();
    if (!screenPatientId) {
      setErrorMsg('Please select a patient.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(`${API}/screenings`, {
        patientId: screenPatientId,
        screeningDate: screenDate,
        visualAcuityLeft: vaLeft,
        visualAcuityRight: vaRight,
        sphericalLeft: sphLeft,
        sphericalRight: sphRight,
        cylindricalLeft: cylLeft,
        cylindricalRight: cylRight,
        axisLeft: axisLeft,
        axisRight: axisRight,
        screeningType: screenType,
        referralRecommended: refRecommended
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSuccessMsg('Patient refraction screening assessment saved successfully!');
        const newScreenId = res.data.data.screeningId;
        
        // Auto prep the glasses dispensing form
        setDispenseScreenId(newScreenId);
        setDispensePatientId(screenPatientId);
        setDispLeftSph(sphLeft);
        setDispRightSph(sphRight);

        // Refresh screening records
        setScreenings(prev => [...prev, { id: newScreenId, patient_id: screenPatientId, screening_type: screenType }]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to save refraction results');
      setLoading(false);
    }
  };

  const handleDispenseSpectacles = async (e) => {
    e.preventDefault();
    if (!dispenseScreenId || !dispensePatientId) {
      setErrorMsg('Please link this dispensing to a valid screening.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(`${API}/dispensings`, {
        screeningId: dispenseScreenId,
        patientId: dispensePatientId,
        dispensingDate: dispenseDate,
        leftPowerSph: dispLeftSph,
        rightPowerSph: dispRightSph,
        frameType: dispFrameType,
        frameColor: dispFrameColor,
        glassType: 'reading', // Default standard reading
        cost: dispCost,
        amountPaid: dispPaid,
        subsidyApplied: dispSubsidy,
        subsidyAmount: dispSubsidyAmount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSuccessMsg('Glasses check-out and sales logged successfully!');
        setDispensedInvoice(res.data.data);
        fetchInventory(); // Refresh stock quantities
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Dispense action failed');
      setLoading(false);
    }
  };

  // Raised Indent request
  const handleRaiseIndent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await axios.post(`${API}/indents`, {
        requestDate: indentDate,
        items: indentItems
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSuccessMsg(`Indent sheet ${res.data.indentCode} raised successfully!`);
        fetchIndents();
        // Reset form to standard
        setIndentItems([{ itemName: 'Reading Glasses SPH +1.50', sku: 'RD-SPH+1.50-CYL-0.00', glassType: 'reading', leftPowerSph: '1.50', rightPowerSph: '1.50', quantityRequested: '10', unitPrice: '120' }]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to submit indent');
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!dispensedInvoice) return;
    try {
      const res = await axios.get(
        `${API}/dispensings/${dispensedInvoice.dispensingId}/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${dispensedInvoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setErrorMsg('Failed to download PDF receipt.');
    }
  };

  const handleProofChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const updateIndentItemField = (index, field, value) => {
    const updated = [...indentItems];
    updated[index][field] = value;
    setIndentItems(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* RHP Navbar Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
            <Sparkles className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">{user.firstName}'s Vision Center</h1>
            <p className="text-[10px] text-slate-400">Bihar Rural Health Provider (RHP) Portal</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="hidden sm:inline text-xs text-slate-400">RHP ID: {user.profileId}</span>
          <button
            onClick={handleLogout}
            className="p-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab Selectors */}
      <div className="bg-white border-b flex justify-center space-x-8 px-6">
        <button
          onClick={() => setActiveTab('clinical')}
          className={`py-4 px-2 border-b-2 text-sm font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'clinical' 
              ? 'border-teal-500 text-teal-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Patient & Clinical Care</span>
        </button>
        <button
          onClick={() => setActiveTab('logistics')}
          className={`py-4 px-2 border-b-2 text-sm font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'logistics' 
              ? 'border-teal-500 text-teal-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>Stocks & Logistics</span>
        </button>
      </div>

      {/* Feedback Messages */}
      <div className="max-w-4xl mx-auto w-full px-4 mt-6">
        {successMsg && (
          <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-start space-x-3 text-teal-700 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-teal-600" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-700 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Tab Panels */}
      <main className="max-w-4xl mx-auto w-full px-4 mt-6 pb-20">
        
        {/* TAB 1: CLINICAL PANEL */}
        {activeTab === 'clinical' && (
          <div className="space-y-8">
            
            {/* Step 1: Patient registration */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center space-x-2 border-b pb-3 mb-6">
                <UserCheck className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">1. Register Patient Demographics</h3>
              </div>
              
              <form onSubmit={handleRegisterPatient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text" required placeholder="First Name" value={patFirst} onChange={(e) => setPatFirst(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                />
                <input
                  type="text" required placeholder="Last Name" value={patLast} onChange={(e) => setPatLast(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                />
                <select
                  value={patGender} onChange={(e) => setPatGender(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="number" required placeholder="Age" value={patAge} onChange={(e) => setPatAge(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                />
                <input
                  type="tel" placeholder="Phone Number (Optional)" value={patPhone} onChange={(e) => setPatPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                />
                <select
                  required value={patDistrict} onChange={(e) => { setPatDistrict(e.target.value); setPatBlock(''); }}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                >
                  <option value="">Select District...</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select
                  required value={patBlock} onChange={(e) => setPatBlock(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  disabled={!patDistrict}
                >
                  <option value="">{patDistrict ? 'Select Block...' : 'Select district first'}</option>
                  {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input
                  type="text" required placeholder="Village Name" value={patVillage} onChange={(e) => setPatVillage(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                />
                
                {/* Proof Attachment */}
                <div className="sm:col-span-2 flex items-center space-x-3 pt-2">
                  <label className="flex items-center space-x-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-slate-50 text-xs font-semibold text-slate-500">
                    <Camera className="w-4 h-4 text-slate-400" />
                    <span>Attach ID Proof</span>
                    <input type="file" onChange={handleProofChange} className="hidden" />
                  </label>
                  {proofPreview && <img src={proofPreview} className="w-10 h-10 object-cover rounded-lg border" />}
                </div>

                <div className="sm:col-span-2 pt-2">
                  <button
                    type="submit" disabled={loading}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    Add Patient Record
                  </button>
                </div>
              </form>
            </div>

            {/* Step 2: Refraction log */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center space-x-2 border-b pb-3 mb-6">
                <Eye className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">2. Refraction Assessment & Screening Report</h3>
              </div>

              <form onSubmit={handleLogScreening} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Patient</label>
                    <select
                      required
                      value={screenPatientId} onChange={(e) => setScreenPatientId(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    >
                      <option value="">Choose patient...</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.village})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Screening Date</label>
                    <input
                      type="date" required value={screenDate} onChange={(e) => setScreenDate(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>

                {/* Left/Right Visual Acuity and Power table */}
                <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Refraction Parameters</h4>
                  
                  <div className="grid grid-cols-3 gap-3 text-center text-[10px] font-bold text-slate-400 uppercase">
                    <div>Eye</div>
                    <div>Visual Acuity</div>
                    <div>Spherical (SPH)</div>
                  </div>

                  {/* Right Eye */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <div className="text-xs font-bold text-slate-600 text-center">Right Eye (OD)</div>
                    <input
                      type="text" required value={vaRight} onChange={(e) => setVaRight(e.target.value)} placeholder="e.g. 6/6"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-center text-xs"
                    />
                    <input
                      type="number" step="0.25" value={sphRight} onChange={(e) => setSphRight(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-center text-xs"
                    />
                  </div>

                  {/* Left Eye */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <div className="text-xs font-bold text-slate-600 text-center">Left Eye (OS)</div>
                    <input
                      type="text" required value={vaLeft} onChange={(e) => setVaLeft(e.target.value)} placeholder="e.g. 6/18"
                      className="w-full px-3 py-2 border rounded-lg bg-white text-center text-xs"
                    />
                    <input
                      type="number" step="0.25" value={sphLeft} onChange={(e) => setSphLeft(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Diagnosis</label>
                    <select
                      value={screenType} onChange={(e) => setScreenType(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    >
                      <option value="presbyopia">Presbyopia (Reading difficulty)</option>
                      <option value="refractive_error">Refractive Error (Distance blur)</option>
                      <option value="cataract_suspect">Cataract Suspect (Motiyabind)</option>
                      <option value="normal">Normal Vision</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 mt-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Hospital Referral Needed?</h4>
                      <p className="text-[9px] text-slate-400">Needs surgery or specialized doctor checkup</p>
                    </div>
                    <input
                      type="checkbox" checked={refRecommended} onChange={(e) => setRefRecommended(e.target.checked)}
                      className="w-5 h-5 accent-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-xs rounded-xl transition-all"
                >
                  Save Refraction Screening
                </button>
              </form>
            </div>

            {/* Step 3: Spectacles checkout & PDF Download */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center space-x-2 border-b pb-3 mb-6">
                <Sparkles className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">3. Dispense Spectacles & Billing Invoice</h3>
              </div>

              {dispensedInvoice ? (
                <div className="p-6 border rounded-xl bg-teal-50/50 text-center space-y-4">
                  <CheckCircle className="w-10 h-10 text-teal-600 mx-auto" />
                  <div>
                    <h4 className="font-bold text-slate-800">Dispensing invoice created successfully!</h4>
                    <p className="text-xs text-slate-500 mt-1">Invoice number: {dispensedInvoice.invoiceNumber}</p>
                  </div>
                  <button
                    onClick={handleDownloadInvoice}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 font-bold text-xs text-slate-900 rounded-lg shadow-md transition-all"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Download Bilingual PDF Receipt</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDispenseSpectacles} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Screening Reference ID</label>
                      <input
                        type="text" required placeholder="Auto-fills on screening save" value={dispenseScreenId} onChange={(e) => setDispenseScreenId(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Patient ID</label>
                      <input
                        type="text" required placeholder="Auto-fills on screening save" value={dispensePatientId} onChange={(e) => setDispensePatientId(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <input
                      type="text" placeholder="Frame Type" value={dispFrameType} onChange={(e) => setDispFrameType(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 text-sm"
                    />
                    <input
                      type="text" placeholder="Frame Color" value={dispFrameColor} onChange={(e) => setDispFrameColor(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 text-sm"
                    />
                    <input
                      type="number" placeholder="Cost" value={dispCost} onChange={(e) => setDispCost(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 text-sm"
                    />
                    <input
                      type="number" placeholder="Amount Paid" value={dispPaid} onChange={(e) => setDispPaid(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Apply Subsidy (Preheal/VisionSpring)?</h4>
                      <p className="text-[9px] text-slate-400">Apply NGO financial discount for low income patients</p>
                    </div>
                    <input
                      type="checkbox" checked={dispSubsidy} onChange={(e) => setDispSubsidy(e.target.checked)}
                      className="w-5 h-5 accent-teal-500"
                    />
                  </div>

                  {dispSubsidy && (
                    <div>
                      <input
                        type="number" placeholder="Subsidy Discount Amount" value={dispSubsidyAmount} onChange={(e) => setDispSubsidyAmount(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 text-sm"
                      />
                    </div>
                  )}

                  <button
                    type="submit" disabled={loading}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    Confirm Sale & Issue Billing Invoice
                  </button>
                </form>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: LOGISTICS PANEL */}
        {activeTab === 'logistics' && (
          <div className="space-y-8">
            
            {/* Local stock levels */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 border-b pb-3 mb-6 flex items-center justify-between">
                <span>Power-wise Glasses stock level (Local center)</span>
                <button 
                  onClick={fetchInventory}
                  className="text-xs font-semibold text-teal-500 hover:text-teal-600"
                >
                  Refresh quantities
                </button>
              </h3>

              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3">SKU Code</th>
                      <th className="p-3">Glass Power</th>
                      <th className="p-3 text-center">Available Stock</th>
                      <th className="p-3">Safety Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No stock levels seeded yet. Approve your application or raise an indent to receive stock.</td>
                      </tr>
                    ) : (
                      inventory.map(item => (
                        <tr key={item.id} className="border-b hover:bg-slate-50/50">
                          <td className="p-3 font-mono text-[11px] text-slate-600">{item.sku}</td>
                          <td className="p-3 font-semibold text-slate-800">SPH +{item.left_power_sph?.toFixed(2)}</td>
                          <td className={`p-3 text-center font-bold ${item.quantity <= item.safety_stock_level ? 'text-rose-500' : 'text-slate-800'}`}>
                            {item.quantity}
                          </td>
                          <td className="p-3 text-slate-400">{item.safety_stock_level} units</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raise new indent form */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 border-b pb-3 mb-6">Raise Stock Requisition Indent</h3>

              <form onSubmit={handleRaiseIndent} className="space-y-4">
                {indentItems.map((item, idx) => (
                  <div key={idx} className="p-4 border rounded-xl bg-slate-50/50 grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Power SPH</label>
                      <select
                        value={item.leftPowerSph}
                        onChange={(e) => {
                          const p = parseFloat(e.target.value).toFixed(2);
                          updateIndentItemField(idx, 'leftPowerSph', p);
                          updateIndentItemField(idx, 'rightPowerSph', p);
                          updateIndentItemField(idx, 'sku', `RD-SPH+${p}-CYL-0.00`);
                          updateIndentItemField(idx, 'itemName', `Reading Glasses SPH +${p}`);
                        }}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                      >
                        <option value="1.00">+1.00 SPH</option>
                        <option value="1.50">+1.50 SPH</option>
                        <option value="2.00">+2.00 SPH</option>
                        <option value="2.50">+2.50 SPH</option>
                        <option value="3.00">+3.00 SPH</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quantity Requested</label>
                      <input
                        type="number" required placeholder="Quantity" value={item.quantityRequested}
                        onChange={(e) => updateIndentItemField(idx, 'quantityRequested', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catalog Unit Price</label>
                      <input
                        type="number" readOnly value={item.unitPrice}
                        className="w-full px-3 py-2 border rounded-lg bg-slate-100 text-slate-500 text-xs"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Submit Indent Request
                </button>
              </form>
            </div>

            {/* Indents tracking list */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 border-b pb-3 mb-6">Historical Indents Requests</h3>
              <div className="space-y-3">
                {indents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No indents found.</p>
                ) : (
                  indents.map(ind => (
                    <div key={ind.id} className="p-3 border rounded-xl flex items-center justify-between hover:bg-slate-50/50 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-800">Indent #{ind.id.toString().padStart(5, '0')}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Date: {new Date(ind.request_date).toDateString()} | Items count: {ind.total_items}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        ind.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                        ind.status === 'dispatched' ? 'bg-blue-100 text-blue-700' :
                        ind.status === 'approved' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {ind.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default RHPDashboard;
