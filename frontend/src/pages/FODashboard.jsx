import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import {
  LogOut, MapPin, Navigation, Camera, Calendar, User, CheckCircle, ShieldAlert, Compass,
  ClipboardList, Glasses, Send, Package, History, ExternalLink, FileText
} from 'lucide-react';
import { API, SOCKET_URL } from '../api';

const FODashboard = () => {
  const [activeTab, setActiveTab] = useState('visits');

  const [rhps, setRhps] = useState([]);
  const [rhpsError, setRhpsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Geolocation tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);

  // Form State
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetRhpId, setTargetRhpId] = useState('');
  const [purpose, setPurpose] = useState('routine');
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Custom visit audits items (Discussion, interest, fees)
  const [discussion, setDiscussion] = useState('');
  const [toolkitCheckClear, setToolkitCheckClear] = useState(false);
  const [feeCollected, setFeeCollected] = useState('0');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState('');

  // Photo Attachment
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // ── Eyeglass Distribution tab state ──
  const [colors, setColors] = useState([]);
  const [colorsError, setColorsError] = useState('');
  const [myInventory, setMyInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [distributions, setDistributions] = useState([]);
  const [distTotal, setDistTotal] = useState(0);
  const [distHistoryLoading, setDistHistoryLoading] = useState(false);

  const [distColorId, setDistColorId] = useState('');
  const [distQuantity, setDistQuantity] = useState('1');
  const [distPatientName, setDistPatientName] = useState('');
  const [distPatientPhone, setDistPatientPhone] = useState('');
  const [distPatientDetails, setDistPatientDetails] = useState('');
  const [distDate, setDistDate] = useState(new Date().toISOString().split('T')[0]);
  const [distNotes, setDistNotes] = useState('');
  const [distProof, setDistProof] = useState(null);
  const [distProofPreview, setDistProofPreview] = useState(null);
  const [distSubmitting, setDistSubmitting] = useState(false);
  const [distError, setDistError] = useState('');
  const [distSuccess, setDistSuccess] = useState('');

  // ── Field Reports tab state ──
  const [myVisits, setMyVisits] = useState([]);
  const [myVisitsLoading, setMyVisitsLoading] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [reportDrafts, setReportDrafts] = useState({});
  const [reportSubmittingId, setReportSubmittingId] = useState(null);
  const [reportError, setReportError] = useState('');

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    // Fetch RHPs for dropdown list
    fetchRhps();

    // Setup Socket connection for real-time geolocation tracking
    socketRef.current = io(SOCKET_URL, {
      auth: { token: `Bearer ${token}` }
    });

    return () => {
      stopLocalTracking();
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'distribution') {
      fetchColors();
      fetchMyInventory();
      fetchMyDistributions();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchMyVisits();
      fetchMyReports();
    }
  }, [activeTab]);

  const fetchRhps = async () => {
    try {
      const res = await axios.get(`${API}/rhps`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRhps(res.data.data);
        setRhpsError('');
      }
    } catch (err) {
      console.error('Fetch RHPs error:', err);
      setRhpsError('Unable to load RHP centers. Refresh to try again.');
    }
  };

  // ── Eyeglass Distribution fetchers ──
  const fetchColors = async () => {
    try {
      const res = await axios.get(`${API}/pd/eyeglass-colors`, authHeaders);
      if (res.data.success) { setColors(res.data.data); setColorsError(''); }
    } catch (err) {
      console.error('Fetch colors error:', err);
      setColorsError('Unable to load frame colors. Refresh to try again.');
    }
  };

  const fetchMyInventory = async () => {
    setInventoryLoading(true);
    try {
      const res = await axios.get(`${API}/pd/fo-allocations`, authHeaders);
      if (res.data.success) setMyInventory(res.data.data.allocations || []);
    } catch (err) { console.error('Fetch my inventory error:', err); }
    setInventoryLoading(false);
  };

  const fetchMyDistributions = async () => {
    setDistHistoryLoading(true);
    try {
      const res = await axios.get(`${API}/pd/distributions?limit=20`, authHeaders);
      if (res.data.success) { setDistributions(res.data.data); setDistTotal(res.data.total); }
    } catch (err) { console.error('Fetch my distributions error:', err); }
    setDistHistoryLoading(false);
  };

  // Proof photos are stored with authenticated (non-public) Cloudinary delivery —
  // fetch a short-lived signed URL rather than linking the raw stored URL directly.
  const viewProof = async (publicId) => {
    if (!publicId) { alert('No proof file available.'); return; }
    try {
      const res = await axios.get(`${API}/uploads/signed-url`, { ...authHeaders, params: { publicId } });
      if (res.data.success) window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('View proof error:', err);
      alert('Unable to load this file right now.');
    }
  };

  // ── Field Reports fetchers + submit ──
  const fetchMyVisits = async () => {
    setMyVisitsLoading(true);
    try {
      const res = await axios.get(`${API}/visits`, authHeaders);
      if (res.data.success) setMyVisits(res.data.data);
    } catch (err) { console.error('Fetch my visits error:', err); }
    setMyVisitsLoading(false);
  };

  const fetchMyReports = async () => {
    setMyReportsLoading(true);
    try {
      const res = await axios.get(`${API}/field-reports`, authHeaders);
      if (res.data.success) setMyReports(res.data.data);
    } catch (err) { console.error('Fetch my reports error:', err); }
    setMyReportsLoading(false);
  };

  const handleSubmitReport = async (visitId) => {
    const reportText = (reportDrafts[visitId] || '').trim();
    if (!reportText) return;

    setReportSubmittingId(visitId);
    setReportError('');
    try {
      const res = await axios.post(`${API}/field-reports`, { visitId, reportText }, authHeaders);
      if (res.data.success) {
        setReportDrafts(d => { const next = { ...d }; delete next[visitId]; return next; });
        fetchMyReports();
      }
    } catch (err) {
      console.error('Submit field report error:', err);
      setReportError(err.response?.data?.error || 'Unable to submit report.');
    }
    setReportSubmittingId(null);
  };

  const reportStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${styles[status] || styles.pending}`}>{status}</span>;
  };

  const getBalanceForColor = (colorId) => {
    const row = myInventory.find(i => i.color_id === parseInt(colorId));
    return row ? row.quantity : 0;
  };

  const handleDistProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDistProof(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setDistProofPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setDistProofPreview(null);
    }
  };

  const handleSubmitDistribution = async (e) => {
    e.preventDefault();
    setDistError('');
    setDistSuccess('');

    if (!distColorId) {
      setDistError('Please select a color.');
      return;
    }
    const qty = parseInt(distQuantity);
    if (!qty || qty <= 0) {
      setDistError('Enter a valid quantity.');
      return;
    }
    const available = getBalanceForColor(distColorId);
    if (qty > available) {
      setDistError(`You only have ${available} in stock for this color.`);
      return;
    }
    if (!distProof) {
      setDistError('Proof upload (patient photo, signed acknowledgment, or document) is mandatory before saving.');
      return;
    }

    setDistSubmitting(true);
    const formData = new FormData();
    formData.append('colorId', distColorId);
    formData.append('quantity', distQuantity);
    formData.append('patientName', distPatientName);
    formData.append('patientPhone', distPatientPhone);
    formData.append('patientDetails', distPatientDetails);
    formData.append('distributionDate', distDate);
    formData.append('notes', distNotes);
    formData.append('proof', distProof);

    try {
      const res = await axios.post(`${API}/pd/distributions`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setDistSuccess('Distribution recorded successfully!');
        setDistColorId('');
        setDistQuantity('1');
        setDistPatientName('');
        setDistPatientPhone('');
        setDistPatientDetails('');
        setDistNotes('');
        setDistProof(null);
        setDistProofPreview(null);
        fetchMyInventory();
        fetchMyDistributions();
        setTimeout(() => setDistSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Submit distribution error:', err);
      setDistError(err.response?.data?.error || 'Unable to record distribution.');
    }
    setDistSubmitting(false);
  };

  // Geolocation trigger coordinates capture
  const handleGpsAutofill = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGpsLoading(false);
      },
      (err) => {
        console.error('GPS autofill error:', err);
        setError('Unable to capture coordinates. Ensure GPS location permissions are granted.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle Live Shift Tracking
  const toggleTracking = () => {
    if (isTracking) {
      stopLocalTracking();
    } else {
      startLocalTracking();
    }
  };

  const startLocalTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this device.');
      return;
    }

    setIsTracking(true);

    // 1. Tell socket.io server that we started tracking
    socketRef.current.emit('fo_start_tracking');

    // 2. Start tracking loop: capture and emit coordinates every 60 seconds
    const sendLocation = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setCurrentCoords({ latitude, longitude });

      socketRef.current.emit('fo_location_update', {
        latitude,
        longitude,
        accuracy,
        batteryLevel: 90 // Default mockup battery
      });
    };

    // Immediate capture
    navigator.geolocation.getCurrentPosition(sendLocation, (err) => console.error(err), { enableHighAccuracy: true });

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => {
        console.error('Tracking watch error:', err);
      },
      { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }
    );
  };

  const stopLocalTracking = () => {
    setIsTracking(false);
    setCurrentCoords(null);

    // Stop position watcher
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Tell server to stop tracking
    if (socketRef.current) {
      socketRef.current.emit('fo_stop_tracking');
    }
  };

  const handleSubmitVisit = async (e) => {
    e.preventDefault();
    if (!targetRhpId) {
      setError('Please select the RHP you visited.');
      return;
    }
    if (!latitude || !longitude) {
      setError('GPS coordinates are required. Please use the auto-fill button.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('targetRhpId', targetRhpId);
    formData.append('visitDate', visitDate);
    formData.append('purpose', purpose);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('notes', `Discussion: ${discussion} | Toolkit Check Clear: ${toolkitCheckClear ? 'Yes' : 'No'} | Fees Collected: ${feeCollected} | Mode: ${paymentMode} | Receipt: ${receiptNumber}. ${notes}`);

    if (photo) {
      formData.append('photo', photo);
    }

    try {
      const res = await axios.post(`${API}/visits/log`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        setSuccess(true);
        // Reset form
        setNotes('');
        setDiscussion('');
        setToolkitCheckClear(false);
        setFeeCollected('0');
        setReceiptNumber('');
        setPhoto(null);
        setPhotoPreview(null);
        setLatitude('');
        setLongitude('');

        setTimeout(() => setSuccess(false), 3000);
      }
      setLoading(false);
    } catch (err) {
      console.error('Submit visit error:', err);
      setError(err.response?.data?.error || 'Unable to log visit.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    stopLocalTracking();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
            <Compass className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Field Officer Shift Logs</h1>
            <p className="text-[10px] text-slate-400">Bihar Vision Entrepreneur Program</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Tab Selectors */}
      <div className="bg-white border-b flex justify-center space-x-8 px-6">
        <button
          onClick={() => setActiveTab('visits')}
          className={`py-4 px-2 border-b-2 text-sm font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'visits'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Visit Logging</span>
        </button>
        <button
          onClick={() => setActiveTab('distribution')}
          className={`py-4 px-2 border-b-2 text-sm font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'distribution'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Glasses className="w-4 h-4" />
          <span>Eyeglass Distribution</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-4 px-2 border-b-2 text-sm font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'reports'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Field Reports</span>
        </button>
      </div>

      {/* Primary Container */}
      <main className="max-w-xl mx-auto w-full px-4 mt-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════ */}
        {/* TAB: VISIT LOGGING                                           */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'visits' && (
          <>
            {/* Tracking control panel card (FOTrackingButton) */}
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col items-center text-center">
              <div className={`p-4 rounded-full mb-3 ${isTracking ? 'bg-teal-50 text-teal-500 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                <Navigation className={`w-8 h-8 ${isTracking ? 'rotate-45 transition-transform' : ''}`} />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Shift Geolocation Tracking</h3>
              <p className="text-slate-400 text-xs mt-1 px-4 leading-normal">
                {isTracking
                  ? 'Tracking active. Coordinates stream to administrative monitors in real-time.'
                  : 'Toggle tracking to broadcast your location status while on field visits.'}
              </p>

              {currentCoords && (
                <div className="mt-3 px-3 py-1 bg-slate-50 border rounded-lg text-[10px] text-slate-500 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-500" />
                  <span>Current GPS: {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}</span>
                </div>
              )}

              <button
                onClick={toggleTracking}
                className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md mt-4 transition-all ${
                  isTracking
                    ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/15'
                    : 'bg-teal-500 text-slate-900 hover:bg-teal-600 shadow-teal-500/15'
                }`}
              >
                {isTracking ? 'Disable Live Tracking (Clock-out)' : 'Enable Live Tracking (Clock-in)'}
              </button>
            </div>

            {/* Visit log form */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 border-b pb-3 mb-6">Log Visit Record</h2>

              {success && (
                <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-start space-x-3 text-teal-700 text-sm">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-teal-600" />
                  <span>Visit sheet submitted successfully to databases!</span>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-700 text-sm">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmitVisit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Visit Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                    <Calendar className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">RHP Center Visited</label>
                  <div className="relative">
                    <select
                      required
                      value={targetRhpId}
                      onChange={(e) => setTargetRhpId(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm appearance-none"
                    >
                      <option value="">Select RHP center...</option>
                      {rhps.map(rhp => (
                        <option key={rhp.id} value={rhp.id}>{rhp.center_name} ({rhp.village})</option>
                      ))}
                    </select>
                    <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                  </div>
                  {rhpsError && <p className="mt-1.5 text-[11px] text-rose-500">{rhpsError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Visit Purpose</label>
                  <select
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  >
                    <option value="routine">Routine Check</option>
                    <option value="onboarding">Onboarding Audit</option>
                    <option value="training_audit">Training Audit</option>
                    <option value="inventory_delivery">Inventory Delivery</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* GPS Autofill coordinates */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">GPS Verification coordinates</label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="Latitude"
                      required
                      readOnly
                      value={latitude}
                      className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-slate-500 text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Longitude"
                      required
                      readOnly
                      value={longitude}
                      className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-slate-500 text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGpsAutofill}
                    disabled={gpsLoading}
                    className="w-full py-2.5 rounded-xl border border-teal-500 text-teal-600 hover:bg-teal-50 active:bg-teal-100 font-bold text-xs flex items-center justify-center space-x-2 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{gpsLoading ? 'Accessing satellite data...' : 'Auto-fill current GPS coordinates'}</span>
                  </button>
                </div>

                {/* Photo Attachment upload handler */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Verify photo proof (Multer + Cloudinary)</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer transition-all">
                      <Camera className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 font-semibold">Choose photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                    {photoPreview && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border shadow-inner relative flex-shrink-0 bg-slate-100">
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom inputs */}
                <div className="border-t pt-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Visit Audit Questionnaire</h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Discussion details</label>
                    <textarea
                      rows="2"
                      value={discussion}
                      onChange={(e) => setDiscussion(e.target.value)}
                      placeholder="Record summary of talk..."
                      className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    ></textarea>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-xl">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Toolkit Check Clear?</h4>
                      <p className="text-[10px] text-slate-400">RHP toolkit items are verified intact</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={toolkitCheckClear}
                      onChange={(e) => setToolkitCheckClear(e.target.checked)}
                      className="w-5 h-5 accent-teal-500 rounded"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cash Fee Collected (INR)</label>
                      <input
                        type="number"
                        value={feeCollected}
                        onChange={(e) => setFeeCollected(e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI / Online</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Receipt Number</label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="Receipt number (if any)"
                      className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-900 font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/10 flex items-center justify-center"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    'Submit Visit Report'
                  )}
                </button>
              </form>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* TAB: EYEGLASS DISTRIBUTION                                   */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'distribution' && (
          <>
            {distSuccess && (
              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-start space-x-3 text-teal-700 text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-teal-600" />
                <span>{distSuccess}</span>
              </div>
            )}
            {distError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-700 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-600" />
                <span>{distError}</span>
              </div>
            )}

            {/* My Eyeglass Inventory */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-teal-500" />
                  <h3 className="font-bold text-slate-800">My Eyeglass Inventory</h3>
                </div>
                <button onClick={fetchMyInventory} className="text-xs font-semibold text-teal-500 hover:text-teal-600">Refresh</button>
              </div>

              {inventoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : myInventory.filter(i => i.quantity > 0).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No eyeglasses currently allocated to you. Contact your Program Director.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {myInventory.filter(i => i.quantity > 0).map(item => (
                    <div key={item.color_id} className="p-3 rounded-xl border text-center" style={{ backgroundColor: `${item.hex_code}10` }}>
                      <div className="w-4 h-4 rounded-full mx-auto mb-2 border border-white shadow" style={{ backgroundColor: item.hex_code }}></div>
                      <p className="text-xs font-bold text-slate-700">{item.emoji} {item.color_name}</p>
                      <p className="text-xl font-black text-slate-900 mt-1">{item.quantity}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Distribute to Patient */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center space-x-2 border-b pb-3 mb-6">
                <Send className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">Distribute to Patient</h3>
              </div>

              <form onSubmit={handleSubmitDistribution} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Frame Color *</label>
                    <select
                      required
                      value={distColorId}
                      onChange={(e) => setDistColorId(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    >
                      <option value="">Select color...</option>
                      {colors.map(c => (
                        <option key={c.id} value={c.id} disabled={getBalanceForColor(c.id) <= 0}>
                          {c.emoji} {c.name} ({getBalanceForColor(c.id)} available)
                        </option>
                      ))}
                    </select>
                    {colorsError && <p className="mt-1 text-[11px] text-rose-500">{colorsError}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={distColorId ? getBalanceForColor(distColorId) : undefined}
                      value={distQuantity}
                      onChange={(e) => setDistQuantity(e.target.value)}
                      className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Distribution Date *</label>
                  <input
                    type="date"
                    required
                    value={distDate}
                    onChange={(e) => setDistDate(e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Patient Details (Optional)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Patient Name"
                      value={distPatientName}
                      onChange={(e) => setDistPatientName(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="Patient Phone"
                      value={distPatientPhone}
                      onChange={(e) => setDistPatientPhone(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Village / Additional details"
                    value={distPatientDetails}
                    onChange={(e) => setDistPatientDetails(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                {/* Mandatory proof upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Proof Upload <span className="text-rose-500">* Mandatory</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2">Patient photo wearing the glasses, signed acknowledgment, or distribution document.</p>
                  <div className="flex items-center space-x-4">
                    <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer transition-all">
                      <Camera className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 font-semibold">{distProof ? distProof.name : 'Choose photo or PDF'}</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleDistProofChange}
                        className="hidden"
                      />
                    </label>
                    {distProofPreview && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border shadow-inner relative flex-shrink-0 bg-slate-100">
                        <img src={distProofPreview} alt="Proof preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                  <textarea
                    rows="2"
                    value={distNotes}
                    onChange={(e) => setDistNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={distSubmitting || !distProof}
                  className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/10 flex items-center justify-center"
                >
                  {distSubmitting ? (
                    <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    'Record Distribution'
                  )}
                </button>
              </form>
            </div>

            {/* My Distribution History */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-teal-500" />
                  <h3 className="font-bold text-slate-800">My Distribution History</h3>
                  {distTotal > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">{distTotal}</span>}
                </div>
              </div>

              {distHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : distributions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No distributions recorded yet.</p>
              ) : (
                <div className="divide-y">
                  {distributions.map(d => (
                    <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.hex_code }}></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {d.emoji} {d.color_name} × {d.quantity} {d.patient_name ? `— ${d.patient_name}` : ''}
                          </p>
                          <p className="text-[10px] text-slate-400">{formatDate(d.distribution_date)}</p>
                        </div>
                      </div>
                      {d.proof_url && (
                        <button onClick={() => viewProof(d.proof_public_id)} className="flex-shrink-0 flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-xs font-semibold">
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Proof</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* TAB: FIELD REPORTS                                           */}
        {/* ════════════════════════════════════════════════════════════ */}
        {activeTab === 'reports' && (
          <>
            {reportError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-700 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-600" />
                <span>{reportError}</span>
              </div>
            )}

            {/* Visits awaiting a report */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5 text-teal-500" />
                  <h3 className="font-bold text-slate-800">Visits Awaiting a Report</h3>
                </div>
                <button onClick={() => { fetchMyVisits(); fetchMyReports(); }} className="text-xs font-semibold text-teal-500 hover:text-teal-600">Refresh</button>
              </div>

              {myVisitsLoading || myReportsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (() => {
                const reportedVisitIds = new Set(myReports.map(r => r.visit_id));
                const unreportedVisits = myVisits.filter(v => !reportedVisitIds.has(v.id));
                return unreportedVisits.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No pending visits — every logged visit already has a report.</p>
                ) : (
                  <div className="divide-y">
                    {unreportedVisits.map(v => (
                      <div key={v.id} className="py-4 space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{v.center_name || 'RHP Center'} — {formatDate(v.visit_date)}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{v.purpose ? v.purpose.replace('_', ' ') : ''}</p>
                        </div>
                        <textarea
                          rows="2"
                          value={reportDrafts[v.id] || ''}
                          onChange={(e) => setReportDrafts(d => ({ ...d, [v.id]: e.target.value }))}
                          placeholder="Summarize this visit for review..."
                          className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                        ></textarea>
                        <button
                          onClick={() => handleSubmitReport(v.id)}
                          disabled={!(reportDrafts[v.id] || '').trim() || reportSubmittingId === v.id}
                          className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold text-xs rounded-xl transition-all"
                        >
                          {reportSubmittingId === v.id ? 'Submitting...' : 'Submit Report'}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* My submitted reports */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="flex items-center space-x-2 border-b pb-3 mb-4">
                <FileText className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">My Submitted Reports</h3>
              </div>

              {myReportsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : myReports.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No reports submitted yet.</p>
              ) : (
                <div className="divide-y">
                  {myReports.map(r => (
                    <div key={r.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.rhp_center || 'RHP Center'} — {formatDate(r.visit_date)}</p>
                        {reportStatusBadge(r.status)}
                      </div>
                      <p className="text-xs text-slate-500">{r.report_text}</p>
                      {r.review_comments && (
                        <p className="text-[11px] text-slate-400 italic">Reviewer note: {r.review_comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
};

export default FODashboard;
