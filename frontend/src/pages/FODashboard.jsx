import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { LogOut, MapPin, Navigation, Camera, Calendar, User, CheckCircle, ShieldAlert, Compass } from 'lucide-react';
import { API, SOCKET_URL } from '../api';

const FODashboard = () => {
  const [rhps, setRhps] = useState([]);
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
  const [interested, setInterested] = useState(false);
  const [feeCollected, setFeeCollected] = useState('0');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  
  // Photo Attachment
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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

  const fetchRhps = async () => {
    try {
      const res = await axios.get(`${API}/rhps`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRhps(res.data.data);
      }
    } catch (err) {
      console.error('Fetch RHPs error:', err);
    }
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
    formData.append('notes', `Discussion: ${discussion} | Interested: ${interested ? 'Yes' : 'No'} | Fees Collected: ${feeCollected} | Mode: ${paymentMode} | Receipt: ${receiptNumber}. ${notes}`);
    
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
        setInterested(false);
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

      {/* Primary Container */}
      <main className="max-w-xl mx-auto w-full px-4 mt-6 space-y-6">
        
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
                  checked={interested}
                  onChange={(e) => setInterested(e.target.checked)}
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

      </main>
    </div>
  );
};

export default FODashboard;
