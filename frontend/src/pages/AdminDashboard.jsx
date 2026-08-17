import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Eye, Sparkles, Box, Hammer, LogOut, AlertTriangle, MapPin, Activity, Search, Calendar, ClipboardList, Stethoscope, Glasses, FileText, ExternalLink, ChevronLeft, ChevronRight, UserPlus, X, CheckCircle, Copy, Shield, FileSpreadsheet, Download, Briefcase, Clock, TrendingUp, UserMinus, RefreshCw, ChevronDown, ChevronUp, Power, Edit3, History } from 'lucide-react';
import { API, SOCKET_URL } from '../api';

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

  // Data table state
  const [activeTab, setActiveTab] = useState('visits');
  const [tableData, setTableData] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // User management state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createRole, setCreateRole] = useState('field_officer');
  const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '', email: '', districtId: '', blockId: '', centerName: '', village: '', coverageArea: '' });
  const [districts, setDistricts] = useState([]);
  const [districtsError, setDistrictsError] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');

  // Active section state: 'stats' | 'createUser' | 'rhpApps' | 'fieldManagers'
  const [activeSection, setActiveSection] = useState('stats');

  // Field Managers management state
  const [fmList, setFmList] = useState([]);
  const [fmListLoading, setFmListLoading] = useState(false);
  const [fmDetail, setFmDetail] = useState(null);
  const [fmDetailLoading, setFmDetailLoading] = useState(false);
  const [fmVisits, setFmVisits] = useState([]);
  const [fmVisitsTotal, setFmVisitsTotal] = useState(0);
  const [fmVisitsPage, setFmVisitsPage] = useState(1);
  const [fmVisitsLoading, setFmVisitsLoading] = useState(false);
  const [fmVisitSearch, setFmVisitSearch] = useState('');
  const [fmVisitDateStart, setFmVisitDateStart] = useState('');
  const [fmVisitDateEnd, setFmVisitDateEnd] = useState('');
  const [fmVisitStatus, setFmVisitStatus] = useState('');
  const [fmVisitUserId, setFmVisitUserId] = useState(null);
  const [fmExpandedTeams, setFmExpandedTeams] = useState({});
  const [fmReassignFoId, setFmReassignFoId] = useState(null);
  const [fmReassignTargetId, setFmReassignTargetId] = useState('');

  // Edit Field Manager modal state
  const [showEditFm, setShowEditFm] = useState(false);
  const [editFmForm, setEditFmForm] = useState({ userId: null, firstName: '', lastName: '', phone: '', districtId: '', blockId: '', coverageArea: '' });
  const [editFmBlocks, setEditFmBlocks] = useState([]);
  const [editFmBlocksError, setEditFmBlocksError] = useState('');
  const [editFmSaving, setEditFmSaving] = useState(false);
  const [editFmError, setEditFmError] = useState('');
  const [availabilityUpdatingId, setAvailabilityUpdatingId] = useState(null);

  // RHP Applications management state
  const [rhpApps, setRhpApps] = useState([]);
  const [rhpAppsTotal, setRhpAppsTotal] = useState(0);
  const [rhpAppsPage, setRhpAppsPage] = useState(1);
  const [rhpAppsLoading, setRhpAppsLoading] = useState(false);
  const [rhpSearch, setRhpSearch] = useState('');
  const [rhpStatusFilter, setRhpStatusFilter] = useState('');
  const [rhpDistrictFilter, setRhpDistrictFilter] = useState('');
  const [rhpDateStart, setRhpDateStart] = useState('');
  const [rhpDateEnd, setRhpDateEnd] = useState('');
  const [viewApp, setViewApp] = useState(null);
  const [viewAppLoading, setViewAppLoading] = useState(false);

  // Central/Toolkit Inventory management state
  const [centralStock, setCentralStock] = useState([]);
  const [centralStockLoading, setCentralStockLoading] = useState(false);
  const [toolkitStock, setToolkitStock] = useState([]);
  const [toolkitStockLoading, setToolkitStockLoading] = useState(false);
  const [allRhps, setAllRhps] = useState([]);
  const [restockForm, setRestockForm] = useState({ itemName: '', sku: '', glassType: 'reading', leftPowerSph: '', rightPowerSph: '', quantity: '', unitPrice: '', supplierInfo: '' });
  const [restockLoading, setRestockLoading] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ rhpId: '', sku: '', quantity: '' });
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [toolkitForm, setToolkitForm] = useState({ itemName: '', sku: '', quantity: '', unitPrice: '', description: '' });
  const [toolkitFormLoading, setToolkitFormLoading] = useState(false);
  const [issueForm, setIssueForm] = useState({ rhpId: '', toolkitItemId: '', quantity: '1', issuedDate: new Date().toISOString().split('T')[0], conditionOnIssue: 'Good' });
  const [issueLoading, setIssueLoading] = useState(false);
  const [inventoryMsg, setInventoryMsg] = useState('');

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch districts on mount
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const res = await axios.get(`${API}/districts`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) { setDistricts(res.data.data); setDistrictsError(''); }
      } catch (err) {
        console.error('Load districts error:', err);
        setDistrictsError('Unable to load districts. Refresh to try again.');
      }
    };
    loadDistricts();
  }, []);

  // Fetch blocks when district changes
  useEffect(() => {
    if (!formData.districtId) { setBlocks([]); return; }
    const loadBlocks = async () => {
      try {
        const res = await axios.get(`${API}/blocks?districtId=${formData.districtId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setBlocks(res.data.data);
      } catch (err) { console.error('Load blocks error:', err); }
    };
    loadBlocks();
  }, [formData.districtId]);

  // Fetch blocks for the Edit Field Manager modal when its district changes
  useEffect(() => {
    if (!editFmForm.districtId) { setEditFmBlocks([]); return; }
    const loadBlocks = async () => {
      try {
        const res = await axios.get(`${API}/blocks?districtId=${editFmForm.districtId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) { setEditFmBlocks(res.data.data); setEditFmBlocksError(''); }
      } catch (err) {
        console.error('Load edit-FM blocks error:', err);
        setEditFmBlocksError('Unable to load blocks for this district.');
      }
    };
    loadBlocks();
  }, [editFmForm.districtId]);

  useEffect(() => {
    // 1. Fetch static summary statistics
    fetchStats();

    // 2. Initialize Socket.io connection with JWT auth token
    socketRef.current = io(SOCKET_URL, {
      auth: { token: `Bearer ${token}` },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000
    });

    socketRef.current.on('connect', () => {
      console.log('Admin socket connected, id:', socketRef.current.id);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Admin socket connection error:', err.message);
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

    // 3. Poll live locations every 30 seconds as a fallback in case socket events are missed
    const pollInterval = setInterval(() => {
      fetchLiveLocations();
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) socketRef.current.disconnect();
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Initialize Map using a callback ref for reliable DOM attachment
  // This avoids React StrictMode / conditional render timing issues
  const initMap = useCallback((node) => {
    // Store the ref for other code that reads mapRef.current
    mapRef.current = node;
    
    if (!node) {
      // Node unmounted — clean up the map
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markers.current = {};
      }
      return;
    }

    // Avoid double-init (StrictMode or rapid re-render)
    if (mapInstance.current) return;

    // Create the Leaflet map
    mapInstance.current = L.map(node).setView([22.5937, 78.9629], 5);
    
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

    // Force Leaflet to recalculate container size (fixes blank tiles on initial render)
    setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    }, 200);

    // Fetch initial active live locations
    fetchLiveLocations();
  }, []);

  // Fetch table data when tab, page, search, or date range changes
  const fetchTableData = useCallback(async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams({ page: tablePage, limit: 100 });
      if (searchTerm) params.append('search', searchTerm);
      if (dateStart) params.append('startDate', dateStart);
      if (dateEnd) params.append('endDate', dateEnd);

      const res = await axios.get(`${API}/dashboard/${activeTab}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setTableData(res.data.data);
        setTableTotal(res.data.total);
      }
    } catch (err) {
      console.error(`Fetch ${activeTab} error:`, err);
      setTableData([]);
      setTableTotal(0);
    }
    setTableLoading(false);
  }, [activeTab, tablePage, searchTerm, dateStart, dateEnd, token]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  // Reset page when tab or filters change
  useEffect(() => {
    setTablePage(1);
  }, [activeTab, searchTerm, dateStart, dateEnd]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/summary`, {
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
      const res = await axios.get(`${API}/visits/live`, {
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

  const formatDate = (d) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (d) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const availabilityStyles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
    inactive: 'bg-slate-100 text-slate-500 border-slate-200'
  };
  const availabilityLabels = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' };
  const getAvailabilityBadge = (status) => {
    const key = status || 'active';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${availabilityStyles[key] || availabilityStyles.active}`}>
        {availabilityLabels[key] || 'Active'}
      </span>
    );
  };

  const visitStatusStyles = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    missed: 'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200'
  };
  const getVisitStatusBadge = (status) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${visitStatusStyles[status] || visitStatusStyles.cancelled}`}>
      {status || 'unknown'}
    </span>
  );

  const totalPages = Math.ceil(tableTotal / 100) || 1;

  // Proof/document files are stored with authenticated (non-public) Cloudinary
  // delivery — fetch a short-lived signed URL on demand rather than linking
  // the raw stored URL directly.
  const viewProof = async (publicId, mimeType) => {
    if (!publicId) { alert('No proof file available.'); return; }
    try {
      const res = await axios.get(`${API}/uploads/signed-url`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { publicId, mimeType }
      });
      if (res.data.success) window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('View proof error:', err);
      alert('Unable to load this file right now.');
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'districtId') setFormData(prev => ({ ...prev, districtId: value, blockId: '' }));
  };

  const handlePincodeLookup = async (pincode) => {
    handleFormChange('pincode', pincode);
    setPincodeError('');
    if (pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return;
    setPincodeLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data[0].Status === 'Success') {
        const p = data[0].PostOffice[0];
        setFormData(prev => ({
          ...prev,
          pincode,
          area: p.Name,
          city: p.Division,
          district: p.District,
          state: p.State,
          block: '',
        }));
      } else {
        setPincodeError('Invalid pincode — no results found.');
        setFormData(prev => ({ ...prev, area: '', city: '', district: '', state: '', block: '' }));
      }
    } catch {
      setPincodeError('Pincode lookup failed. Check your connection.');
    }
    setPincodeLoading(false);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        email: formData.email || undefined,
        role: createRole,
      };
      payload.pincode = formData.pincode;
      payload.area = formData.area;
      payload.city = formData.city;
      payload.district = formData.district;
      payload.state = formData.state;
      payload.block = formData.block;
      payload.coverageArea = formData.coverageArea;
      const res = await axios.post(`${API}/auth/provision`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCreatedUser(res.data.data);
        setFormData({ firstName: '', lastName: '', phone: '', email: '', districtId: '', blockId: '', centerName: '', village: '', coverageArea: '' });
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create user');
    }
    setCreateLoading(false);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // ── RHP Applications Handlers ──
  const fetchRhpApps = useCallback(async () => {
    setRhpAppsLoading(true);
    try {
      const params = new URLSearchParams({ page: rhpAppsPage, limit: 20 });
      if (rhpSearch) params.append('search', rhpSearch);
      if (rhpStatusFilter) params.append('status', rhpStatusFilter);
      if (rhpDistrictFilter) params.append('districtId', rhpDistrictFilter);
      if (rhpDateStart) params.append('startDate', rhpDateStart);
      if (rhpDateEnd) params.append('endDate', rhpDateEnd);

      const res = await axios.get(`${API}/rhp?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRhpApps(res.data.data);
        setRhpAppsTotal(res.data.total);
      }
    } catch (err) {
      console.error('Fetch RHP applications error:', err);
      setRhpApps([]);
      setRhpAppsTotal(0);
    }
    setRhpAppsLoading(false);
  }, [rhpAppsPage, rhpSearch, rhpStatusFilter, rhpDistrictFilter, rhpDateStart, rhpDateEnd, token]);

  // Re-fetch RHP apps when filters/page change while on rhpApps section
  useEffect(() => {
    if (activeSection === 'rhpApps') fetchRhpApps();
  }, [fetchRhpApps, activeSection]);

  const handleViewApp = async (id) => {
    setViewAppLoading(true);
    try {
      const res = await axios.get(`${API}/rhp/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setViewApp(res.data.data);
    } catch (err) {
      console.error('View application error:', err);
    }
    setViewAppLoading(false);
  };

  const handleAppStatus = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status} this application?`)) return;
    try {
      const res = await axios.put(`${API}/rhp/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        if (res.data.createdUser) {
          alert(`Application approved! User created.\nEmail: ${res.data.createdUser.email}\nPassword: ${res.data.createdUser.defaultPassword}`);
        }
        fetchRhpApps();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteApp = async (id) => {
    if (!window.confirm('Delete this application permanently? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/rhp/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRhpApps();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete application');
    }
  };

  const handleRhpExport = async (format) => {
    try {
      const params = new URLSearchParams({ format });
      if (rhpSearch) params.append('search', rhpSearch);
      if (rhpStatusFilter) params.append('status', rhpStatusFilter);
      if (rhpDistrictFilter) params.append('districtId', rhpDistrictFilter);
      if (rhpDateStart) params.append('startDate', rhpDateStart);
      if (rhpDateEnd) params.append('endDate', rhpDateEnd);

      const res = await axios.get(`${API}/rhp/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const ext = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const mimeType = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                        format === 'csv' ? 'text/csv' : 'application/pdf';
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rhp_applications.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    }
  };

  // ── Field Managers Handlers ──
  const fetchFieldManagers = useCallback(async () => {
    setFmListLoading(true);
    try {
      const res = await axios.get(`${API}/dashboard/field-managers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setFmList(res.data.data);
    } catch (err) {
      console.error('Fetch field managers error:', err);
      setFmList([]);
    }
    setFmListLoading(false);
  }, [token]);

  const fetchFmDetail = async (userId) => {
    setFmDetailLoading(true);
    try {
      const res = await axios.get(`${API}/dashboard/field-managers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setFmDetail(res.data.data);
    } catch (err) {
      console.error('Fetch FM detail error:', err);
    }
    setFmDetailLoading(false);
  };

  const fetchFmVisitHistory = useCallback(async (userId) => {
    setFmVisitsLoading(true);
    try {
      const params = new URLSearchParams({ page: fmVisitsPage, limit: 20 });
      if (fmVisitSearch) params.append('search', fmVisitSearch);
      if (fmVisitDateStart) params.append('startDate', fmVisitDateStart);
      if (fmVisitDateEnd) params.append('endDate', fmVisitDateEnd);
      if (fmVisitStatus) params.append('status', fmVisitStatus);

      const res = await axios.get(`${API}/dashboard/field-managers/${userId}/visits?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setFmVisits(res.data.data);
        setFmVisitsTotal(res.data.total);
      }
    } catch (err) {
      console.error('Fetch FM visit history error:', err);
      setFmVisits([]);
      setFmVisitsTotal(0);
    }
    setFmVisitsLoading(false);
  }, [fmVisitsPage, fmVisitSearch, fmVisitDateStart, fmVisitDateEnd, fmVisitStatus, token]);

  useEffect(() => {
    if (fmVisitUserId) fetchFmVisitHistory(fmVisitUserId);
  }, [fetchFmVisitHistory, fmVisitUserId]);

  const handleToggleFmStatus = async (userId, currentlyActive) => {
    const action = currentlyActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this Field Manager?`)) return;
    try {
      await axios.put(`${API}/dashboard/field-managers/${userId}/status`,
        { isActive: !currentlyActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFieldManagers();
      if (fmDetail && fmDetail.profile.id === userId) fetchFmDetail(userId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleReassignFo = async () => {
    if (!fmReassignFoId || !fmReassignTargetId) return;
    if (!window.confirm('Are you sure you want to reassign this Field Officer?')) return;
    try {
      await axios.put(`${API}/dashboard/field-managers/reassign-fo`,
        { foId: fmReassignFoId, newManagerUserId: parseInt(fmReassignTargetId) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFmReassignFoId(null);
      setFmReassignTargetId('');
      if (fmDetail) fetchFmDetail(fmDetail.profile.id);
      fetchFieldManagers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reassign');
    }
  };

  // ── Central/Toolkit Inventory Handlers ──
  const fetchCentralInventory = async () => {
    setCentralStockLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/central`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setCentralStock(res.data.data);
    } catch (err) { console.error('Fetch central inventory error:', err); }
    setCentralStockLoading(false);
  };

  const fetchToolkitInventory = async () => {
    setToolkitStockLoading(true);
    try {
      const res = await axios.get(`${API}/inventory/toolkits`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setToolkitStock(res.data.data);
    } catch (err) { console.error('Fetch toolkit inventory error:', err); }
    setToolkitStockLoading(false);
  };

  const fetchAllRhps = async () => {
    try {
      const res = await axios.get(`${API}/rhps`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setAllRhps(res.data.data);
    } catch (err) { console.error('Fetch RHPs error:', err); }
  };

  const flashInventoryMsg = (msg) => { setInventoryMsg(msg); setTimeout(() => setInventoryMsg(''), 3000); };

  const handleRestockCentral = async (e) => {
    e.preventDefault();
    setRestockLoading(true);
    try {
      await axios.post(`${API}/inventory/central/restock`, restockForm, { headers: { Authorization: `Bearer ${token}` } });
      flashInventoryMsg('Central stock updated successfully');
      setRestockForm({ itemName: '', sku: '', glassType: 'reading', leftPowerSph: '', rightPowerSph: '', quantity: '', unitPrice: '', supplierInfo: '' });
      fetchCentralInventory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restock central inventory');
    }
    setRestockLoading(false);
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    setDispatchLoading(true);
    try {
      await axios.post(`${API}/inventory/dispatch`, dispatchForm, { headers: { Authorization: `Bearer ${token}` } });
      flashInventoryMsg('Dispatched to RHP successfully');
      setDispatchForm({ rhpId: '', sku: '', quantity: '' });
      fetchCentralInventory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to dispatch stock');
    }
    setDispatchLoading(false);
  };

  const handleRestockToolkit = async (e) => {
    e.preventDefault();
    setToolkitFormLoading(true);
    try {
      await axios.post(`${API}/inventory/toolkits/restock`, toolkitForm, { headers: { Authorization: `Bearer ${token}` } });
      flashInventoryMsg('Toolkit stock updated successfully');
      setToolkitForm({ itemName: '', sku: '', quantity: '', unitPrice: '', description: '' });
      fetchToolkitInventory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restock toolkits');
    }
    setToolkitFormLoading(false);
  };

  const handleIssueToolkit = async (e) => {
    e.preventDefault();
    setIssueLoading(true);
    try {
      await axios.post(`${API}/inventory/toolkits/issue`, issueForm, { headers: { Authorization: `Bearer ${token}` } });
      flashInventoryMsg('Toolkit issued to RHP successfully');
      setIssueForm({ rhpId: '', toolkitItemId: '', quantity: '1', issuedDate: new Date().toISOString().split('T')[0], conditionOnIssue: 'Good' });
      fetchToolkitInventory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to issue toolkit');
    }
    setIssueLoading(false);
  };

  const openEditFm = (fm) => {
    setEditFmError('');
    setEditFmForm({
      userId: fm.id,
      firstName: fm.first_name || '',
      lastName: fm.last_name || '',
      phone: fm.phone || '',
      districtId: fm.district_id || '',
      blockId: fm.block_id || '',
      coverageArea: fm.coverage_area || ''
    });
    setShowEditFm(true);
  };

  const handleSaveEditFm = async (e) => {
    e.preventDefault();
    setEditFmSaving(true);
    setEditFmError('');
    try {
      const { userId, ...payload } = editFmForm;
      await axios.put(`${API}/dashboard/field-managers/${userId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEditFm(false);
      fetchFieldManagers();
      if (fmDetail && fmDetail.profile.id === userId) fetchFmDetail(userId);
    } catch (err) {
      setEditFmError(err.response?.data?.error || 'Failed to update Field Manager details');
    }
    setEditFmSaving(false);
  };

  const handleUpdateAvailability = async (userId, availabilityStatus) => {
    setAvailabilityUpdatingId(userId);
    try {
      await axios.put(`${API}/dashboard/field-managers/${userId}/availability`,
        { availabilityStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFieldManagers();
      if (fmDetail && fmDetail.profile.id === userId) fetchFmDetail(userId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update availability status');
    }
    setAvailabilityUpdatingId(null);
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

  const tabs = [
    { key: 'visits', label: 'FO Visits', icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
    { key: 'patients', label: 'Patients', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { key: 'screenings', label: 'Screenings', icon: Stethoscope, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'dispensings', label: 'Dispensings', icon: Glasses, color: 'text-purple-600 bg-purple-50' },
  ];

  // Table column definitions per tab
  const renderTableHead = () => {
    switch (activeTab) {
      case 'visits':
        return (
          <tr>
            <th className="th-cell">Date</th>
            <th className="th-cell">Field Officer</th>
            <th className="th-cell">RHP Center</th>
            <th className="th-cell">Purpose</th>
            <th className="th-cell">GPS</th>
            <th className="th-cell">Status</th>
            <th className="th-cell">Notes</th>
            <th className="th-cell">Proof</th>
          </tr>
        );
      case 'patients':
        return (
          <tr>
            <th className="th-cell">Name</th>
            <th className="th-cell">Age</th>
            <th className="th-cell">Gender</th>
            <th className="th-cell">Phone</th>
            <th className="th-cell">Village</th>
            <th className="th-cell">District</th>
            <th className="th-cell">Block</th>
            <th className="th-cell">Registered By (RHP)</th>
            <th className="th-cell">Date</th>
          </tr>
        );
      case 'screenings':
        return (
          <tr>
            <th className="th-cell">Date</th>
            <th className="th-cell">Patient</th>
            <th className="th-cell">RHP</th>
            <th className="th-cell">VA (L/R)</th>
            <th className="th-cell">SPH (L/R)</th>
            <th className="th-cell">CYL (L/R)</th>
            <th className="th-cell">Type</th>
            <th className="th-cell">Referral</th>
          </tr>
        );
      case 'dispensings':
        return (
          <tr>
            <th className="th-cell">Date</th>
            <th className="th-cell">Patient</th>
            <th className="th-cell">RHP</th>
            <th className="th-cell">Glass Type</th>
            <th className="th-cell">SPH (L/R)</th>
            <th className="th-cell">Cost (₹)</th>
            <th className="th-cell">Paid (₹)</th>
            <th className="th-cell">Invoice</th>
          </tr>
        );
      default: return null;
    }
  };

  const renderTableRows = () => {
    if (tableData.length === 0) {
      return (
        <tr>
          <td colSpan="10" className="text-center py-16">
            <div className="flex flex-col items-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <p className="text-slate-400 text-sm font-medium">No records found</p>
              <p className="text-slate-300 text-xs">Try adjusting your search or date filters</p>
            </div>
          </td>
        </tr>
      );
    }

    switch (activeTab) {
      case 'visits':
        return tableData.map((row, i) => (
          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
            <td className="td-cell font-medium">{formatDate(row.visit_date)}</td>
            <td className="td-cell font-semibold text-slate-800">{row.fo_first} {row.fo_last}</td>
            <td className="td-cell">{row.rhp_center || <span className="text-slate-300">—</span>}</td>
            <td className="td-cell">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                {row.purpose?.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="td-cell text-[11px] text-slate-400">{parseFloat(row.latitude).toFixed(4)}, {parseFloat(row.longitude).toFixed(4)}</td>
            <td className="td-cell">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                row.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>{row.status}</span>
            </td>
            <td className="td-cell text-xs text-slate-500 max-w-[200px] truncate" title={row.notes}>{row.notes || '—'}</td>
            <td className="td-cell">
              {row.proof_image_url ? (
                <button onClick={() => viewProof(row.proof_public_id, row.proof_mime_type)} className="inline-flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-xs font-semibold">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>
              ) : <span className="text-slate-300 text-xs">—</span>}
            </td>
          </tr>
        ));
      case 'patients':
        return tableData.map((row, i) => (
          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
            <td className="td-cell font-semibold text-slate-800">{row.first_name} {row.last_name}</td>
            <td className="td-cell">{row.age}</td>
            <td className="td-cell">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                row.gender === 'male' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 
                row.gender === 'female' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}>{row.gender}</span>
            </td>
            <td className="td-cell text-xs">{row.phone || '—'}</td>
            <td className="td-cell">{row.village}</td>
            <td className="td-cell">{row.district_name}</td>
            <td className="td-cell">{row.block_name}</td>
            <td className="td-cell font-medium text-teal-700">{row.rhp_first} {row.rhp_last}<div className="text-[10px] text-slate-400">{row.rhp_center}</div></td>
            <td className="td-cell text-xs text-slate-400">{formatDate(row.created_at)}</td>
          </tr>
        ));
      case 'screenings':
        return tableData.map((row, i) => (
          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
            <td className="td-cell font-medium">{formatDate(row.screening_date)}</td>
            <td className="td-cell font-semibold text-slate-800">{row.patient_first} {row.patient_last}<div className="text-[10px] text-slate-400">{row.age}y / {row.gender}</div></td>
            <td className="td-cell font-medium text-teal-700">{row.rhp_first} {row.rhp_last}<div className="text-[10px] text-slate-400">{row.rhp_center}</div></td>
            <td className="td-cell text-xs">{row.visual_acuity_left} / {row.visual_acuity_right}</td>
            <td className="td-cell text-xs">{(row.spherical_left !== null && row.spherical_left !== undefined) ? parseFloat(row.spherical_left).toFixed(2) : '—'} / {(row.spherical_right !== null && row.spherical_right !== undefined) ? parseFloat(row.spherical_right).toFixed(2) : '—'}</td>
            <td className="td-cell text-xs">{(row.cylindrical_left !== null && row.cylindrical_left !== undefined) ? parseFloat(row.cylindrical_left).toFixed(2) : '—'} / {(row.cylindrical_right !== null && row.cylindrical_right !== undefined) ? parseFloat(row.cylindrical_right).toFixed(2) : '—'}</td>
            <td className="td-cell">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {row.screening_type?.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="td-cell">
              {row.referral_recommended ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Yes</span>
              ) : (
                <span className="text-slate-300 text-xs">No</span>
              )}
            </td>
          </tr>
        ));
      case 'dispensings':
        return tableData.map((row, i) => (
          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
            <td className="td-cell font-medium">{formatDate(row.dispensing_date)}</td>
            <td className="td-cell font-semibold text-slate-800">{row.patient_first} {row.patient_last}<div className="text-[10px] text-slate-400">{row.age}y / {row.gender}</div></td>
            <td className="td-cell font-medium text-teal-700">{row.rhp_first} {row.rhp_last}<div className="text-[10px] text-slate-400">{row.rhp_center}</div></td>
            <td className="td-cell">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                {row.glass_type?.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="td-cell text-xs">{(row.left_power_sph !== null && row.left_power_sph !== undefined) ? parseFloat(row.left_power_sph).toFixed(2) : '—'} / {(row.right_power_sph !== null && row.right_power_sph !== undefined) ? parseFloat(row.right_power_sph).toFixed(2) : '—'}</td>
            <td className="td-cell font-semibold">₹{parseFloat(row.cost).toFixed(0)}</td>
            <td className="td-cell font-semibold text-emerald-700">₹{parseFloat(row.amount_paid).toFixed(0)}</td>
            <td className="td-cell text-xs text-slate-500 font-mono">{row.invoice_number}</td>
          </tr>
        ));
      default: return null;
    }
  };

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
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${activeSection === 'stats' ? 'bg-slate-800/80 text-teal-400 border-l-4 border-teal-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`} onClick={() => { setActiveSection('stats'); setCreatedUser(null); }}>
              <Activity className="w-5 h-5" />
              <span>Consolidated Stats</span>
            </div>
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${activeSection === 'createUser' ? 'bg-teal-500/15 text-teal-400 border-l-4 border-teal-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`} onClick={() => { setActiveSection('createUser'); setCreatedUser(null); setCreateError(''); }}>
              <UserPlus className="w-5 h-5" />
              <span>Create User</span>
            </div>
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${activeSection === 'rhpApps' ? 'bg-indigo-500/15 text-indigo-400 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`} onClick={() => { setActiveSection('rhpApps'); fetchRhpApps(); }}>
              <FileSpreadsheet className="w-5 h-5" />
              <span>RHP Applications</span>
            </div>
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${activeSection === 'fieldManagers' ? 'bg-amber-500/15 text-amber-400 border-l-4 border-amber-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`} onClick={() => { setActiveSection('fieldManagers'); fetchFieldManagers(); }}>
              <Briefcase className="w-5 h-5" />
              <span>Field Managers</span>
            </div>
            <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${activeSection === 'inventory' ? 'bg-purple-500/15 text-purple-400 border-l-4 border-purple-500' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`} onClick={() => { setActiveSection('inventory'); fetchCentralInventory(); fetchToolkitInventory(); fetchAllRhps(); }}>
              <Box className="w-5 h-5" />
              <span>Inventory</span>
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

        {/* ================================================================ */}
        {/* CREATE USER PANEL                                                */}
        {/* ================================================================ */}
        {activeSection === 'createUser' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create New User</h1>
                <p className="text-slate-500 text-sm mt-1">Provision a Field Officer, Field Manager, or Program Director with full account and profile</p>
              </div>
              <button onClick={() => { setActiveSection('stats'); setCreatedUser(null); }} className="p-2 rounded-xl border hover:bg-slate-50 transition-all">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Success Card */}
            {createdUser && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-full"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                  <div>
                    <h3 className="font-bold text-emerald-900 text-lg">{createdUser.role === 'field_manager' ? 'Field Manager' : createdUser.role === 'program_director' ? 'Program Director' : 'Field Officer'} Created Successfully!</h3>
                    <p className="text-emerald-700 text-sm">{createdUser.firstName} {createdUser.lastName} can now log in</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Email</p><p className="text-sm font-semibold text-slate-800 font-mono">{createdUser.email}</p></div>
                    <button onClick={() => copyToClipboard(createdUser.email, 'email')} className="p-2 rounded-lg hover:bg-emerald-50 transition-all">
                      {copiedField === 'email' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  <div className="border-t border-emerald-100"></div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Password</p><p className="text-sm font-semibold text-slate-800 font-mono">{createdUser.defaultPassword}</p></div>
                    <button onClick={() => copyToClipboard(createdUser.defaultPassword, 'password')} className="p-2 rounded-lg hover:bg-emerald-50 transition-all">
                      {copiedField === 'password' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-600 flex items-center space-x-1"><Shield className="w-3.5 h-3.5" /><span>Share these credentials securely. User should change password on first login.</span></p>
                <button onClick={() => setCreatedUser(null)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all">Create Another User</button>
              </div>
            )}

            {/* Create User Form */}
            {!createdUser && (
              <form onSubmit={handleCreateUser} className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
                {createError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Role Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Account Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setCreateRole('field_officer')} className={`py-3.5 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center space-x-2 ${createRole === 'field_officer' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <MapPin className="w-4 h-4" /><span>Field Officer</span>
                    </button>
                    <button type="button" onClick={() => setCreateRole('field_manager')} className={`py-3.5 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center space-x-2 ${createRole === 'field_manager' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <Users className="w-4 h-4" /><span>Field Manager</span>
                    </button>
                    <button type="button" onClick={() => setCreateRole('program_director')} className={`py-3.5 rounded-xl font-bold text-sm border-2 transition-all flex items-center justify-center space-x-2 ${createRole === 'program_director' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                      <Shield className="w-4 h-4" /><span>Program Director</span>
                    </button>
                  </div>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name *</label>
                    <input type="text" required value={formData.firstName} onChange={e => handleFormChange('firstName', e.target.value)} placeholder="Ravi" className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name *</label>
                    <input type="text" required value={formData.lastName} onChange={e => handleFormChange('lastName', e.target.value)} placeholder="Kumar" className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                  </div>
                </div>

                {/* Phone + Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number *</label>
                    <input type="tel" required value={formData.phone} onChange={e => handleFormChange('phone', e.target.value)} placeholder="+919876543210" className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email <span className="text-slate-300">(auto-generated if blank)</span></label>
                    <input type="email" value={formData.email} onChange={e => handleFormChange('email', e.target.value)} placeholder="auto@saviess.org" className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                  </div>
                </div>

                {/* Location — pincode auto-fill for all roles */}
                  <div className="space-y-4 p-4 bg-teal-50/40 rounded-xl border border-teal-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pincode *</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={formData.pincode || ''}
                          onChange={e => handlePincodeLookup(e.target.value)}
                          placeholder="e.g. 800001"
                          className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm"
                        />
                        {pincodeLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {pincodeError && <p className="text-xs text-rose-500 mt-1">{pincodeError}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Area</label>
                        <input type="text" readOnly value={formData.area || ''} placeholder="Auto-filled" className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-sm text-slate-500 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City / Division</label>
                        <input type="text" readOnly value={formData.city || ''} placeholder="Auto-filled" className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-sm text-slate-500 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">District</label>
                        <input type="text" readOnly value={formData.district || ''} placeholder="Auto-filled" className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-sm text-slate-500 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">State</label>
                        <input type="text" readOnly value={formData.state || ''} placeholder="Auto-filled" className="w-full px-4 py-3 border rounded-xl bg-slate-100 text-sm text-slate-500 cursor-not-allowed" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Block</label>
                      <input
                        type="text"
                        value={formData.block || ''}
                        onChange={e => handleFormChange('block', e.target.value)}
                        placeholder="Type block name"
                        className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm"
                      />
                    </div>
                  </div>

                {/* Coverage Area (all roles) */}
                <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                  <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">Coverage Area</label>
                  <input type="text" value={formData.coverageArea} onChange={e => handleFormChange('coverageArea', e.target.value)} placeholder="Patna Sadar blocks coverage" className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm" />
                </div>

                {/* Info box */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 flex items-start space-x-2">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>A default password <strong>Saviess@[last 4 digits of phone]</strong> will be auto-generated. The credentials will be shown after creation.</span>
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className={`w-full py-3.5 font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 ${createRole === 'field_manager' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/15' : createRole === 'program_director' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/15' : 'bg-teal-500 hover:bg-teal-600 text-white shadow-teal-500/15'}`}
                >
                  {createLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <><UserPlus className="w-4 h-4" /><span>Create {createRole === 'field_manager' ? 'Field Manager' : createRole === 'program_director' ? 'Program Director' : 'Field Officer'} Account</span></>}
                </button>
              </form>
            )}
          </div>
        ) : activeSection === 'stats' ? (
        <>
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

          {/* Card 5: Toolkits Issued */}
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Kits Issued</span>
              <div className="p-2 bg-teal-50 rounded-lg text-teal-600"><Hammer className="w-5 h-5" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-900">{totalKitsIssued}</span>
            </div>
          </div>

          {/* Card 6: Toolkits remaining (LOW stock warning) */}
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
              <div ref={initMap} className="absolute inset-0"></div>
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

        {/* ================================================================== */}
        {/* DATA EXPLORER — Tabbed view of all FO & RHP records               */}
        {/* ================================================================== */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          
          {/* Section header */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Field Data Explorer</h2>
            <p className="text-slate-400 text-xs mt-1">Browse all records entered by Field Officers and Rural Health Providers</p>
          </div>

          {/* Tab Bar */}
          <div className="px-6 pt-4 flex flex-wrap gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20' 
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isActive && <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-bold">{tableTotal}</span>}
                </button>
              );
            })}
          </div>

          {/* Filters Row */}
          <div className="px-6 py-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, center, invoice..."
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 focus:bg-white text-sm transition-all"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                placeholder="From"
              />
              <span className="text-slate-300 text-xs">to</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                placeholder="To"
              />
            </div>
            {(searchTerm || dateStart || dateEnd) && (
              <button
                onClick={() => { setSearchTerm(''); setDateStart(''); setDateEnd(''); }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50 transition-all"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Data Table */}
          <div className="px-6 pb-4">
            <div className="overflow-x-auto rounded-xl border">
              {tableLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-xs mt-3">Loading records...</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead>
                    {renderTableHead()}
                  </thead>
                  <tbody>
                    {renderTableRows()}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 pb-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing <span className="font-semibold text-slate-600">{tableData.length}</span> of <span className="font-semibold text-slate-600">{tableTotal}</span> records
              {totalPages > 1 && <span> · Page {tablePage} of {totalPages}</span>}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(p => p - 1)}
                  className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={tablePage >= totalPages}
                  onClick={() => setTablePage(p => p + 1)}
                  className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        </>
        ) : activeSection === 'rhpApps' ? (
        <>
        {/* ================================================================ */}
        {/* RHP APPLICATIONS MANAGEMENT PANEL                                */}
        {/* ================================================================ */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">RHP Applications</h1>
              <p className="text-slate-500 text-sm mt-1">Review, approve, or reject RHP registration applications</p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleRhpExport('xlsx')} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold transition-all">
                <Download className="w-3.5 h-3.5" /><span>Excel</span>
              </button>
              <button onClick={() => handleRhpExport('csv')} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition-all">
                <Download className="w-3.5 h-3.5" /><span>CSV</span>
              </button>
              <button onClick={() => handleRhpExport('pdf')} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-bold transition-all">
                <Download className="w-3.5 h-3.5" /><span>PDF</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" placeholder="Search name, mobile, aadhaar, or app ID..."
                  value={rhpSearch} onChange={e => { setRhpSearch(e.target.value); setRhpAppsPage(1); }}
                  className="w-full pl-9 pr-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <select value={rhpStatusFilter} onChange={e => { setRhpStatusFilter(e.target.value); setRhpAppsPage(1); }}
                className="px-3 py-2.5 border rounded-xl bg-slate-50 text-sm focus:outline-none focus:border-indigo-500">
                <option value="">All Status</option>
                <option value="applied">Applied</option>
                <option value="under_review">Under Review</option>
                <option value="interviewed">Interviewed</option>
                <option value="training_scheduled">Training Scheduled</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={rhpDistrictFilter} onChange={e => { setRhpDistrictFilter(e.target.value); setRhpAppsPage(1); }}
                className="px-3 py-2.5 border rounded-xl bg-slate-50 text-sm focus:outline-none focus:border-indigo-500">
                <option value="">All Districts</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input type="date" value={rhpDateStart} onChange={e => { setRhpDateStart(e.target.value); setRhpAppsPage(1); }}
                placeholder="From date"
                className="px-3 py-2.5 border rounded-xl bg-slate-50 text-sm focus:outline-none focus:border-indigo-500" />
              <input type="date" value={rhpDateEnd} onChange={e => { setRhpDateEnd(e.target.value); setRhpAppsPage(1); }}
                placeholder="To date"
                className="px-3 py-2.5 border rounded-xl bg-slate-50 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            {districtsError && <p className="text-[11px] text-rose-500 mt-2">{districtsError}</p>}
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {rhpAppsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="th-cell">App ID</th>
                      <th className="th-cell">Full Name</th>
                      <th className="th-cell">Mobile</th>
                      <th className="th-cell">District</th>
                      <th className="th-cell">State</th>
                      <th className="th-cell">Exp (Yrs)</th>
                      <th className="th-cell">Status</th>
                      <th className="th-cell">Applied</th>
                      <th className="th-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rhpApps.length === 0 ? (
                      <tr><td colSpan="9" className="text-center py-16">
                        <div className="flex flex-col items-center space-y-3">
                          <FileSpreadsheet className="w-10 h-10 text-slate-300" />
                          <p className="text-slate-400 text-sm">No applications found</p>
                        </div>
                      </td></tr>
                    ) : rhpApps.map((app, i) => {
                      const statusColors = {
                        applied: 'bg-amber-50 text-amber-700 border-amber-200',
                        under_review: 'bg-blue-50 text-blue-700 border-blue-200',
                        interviewed: 'bg-violet-50 text-violet-700 border-violet-200',
                        training_scheduled: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                        approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        rejected: 'bg-rose-50 text-rose-700 border-rose-200',
                      };
                      return (
                        <tr key={app.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="td-cell font-mono text-xs text-indigo-600 font-bold">{app.application_code || `#${app.id}`}</td>
                          <td className="td-cell font-semibold text-slate-800">{app.full_name || `${app.first_name} ${app.last_name}`}</td>
                          <td className="td-cell text-xs">{app.phone || '—'}</td>
                          <td className="td-cell">{app.district_name || '—'}</td>
                          <td className="td-cell">{app.state || '—'}</td>
                          <td className="td-cell text-center">{app.years_of_experience || 0}</td>
                          <td className="td-cell">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[app.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              {app.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="td-cell text-xs">{formatDate(app.created_at)}</td>
                          <td className="td-cell">
                            <div className="flex items-center space-x-1">
                              <button onClick={() => handleViewApp(app.id)} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all">View</button>
                              {app.status !== 'approved' && (
                                <button onClick={() => handleAppStatus(app.id, 'approved')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all">Approve</button>
                              )}
                              {app.status !== 'rejected' && app.status !== 'approved' && (
                                <button onClick={() => handleAppStatus(app.id, 'rejected')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all">Reject</button>
                              )}
                              <button onClick={() => handleDeleteApp(app.id)} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all">Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {rhpAppsTotal > 20 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50">
                <span className="text-xs text-slate-500">Showing {(rhpAppsPage - 1) * 20 + 1}–{Math.min(rhpAppsPage * 20, rhpAppsTotal)} of {rhpAppsTotal}</span>
                <div className="flex items-center space-x-2">
                  <button disabled={rhpAppsPage <= 1} onClick={() => { setRhpAppsPage(p => p - 1); }} className="p-2 rounded-lg border hover:bg-white disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-xs font-bold text-slate-600">Page {rhpAppsPage}</span>
                  <button disabled={rhpAppsPage * 20 >= rhpAppsTotal} onClick={() => { setRhpAppsPage(p => p + 1); }} className="p-2 rounded-lg border hover:bg-white disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          {/* View Application Modal */}
          {viewApp && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-10 overflow-y-auto" onClick={() => setViewApp(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-10" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Application Details</h2>
                    <p className="text-sm text-indigo-600 font-mono font-bold mt-0.5">{viewApp.application_code || `#${viewApp.id}`}</p>
                  </div>
                  <button onClick={() => setViewApp(null)} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Full Name', viewApp.full_name || `${viewApp.first_name} ${viewApp.last_name}`],
                        ['Gender', viewApp.gender], ['Age', viewApp.age], ['DOB', formatDate(viewApp.date_of_birth)],
                        ['Mobile', viewApp.phone], ['Email', viewApp.email],
                        ['Aadhaar', viewApp.aadhaar_number], ['PAN', viewApp.pan_number]
                      ].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Professional */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Professional Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Qualification', viewApp.qualification], ['Reg Number', viewApp.registration_number],
                        ['Reg Authority', viewApp.registration_authority], ['Experience', `${viewApp.years_of_experience || 0} years`]
                      ].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Location */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Practice Location</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Clinic', viewApp.clinic_name], ['Village', viewApp.village], ['District', viewApp.district_name],
                        ['Block', viewApp.block_name], ['State', viewApp.state], ['PIN', viewApp.pin_code],
                        ['Address', viewApp.address]
                      ].map(([label, val]) => (
                        <div key={label} className={`bg-slate-50 rounded-xl p-3 ${label === 'Address' ? 'col-span-2 md:col-span-3' : ''}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Infrastructure */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Infrastructure</h3>
                    <div className="flex flex-wrap gap-2">
                      {[['Consultation', viewApp.has_consultation_space], ['Screening', viewApp.has_screening_space],
                        ['Electricity', viewApp.has_electricity], ['Smartphone', viewApp.has_smartphone], ['Internet', viewApp.has_internet]
                      ].map(([label, val]) => (
                        <span key={label} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${val ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                          {val ? '✓' : '✗'} {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Experience & Interest */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Experience & Interest</h3>
                    <div className="space-y-3">
                      {[['Health Camp Experience', viewApp.health_camp_experience], ['Eye Care Experience', viewApp.eye_care_experience],
                        ['Why Join', viewApp.why_join_reason]
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm text-slate-700 mt-1">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Financial & Bank */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Financial & Bank</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['Willing to Invest', viewApp.willing_to_invest ? 'Yes' : 'No'], ['Patients/Day', viewApp.patients_per_day],
                        ['Account Holder', viewApp.bank_account_holder], ['Bank', viewApp.bank_name],
                        ['Account No', viewApp.bank_account_number], ['IFSC', viewApp.bank_ifsc]
                      ].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Documents */}
                  {viewApp.documents && viewApp.documents.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Uploaded Documents</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {viewApp.documents.map((doc, i) => (
                          <button key={i} onClick={() => viewProof(doc.public_id, doc.mime_type)}
                            className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left w-full">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
                              <p className="text-[10px] text-slate-400 uppercase">{doc.document_type?.replace(/_/g, ' ')}</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t flex items-center justify-end space-x-3">
                  {viewApp.status !== 'approved' && (
                    <button onClick={() => { handleAppStatus(viewApp.id, 'approved'); setViewApp(null); }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all">Approve</button>
                  )}
                  {viewApp.status !== 'rejected' && viewApp.status !== 'approved' && (
                    <button onClick={() => { handleAppStatus(viewApp.id, 'rejected'); setViewApp(null); }}
                      className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition-all">Reject</button>
                  )}
                  <button onClick={() => setViewApp(null)} className="px-5 py-2.5 rounded-xl border hover:bg-slate-50 font-bold text-sm text-slate-500 transition-all">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
        ) : activeSection === 'fieldManagers' ? (
        <>
        {/* ================================================================ */}
        {/* FIELD MANAGERS MANAGEMENT PANEL                                  */}
        {/* ================================================================ */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Field Manager Overview</h1>
              <p className="text-slate-500 text-sm mt-1">Comprehensive view of all Field Managers, their teams, and performance metrics</p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={fetchFieldManagers} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-bold transition-all">
                <RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span>
              </button>
              <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">{fmList.length} Manager{fmList.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* FM Cards Grid */}
          {fmListLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fmList.length === 0 ? (
            <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No Field Managers found. Create one from the "Create User" section.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {fmList.map(fm => (
                <div key={fm.id} className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-all">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {fm.first_name?.[0]}{fm.last_name?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{fm.first_name} {fm.last_name}</h3>
                        <p className="text-[11px] text-slate-400">{fm.email}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{fm.employee_code || 'No Employee ID'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${fm.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {fm.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {getAvailabilityBadge(fm.availability_status)}
                    </div>
                  </div>

                  {/* Region */}
                  <div className="flex items-center space-x-1.5 mb-3 text-[11px] text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>{fm.district_name ? `${fm.district_name}${fm.block_name ? ', ' + fm.block_name : ''}` : 'No region assigned'}</span>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-slate-800">{fm.active_fo_count || 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active FOs</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-slate-800">{fm.team_count || 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Teams</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-slate-800">{fm.total_visits || 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Visits</p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 mb-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Phone</span>
                      <span className="text-slate-700 font-semibold">{fm.phone || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">RHP Coverage</span>
                      <span className="text-slate-700 font-semibold">{fm.rhp_coverage || 0} centers</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Completion Rate</span>
                      <span className="text-slate-700 font-semibold">{fm.total_visits > 0 ? Math.round((fm.completed_visits / fm.total_visits) * 100) : 0}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Last Visit</span>
                      <span className="text-slate-700 font-semibold">{fm.last_visit_date ? formatDate(fm.last_visit_date) : 'Never'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Last Login</span>
                      <span className="text-slate-700 font-semibold">{fm.last_login ? formatDate(fm.last_login) : 'Never'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button onClick={() => fetchFmDetail(fm.id)} className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all">View Profile</button>
                    <button onClick={() => { setFmVisitUserId(fm.id); setFmVisitsPage(1); setFmVisitSearch(''); setFmVisitDateStart(''); setFmVisitDateEnd(''); setFmVisitStatus(''); }} className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all">Visit History</button>
                    <button onClick={() => openEditFm(fm)} title="Edit details" className="px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggleFmStatus(fm.id, fm.is_active)} title={fm.is_active ? 'Deactivate account' : 'Activate account'} className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${fm.is_active ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FM DETAIL MODAL */}
        {fmDetail && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setFmDetail(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 mb-10" onClick={e => e.stopPropagation()}>
              {fmDetailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {fmDetail.profile.first_name?.[0]}{fmDetail.profile.last_name?.[0]}
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">{fmDetail.profile.first_name} {fmDetail.profile.last_name}</h2>
                      <p className="text-sm text-slate-500">{fmDetail.profile.email} · {fmDetail.profile.phone}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{fmDetail.profile.employee_code || 'No Employee ID'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${fmDetail.profile.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {fmDetail.profile.is_active ? 'Active Account' : 'Inactive Account'}
                        </span>
                        <select
                          value={fmDetail.profile.availability_status || 'active'}
                          disabled={availabilityUpdatingId === fmDetail.profile.id}
                          onChange={e => handleUpdateAvailability(fmDetail.profile.id, e.target.value)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer disabled:opacity-50 ${availabilityStyles[fmDetail.profile.availability_status] || availabilityStyles.active}`}
                        >
                          <option value="active">Active</option>
                          <option value="on_leave">On Leave</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => openEditFm(fmDetail.profile)} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border text-xs font-bold text-slate-600 transition-all">
                      <Edit3 className="w-3.5 h-3.5" /><span>Edit</span>
                    </button>
                    <button onClick={() => setFmDetail(null)} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                </div>

                <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                  {/* Region & Coverage */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Region & Coverage</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">District</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmDetail.profile.district_name || '—'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Block</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmDetail.profile.block_name || '—'}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 col-span-2 md:col-span-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Coverage Area</p>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmDetail.profile.coverage_area || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics Cards */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Performance Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        ['Total Visits', fmDetail.metrics?.visits?.total_visits || 0, 'bg-amber-50 text-amber-700'],
                        ['Completed', fmDetail.metrics?.visits?.completed || 0, 'bg-emerald-50 text-emerald-700'],
                        ['Pending', fmDetail.metrics?.visits?.pending || 0, 'bg-blue-50 text-blue-700'],
                        ['Missed', fmDetail.metrics?.visits?.missed || 0, 'bg-rose-50 text-rose-700'],
                        ['This Month', fmDetail.metrics?.visits?.this_month || 0, 'bg-purple-50 text-purple-700'],
                      ].map(([label, val, color]) => (
                        <div key={label} className={`${color} rounded-xl p-3 text-center`}>
                          <p className="text-2xl font-black">{val}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-slate-800">{fmDetail.metrics?.visits?.last_month || 0}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Last Month</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-slate-800">{fmDetail.metrics?.reports?.total_reports || 0}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Reports</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-slate-800">{fmDetail.metrics?.visits?.total_visits > 0 ? Math.round(((fmDetail.metrics?.visits?.completed || 0) / fmDetail.metrics?.visits?.total_visits) * 100) : 0}%</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Completion %</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[13px] font-black text-slate-800 leading-tight mt-1.5">{fmDetail.lastActivityAt ? formatDateTime(fmDetail.lastActivityAt) : 'No activity yet'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Last Activity</p>
                      </div>
                    </div>
                  </div>

                  {/* Field Officers Table */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assigned Field Officers ({fmDetail.fieldOfficers?.length || 0})</h3>
                    {fmDetail.fieldOfficers?.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No Field Officers assigned</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm text-left">
                          <thead><tr>
                            <th className="th-cell">Name</th>
                            <th className="th-cell">Phone</th>
                            <th className="th-cell">District</th>
                            <th className="th-cell">Block</th>
                            <th className="th-cell">Status</th>
                            <th className="th-cell">Actions</th>
                          </tr></thead>
                          <tbody>
                            {fmDetail.fieldOfficers.map((fo, i) => (
                              <tr key={fo.fo_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="td-cell font-semibold text-slate-800">{fo.first_name} {fo.last_name}</td>
                                <td className="td-cell text-xs">{fo.phone}</td>
                                <td className="td-cell">{fo.district_name}</td>
                                <td className="td-cell">{fo.block_name}</td>
                                <td className="td-cell">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${fo.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{fo.status}</span>
                                </td>
                                <td className="td-cell">
                                  {fmReassignFoId === fo.fo_id ? (
                                    <div className="flex items-center space-x-1">
                                      <select value={fmReassignTargetId} onChange={e => setFmReassignTargetId(e.target.value)} className="px-2 py-1 border rounded-lg text-[11px] bg-white">
                                        <option value="">Select FM</option>
                                        {fmList.filter(m => m.id !== fmDetail.profile.id).map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                                      </select>
                                      <button onClick={handleReassignFo} disabled={!fmReassignTargetId} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 disabled:opacity-40 transition-all">Go</button>
                                      <button onClick={() => { setFmReassignFoId(null); setFmReassignTargetId(''); }} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">×</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setFmReassignFoId(fo.fo_id)} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">Reassign</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Teams */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Teams ({fmDetail.teams?.length || 0})</h3>
                    {fmDetail.teams?.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No teams created</p>
                    ) : (
                      <div className="space-y-2">
                        {fmDetail.teams.map(team => (
                          <div key={team.id} className="bg-slate-50 rounded-xl border">
                            <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setFmExpandedTeams(prev => ({ ...prev, [team.id]: !prev[team.id] }))}>
                              <div className="flex items-center space-x-3">
                                <Users className="w-4 h-4 text-amber-500" />
                                <span className="font-bold text-slate-800 text-sm">{team.name}</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">{team.member_count} members</span>
                              </div>
                              {fmExpandedTeams[team.id] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                            {fmExpandedTeams[team.id] && team.members && (
                              <div className="px-3 pb-3 space-y-1">
                                {team.members.map(m => (
                                  <div key={m.fo_id} className="flex items-center justify-between bg-white rounded-lg p-2 text-xs">
                                    <span className="font-semibold text-slate-700">{m.first_name} {m.last_name}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${m.fo_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{m.fo_status}</span>
                                  </div>
                                ))}
                                {team.members.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No members</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RHPs in territory */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">RHPs Assigned to Team ({fmDetail.rhps?.length || 0})</h3>
                    <p className="text-[10px] text-slate-400 mb-3">Derived from RHP centers this team's Field Officers have visited</p>
                    {fmDetail.rhps?.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No RHP visits recorded</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {fmDetail.rhps.map(rhp => (
                          <div key={rhp.id} className="bg-slate-50 rounded-xl p-3 border">
                            <p className="font-bold text-slate-800 text-sm">{rhp.center_name || 'Unnamed Center'}</p>
                            <p className="text-[11px] text-slate-500">{rhp.rhp_first} {rhp.rhp_last} · {rhp.village}</p>
                            <p className="text-[10px] text-slate-400">{rhp.district_name}, {rhp.block_name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Live Locations */}
                  {fmDetail.liveLocations?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live FO Locations ({fmDetail.liveLocations.length})</h3>
                      <div className="space-y-2">
                        {fmDetail.liveLocations.map(loc => (
                          <div key={loc.fo_id} className="flex items-center justify-between bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span className="font-bold text-emerald-800 text-sm">{loc.first_name} {loc.last_name}</span>
                            </div>
                            <span className="text-[11px] text-emerald-600">{parseFloat(loc.latitude).toFixed(4)}, {parseFloat(loc.longitude).toFixed(4)} · Battery: {loc.battery_level}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity Timeline */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Activity (Team Visits)</h3>
                    {fmDetail.recentActivity?.length === 0 ? (
                      <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No recent activity</p>
                    ) : (
                      <div className="space-y-2">
                        {fmDetail.recentActivity?.map(act => (
                          <div key={act.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-xl border">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${act.status === 'completed' ? 'bg-emerald-500' : act.status === 'planned' ? 'bg-blue-500' : act.status === 'missed' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800">
                                {act.fo_first} {act.fo_last}
                                {act.rhp_center && <span className="text-slate-400 font-normal"> → {act.rhp_center}</span>}
                              </p>
                              <p className="text-[11px] text-slate-500">{act.purpose?.replace(/_/g, ' ')} · {formatDate(act.visit_date)}</p>
                              {act.notes && <p className="text-[11px] text-slate-400 truncate mt-0.5">{act.notes}</p>}
                            </div>
                            {getVisitStatusBadge(act.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Admin Actions (lightweight audit trail) */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Admin Actions</h3>
                    {fmDetail.recentAdminActions?.length === 0 || !fmDetail.recentAdminActions ? (
                      <p className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No recorded actions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {fmDetail.recentAdminActions.map((act, i) => (
                          <div key={i} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border">
                            <History className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <p className="flex-1 text-sm text-slate-700">{act.description}</p>
                            <span className="text-[11px] text-slate-400 flex-shrink-0">{formatDateTime(act.action_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Personal Details */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Account Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[['User ID', fmDetail.profile.id], ['Employee ID', fmDetail.profile.employee_code], ['Email', fmDetail.profile.email], ['Phone', fmDetail.profile.phone],
                        ['Created', formatDate(fmDetail.profile.created_at)], ['Last Login', fmDetail.profile.last_login ? formatDateTime(fmDetail.profile.last_login) : 'Never'],
                        ['Role', 'Field Manager']
                      ].map(([label, val]) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5">{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t flex items-center justify-between">
                  <button onClick={() => handleToggleFmStatus(fmDetail.profile.id, fmDetail.profile.is_active)} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${fmDetail.profile.is_active ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}>
                    {fmDetail.profile.is_active ? 'Deactivate Account' : 'Activate Account'}
                  </button>
                  <button onClick={() => { setFmVisitUserId(fmDetail.profile.id); setFmVisitsPage(1); setFmDetail(null); }} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-all">View Full Visit History</button>
                </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* FM VISIT HISTORY MODAL */}
        {fmVisitUserId && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-6 overflow-y-auto" onClick={() => { setFmVisitUserId(null); setFmVisits([]); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 mb-10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">Visit History</h2>
                  <p className="text-sm text-slate-500">All visits by Field Officers under this manager</p>
                </div>
                <button onClick={() => { setFmVisitUserId(null); setFmVisits([]); }} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 flex flex-wrap gap-3 border-b bg-slate-50/50">
                <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Search FO or RHP center..." value={fmVisitSearch}
                    onChange={e => { setFmVisitSearch(e.target.value); setFmVisitsPage(1); }}
                    className="w-full pl-9 pr-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-amber-500 text-sm" />
                </div>
                <select value={fmVisitStatus} onChange={e => { setFmVisitStatus(e.target.value); setFmVisitsPage(1); }}
                  className="px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:border-amber-500">
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="planned">Pending</option>
                  <option value="missed">Missed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={fmVisitDateStart} onChange={e => { setFmVisitDateStart(e.target.value); setFmVisitsPage(1); }}
                  className="px-3 py-2.5 border rounded-xl bg-white text-sm" />
                <input type="date" value={fmVisitDateEnd} onChange={e => { setFmVisitDateEnd(e.target.value); setFmVisitsPage(1); }}
                  className="px-3 py-2.5 border rounded-xl bg-white text-sm" />
              </div>

              {/* Visit Table */}
              <div className="p-6">
                {fmVisitsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm text-left">
                      <thead><tr>
                        <th className="th-cell">Date</th>
                        <th className="th-cell">Field Officer</th>
                        <th className="th-cell">RHP Center</th>
                        <th className="th-cell">Purpose</th>
                        <th className="th-cell">Status</th>
                        <th className="th-cell">GPS</th>
                        <th className="th-cell">Notes</th>
                        <th className="th-cell">Proof</th>
                      </tr></thead>
                      <tbody>
                        {fmVisits.length === 0 ? (
                          <tr><td colSpan="8" className="text-center py-16">
                            <div className="flex flex-col items-center space-y-3">
                              <ClipboardList className="w-10 h-10 text-slate-300" />
                              <p className="text-slate-400 text-sm">No visits found</p>
                            </div>
                          </td></tr>
                        ) : fmVisits.map((row, i) => (
                          <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="td-cell font-medium">{formatDate(row.visit_date)}</td>
                            <td className="td-cell font-semibold text-slate-800">{row.fo_first} {row.fo_last}</td>
                            <td className="td-cell">{row.rhp_center || <span className="text-slate-300">—</span>}</td>
                            <td className="td-cell"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">{row.purpose?.replace(/_/g, ' ')}</span></td>
                            <td className="td-cell">{getVisitStatusBadge(row.status)}</td>
                            <td className="td-cell text-[11px] text-slate-400">{row.latitude ? `${parseFloat(row.latitude).toFixed(4)}, ${parseFloat(row.longitude).toFixed(4)}` : '—'}</td>
                            <td className="td-cell text-xs text-slate-500 max-w-[200px] truncate" title={row.notes}>{row.notes || '—'}</td>
                            <td className="td-cell">{row.proof_image_url ? (
                              <button onClick={() => viewProof(row.proof_public_id, row.proof_mime_type)} className="inline-flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-xs font-semibold"><ExternalLink className="w-3.5 h-3.5" /><span>View</span></button>
                            ) : <span className="text-slate-300 text-xs">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {fmVisitsTotal > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50">
                  <span className="text-xs text-slate-500">Showing {(fmVisitsPage - 1) * 20 + 1}–{Math.min(fmVisitsPage * 20, fmVisitsTotal)} of {fmVisitsTotal}</span>
                  <div className="flex items-center space-x-2">
                    <button disabled={fmVisitsPage <= 1} onClick={() => setFmVisitsPage(p => p - 1)} className="p-2 rounded-lg border hover:bg-white disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-xs font-bold text-slate-600">Page {fmVisitsPage}</span>
                    <button disabled={fmVisitsPage * 20 >= fmVisitsTotal} onClick={() => setFmVisitsPage(p => p + 1)} className="p-2 rounded-lg border hover:bg-white disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDIT FIELD MANAGER MODAL */}
        {showEditFm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowEditFm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-lg font-extrabold text-slate-900">Edit Field Manager Details</h2>
                <button onClick={() => setShowEditFm(false)} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={handleSaveEditFm} className="p-6 space-y-4">
                {editFmError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{editFmError}</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                    <input required value={editFmForm.firstName} onChange={e => setEditFmForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                    <input required value={editFmForm.lastName} onChange={e => setEditFmForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                  <input required value={editFmForm.phone} onChange={e => setEditFmForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">District</label>
                    <select value={editFmForm.districtId} onChange={e => setEditFmForm(f => ({ ...f, districtId: e.target.value, blockId: '' }))}
                      className="w-full px-4 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-amber-500 text-sm">
                      <option value="">Select district</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Block</label>
                    <select value={editFmForm.blockId} onChange={e => setEditFmForm(f => ({ ...f, blockId: e.target.value }))} disabled={!editFmForm.districtId}
                      className="w-full px-4 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-amber-500 text-sm">
                      <option value="">Select block</option>
                      {editFmBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {editFmBlocksError && <p className="text-[11px] text-rose-500 mt-1">{editFmBlocksError}</p>}
                  </div>
                </div>
                {districtsError && <p className="text-[11px] text-rose-500 -mt-2">{districtsError}</p>}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Coverage Area</label>
                  <textarea rows={2} value={editFmForm.coverageArea} onChange={e => setEditFmForm(f => ({ ...f, coverageArea: e.target.value }))}
                    placeholder="e.g. North Patna Rural blocks"
                    className="w-full px-4 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm resize-none" />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={() => setShowEditFm(false)} className="flex-1 py-3 border rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" disabled={editFmSaving} className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                    {editFmSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </>
        ) : activeSection === 'inventory' ? (
        <>
        {/* ================================================================ */}
        {/* CENTRAL / TOOLKIT INVENTORY PANEL                                */}
        {/* ================================================================ */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Inventory Management</h1>
              <p className="text-slate-500 text-sm mt-1">Central warehouse stock, toolkits, and RHP dispatch</p>
            </div>
            <button onClick={() => { fetchCentralInventory(); fetchToolkitInventory(); fetchAllRhps(); }} className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-bold transition-all">
              <RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span>
            </button>
          </div>

          {inventoryMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /><span>{inventoryMsg}</span>
            </div>
          )}

          {/* Central Warehouse Stock */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-5 border-b flex items-center space-x-2">
                <Box className="w-5 h-5 text-purple-500" />
                <h2 className="font-bold text-slate-800">Central Warehouse Stock</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">{centralStock.length} SKU{centralStock.length !== 1 ? 's' : ''}</span>
              </div>
              {centralStockLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : centralStock.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">No central stock records yet. Use the restock form to add the first SKU.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th-cell">Item</th>
                        <th className="th-cell">SKU</th>
                        <th className="th-cell">Type</th>
                        <th className="th-cell">Powers (L/R)</th>
                        <th className="th-cell">Qty</th>
                        <th className="th-cell">Safety Level</th>
                        <th className="th-cell">Unit Price</th>
                        <th className="th-cell">Supplier</th>
                        <th className="th-cell">Last Restocked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {centralStock.map(item => {
                        const lowStock = item.quantity <= item.safety_stock_level;
                        return (
                          <tr key={item.id} className={lowStock ? 'bg-rose-50/60' : ''}>
                            <td className="td-cell font-semibold text-slate-800">{item.item_name}</td>
                            <td className="td-cell font-mono text-xs text-slate-500">{item.sku}</td>
                            <td className="td-cell capitalize">{item.glass_type.replace('_', ' ')}</td>
                            <td className="td-cell text-xs text-slate-500">{item.left_power_sph ?? '—'} / {item.right_power_sph ?? '—'}</td>
                            <td className={`td-cell font-bold ${lowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                              {item.quantity}
                              {lowStock && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold uppercase">Low</span>}
                            </td>
                            <td className="td-cell text-slate-500">{item.safety_stock_level}</td>
                            <td className="td-cell text-slate-500">₹{Number(item.unit_price).toFixed(2)}</td>
                            <td className="td-cell text-slate-500">{item.supplier_info || '—'}</td>
                            <td className="td-cell text-slate-500 text-xs">{item.last_restocked_at ? new Date(item.last_restocked_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Restock + Dispatch forms */}
            <div className="space-y-5">
              <form onSubmit={handleRestockCentral} className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2"><Box className="w-4 h-4 text-purple-500" /><span>Restock Central Warehouse</span></h3>
                <input type="text" required placeholder="Item name" value={restockForm.itemName} onChange={e => setRestockForm(f => ({ ...f, itemName: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                <input type="text" required placeholder="SKU" value={restockForm.sku} onChange={e => setRestockForm(f => ({ ...f, sku: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm font-mono" />
                <select value={restockForm.glassType} onChange={e => setRestockForm(f => ({ ...f, glassType: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm">
                  <option value="reading">Reading</option>
                  <option value="bifocal">Bifocal</option>
                  <option value="single_vision">Single Vision</option>
                  <option value="frame">Frame</option>
                  <option value="other">Other</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.25" placeholder="Left SPH" value={restockForm.leftPowerSph} onChange={e => setRestockForm(f => ({ ...f, leftPowerSph: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                  <input type="number" step="0.25" placeholder="Right SPH" value={restockForm.rightPowerSph} onChange={e => setRestockForm(f => ({ ...f, rightPowerSph: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="1" required placeholder="Quantity" value={restockForm.quantity} onChange={e => setRestockForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                  <input type="number" min="0" step="0.01" required placeholder="Unit price" value={restockForm.unitPrice} onChange={e => setRestockForm(f => ({ ...f, unitPrice: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                </div>
                <input type="text" placeholder="Supplier info (optional)" value={restockForm.supplierInfo} onChange={e => setRestockForm(f => ({ ...f, supplierInfo: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-purple-500 text-sm" />
                <button type="submit" disabled={restockLoading} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                  {restockLoading ? 'Saving...' : 'Add / Restock'}
                </button>
              </form>

              <form onSubmit={handleDispatch} className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2"><TrendingUp className="w-4 h-4 text-teal-500" /><span>Dispatch to RHP</span></h3>
                <select required value={dispatchForm.rhpId} onChange={e => setDispatchForm(f => ({ ...f, rhpId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm">
                  <option value="">Select RHP center</option>
                  {allRhps.map(r => <option key={r.id} value={r.id}>{r.center_name} — {r.first_name} {r.last_name}</option>)}
                </select>
                <select required value={dispatchForm.sku} onChange={e => setDispatchForm(f => ({ ...f, sku: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm font-mono">
                  <option value="">Select SKU</option>
                  {centralStock.map(item => <option key={item.id} value={item.sku}>{item.sku} ({item.quantity} in stock)</option>)}
                </select>
                <input type="number" min="1" required placeholder="Quantity" value={dispatchForm.quantity} onChange={e => setDispatchForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                <button type="submit" disabled={dispatchLoading} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                  {dispatchLoading ? 'Dispatching...' : 'Dispatch Stock'}
                </button>
              </form>
            </div>
          </div>

          {/* Toolkit Inventory */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-5 border-b flex items-center space-x-2">
                <Hammer className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-800">Toolkit Inventory</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">{toolkitStock.length} item{toolkitStock.length !== 1 ? 's' : ''}</span>
              </div>
              {toolkitStockLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : toolkitStock.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">No toolkit catalog items yet. Use the restock form to add the first one.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th-cell">Item</th>
                        <th className="th-cell">SKU</th>
                        <th className="th-cell">Total</th>
                        <th className="th-cell">Available</th>
                        <th className="th-cell">Unit Price</th>
                        <th className="th-cell">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {toolkitStock.map(item => (
                        <tr key={item.id} className={item.lowStock ? 'bg-rose-50/60' : ''}>
                          <td className="td-cell font-semibold text-slate-800">{item.item_name}</td>
                          <td className="td-cell font-mono text-xs text-slate-500">{item.sku}</td>
                          <td className="td-cell text-slate-500">{item.total_quantity}</td>
                          <td className={`td-cell font-bold ${item.lowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                            {item.available_quantity}
                            {item.lowStock && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold uppercase">Low</span>}
                          </td>
                          <td className="td-cell text-slate-500">₹{Number(item.unit_price).toFixed(2)}</td>
                          <td className="td-cell text-slate-500 text-xs">{item.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Restock toolkit + Issue-to-RHP forms */}
            <div className="space-y-5">
              <form onSubmit={handleRestockToolkit} className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2"><Hammer className="w-4 h-4 text-amber-500" /><span>Restock Toolkits</span></h3>
                <input type="text" required placeholder="Item name" value={toolkitForm.itemName} onChange={e => setToolkitForm(f => ({ ...f, itemName: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                <input type="text" required placeholder="SKU" value={toolkitForm.sku} onChange={e => setToolkitForm(f => ({ ...f, sku: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm font-mono" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="1" required placeholder="Quantity" value={toolkitForm.quantity} onChange={e => setToolkitForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                  <input type="number" min="0" step="0.01" required placeholder="Unit price" value={toolkitForm.unitPrice} onChange={e => setToolkitForm(f => ({ ...f, unitPrice: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                </div>
                <input type="text" placeholder="Description (optional)" value={toolkitForm.description} onChange={e => setToolkitForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-amber-500 text-sm" />
                <button type="submit" disabled={toolkitFormLoading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                  {toolkitFormLoading ? 'Saving...' : 'Add / Restock'}
                </button>
              </form>

              <form onSubmit={handleIssueToolkit} className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2"><UserCheck className="w-4 h-4 text-indigo-500" /><span>Issue Toolkit to RHP</span></h3>
                <select required value={issueForm.rhpId} onChange={e => setIssueForm(f => ({ ...f, rhpId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                  <option value="">Select RHP center</option>
                  {allRhps.map(r => <option key={r.id} value={r.id}>{r.center_name} — {r.first_name} {r.last_name}</option>)}
                </select>
                <select required value={issueForm.toolkitItemId} onChange={e => setIssueForm(f => ({ ...f, toolkitItemId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                  <option value="">Select toolkit item</option>
                  {toolkitStock.map(item => <option key={item.id} value={item.id}>{item.item_name} ({item.available_quantity} available)</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="1" required placeholder="Quantity" value={issueForm.quantity} onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" />
                  <input type="date" required value={issueForm.issuedDate} onChange={e => setIssueForm(f => ({ ...f, issuedDate: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" />
                </div>
                <select value={issueForm.conditionOnIssue} onChange={e => setIssueForm(f => ({ ...f, conditionOnIssue: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                  <option value="Good">Condition: Good</option>
                  <option value="Fair">Condition: Fair</option>
                  <option value="Poor">Condition: Poor</option>
                </select>
                <button type="submit" disabled={issueLoading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                  {issueLoading ? 'Issuing...' : 'Issue Toolkit'}
                </button>
              </form>
            </div>
          </div>
        </div>
        </>
        ) : null}

      </main>

      {/* Inline styles for table cells */}
      <style>{`
        .th-cell {
          padding: 10px 14px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
        }
        .td-cell {
          padding: 10px 14px;
          font-size: 13px;
          color: #475569;
          border-bottom: 1px solid #f1f5f9;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;