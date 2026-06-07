import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Eye, Sparkles, Box, Hammer, LogOut, AlertTriangle, MapPin, Activity } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlineFos, setOnlineFos] = useState({});
  const navigate = useNavigate();
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markers = useRef({});
  const socketRef = useRef(null);

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    // 1. Fetch static summary statistics
    fetchStats();

    // 2. Initialize Socket.io connection with JWT auth token
    socketRef.current = io('http://localhost:5000', {
      auth: { token: `Bearer ${token}` }
    });

    // Handle incoming live FO location updates
    socketRef.current.on('admin_location_update', (data) => {
      const { foId, firstName, lastName, latitude, longitude, accuracy, batteryLevel } = data;
      const name = `${firstName} ${lastName}`;
      
      setOnlineFos(prev => ({
        ...prev,
        [foId]: { name, latitude, longitude, accuracy, batteryLevel, lastUpdated: new Date() }
      }));

      updateMapMarker(foId, name, latitude, longitude, accuracy, batteryLevel);
    });

    // Handle online/offline status notifications
    socketRef.current.on('admin_fo_status', (data) => {
      const { foId, status } = data;
      if (status === 'offline') {
        // Remove marker from map
        if (markers.current[foId]) {
          markers.current[foId].remove();
          delete markers.current[foId];
        }
        setOnlineFos(prev => {
          const updated = { ...prev };
          delete updated[foId];
          return updated;
        });
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Initialize Map container once the DOM ref is ready
  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      // Coordinates centered on Bihar, India (Patna region)
      mapInstance.current = L.map(mapRef.current).setView([25.5941, 85.1376], 7.5);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      // Fix default Leaflet marker assets path
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });
      
      // Fetch initial active live locations
      fetchLiveLocations();
    }
  }, [mapRef.current]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/v1/dashboard/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setStats(res.data.data);
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch dashboard stats error:', err);
      setError('Unable to fetch dashboard overview metrics.');
      setLoading(false);
    }
  };

  const fetchLiveLocations = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/v1/visits/live', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.data) {
        const locations = res.data.data;
        locations.forEach(loc => {
          const name = `${loc.first_name} ${loc.last_name}`;
          setOnlineFos(prev => ({
            ...prev,
            [loc.fo_id]: { 
              name, 
              latitude: parseFloat(loc.latitude), 
              longitude: parseFloat(loc.longitude), 
              accuracy: parseFloat(loc.accuracy), 
              batteryLevel: loc.battery_level,
              lastUpdated: new Date(loc.last_updated) 
            }
          }));
          updateMapMarker(
            loc.fo_id, 
            name, 
            parseFloat(loc.latitude), 
            parseFloat(loc.longitude), 
            parseFloat(loc.accuracy), 
            loc.battery_level
          );
        });
      }
    } catch (err) {
      console.error('Fetch live locations error:', err);
    }
  };

  const updateMapMarker = (foId, name, lat, lng, accuracy, battery) => {
    if (!mapInstance.current) return;

    const popupHtml = `
      <div class="p-2 custom-map-popup text-xs leading-relaxed">
        <h4 class="font-bold text-slate-800 border-b pb-1 mb-1 flex items-center">
          <span class="w-2 h-2 rounded-full bg-teal-500 mr-2 animate-ping"></span>
          ${name}
        </h4>
        <p><b>Coordinates:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
        <p><b>Accuracy:</b> ${accuracy ? accuracy.toFixed(1) + ' m' : 'N/A'}</p>
        <p><b>Battery:</b> ${battery !== null ? battery + '%' : 'N/A'}</p>
        <p class="text-[10px] text-slate-400 mt-1">Last online: Just now</p>
      </div>
    `;

    if (markers.current[foId]) {
      markers.current[foId].setLatLng([lat, lng]);
      markers.current[foId].getPopup().setContent(popupHtml);
    } else {
      const customIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-teal.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapInstance.current)
        .bindPopup(popupHtml);
      
      markers.current[foId] = marker;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading administrative dashboard analytics...</p>
        </div>
      </div>
    );
  }

  const { rhpStats, screeningStats, dispensingStats, toolkitCounts } = stats || {};

  // Toolkit KPI calculation
  const totalKitsIssued = toolkitCounts?.issuedQuantity || 0;
  const totalKitsRemaining = toolkitCounts?.availableQuantity || 0;
  const isKitsStockLow = totalKitsRemaining <= 15;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">
      
      {/* Sidebar Panel */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 text-center">
            <span className="text-teal-400 font-extrabold text-2xl tracking-widest block">SAVIESS</span>
            <span className="text-slate-400 text-[10px] tracking-wider uppercase mt-1 block font-medium">VEP platform</span>
          </div>
          <nav className="p-4 space-y-1">
            <div className="flex items-center space-x-3 px-4 py-3 bg-slate-800/80 rounded-xl text-teal-400 font-semibold text-sm border-l-4 border-teal-500">
              <Activity className="w-5 h-5" />
              <span>Consolidated Stats</span>
            </div>
            <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-6">Logged Profile</div>
            <div className="px-4 py-2">
              <p className="text-sm font-semibold text-slate-200">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-slate-500 uppercase mt-0.5 tracking-wider font-semibold">{user.role}</p>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-rose-500/10 hover:text-rose-400 font-semibold text-sm transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
        
        {/* Header bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Program Director Control Panel</h1>
            <p className="text-slate-500 text-sm mt-1">Preheal, SAVIESS, and VisionSpring joint health logs</p>
          </div>
          <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-600">Database connected</span>
          </div>
        </div>

        {/* 6 KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          {/* Card 1: Total RHPs */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total RHPs</span>
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Users className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{rhpStats?.total || 0}</span>
            </div>
          </div>

          {/* Card 2: Active RHPs */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active RHPs</span>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><UserCheck className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{rhpStats?.active || 0}</span>
            </div>
          </div>

          {/* Card 3: Patients Screened */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Screenings</span>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Eye className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{screeningStats?.totalScreened || 0}</span>
            </div>
          </div>

          {/* Card 4: Glasses Sold */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Glasses Sold</span>
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Sparkles className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{dispensingStats?.totalGlassesSold || 0}</span>
            </div>
          </div>

          {/* Card 5: Toolkits Issued (Prominent styling) */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Kits Issued</span>
              <div className="p-2 bg-teal-50 rounded-lg text-teal-600"><Hammer className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{totalKitsIssued}</span>
            </div>
          </div>

          {/* Card 6: Toolkits remaining in warehouse (LOW stock warning) */}
          <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-all ${
            isKitsStockLow 
              ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' 
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isKitsStockLow ? 'text-rose-500' : 'text-slate-400'}`}>Warehouse Kits</span>
              <div className={`p-2 rounded-lg ${isKitsStockLow ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                {isKitsStockLow ? <AlertTriangle className="w-5 h-5" /> : <Box className="w-5 h-5" />}
              </div>
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-2xl font-black">{totalKitsRemaining}</span>
              {isKitsStockLow && <span className="text-[10px] font-bold text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded">LOW STOCK</span>}
            </div>
          </div>
        </div>

        {/* Real-time Location Map and online FOs panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Map Column */}
          <div className="xl:col-span-2 bg-white p-5 rounded-2xl border shadow-sm flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-teal-500" />
                <h3 className="font-bold text-slate-800">Field Officer Live Geolocation Map</h3>
              </div>
              <span className="text-xs text-slate-400">Updates dynamically</span>
            </div>
            <div className="flex-1 w-full relative bg-slate-100 rounded-xl overflow-hidden shadow-inner">
              <div ref={mapRef} className="absolute inset-0"></div>
            </div>
          </div>

          {/* Online FOs Column */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col h-[500px]">
            <div className="border-b pb-4 mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Active Tracking Officers ({Object.keys(onlineFos).length})</h3>
              <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping"></span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {Object.keys(onlineFos).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-xl border-slate-200">
                  <MapPin className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No field officers are currently active on shift tracking.</p>
                </div>
              ) : (
                Object.entries(onlineFos).map(([foId, fo]) => (
                  <div key={foId} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between hover:bg-slate-100/80 transition-all">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{fo.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Battery: {fo.batteryLevel}% | Accuracy: {fo.accuracy?.toFixed(0)}m</p>
                    </div>
                    <button 
                      onClick={() => {
                        if (mapInstance.current) {
                          mapInstance.current.setView([fo.latitude, fo.longitude], 13);
                          if (markers.current[foId]) markers.current[foId].openPopup();
                        }
                      }}
                      className="p-1.5 bg-white border hover:bg-teal-50 rounded-lg text-teal-600 transition-all shadow-sm"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recharts Diagrams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Bar Chart - District performance RHP Counts */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-6">District-wise RHP Counts & Performance</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.districtPerformance || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="districtName" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Bar dataKey="rhpCount" name="RHPs Enrolled" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalDispensed" name="Glasses Sold" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line Chart - Monthly Screening trends */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-6">Monthly Screenings Trends (last 12 months)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.monthlyScreenings || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Line type="monotone" dataKey="count" name="Patients Screened" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default AdminDashboard;
