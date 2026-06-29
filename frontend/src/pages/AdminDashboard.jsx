import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Eye, Sparkles, Box, Hammer, LogOut, AlertTriangle, MapPin, Activity, Search, Calendar, ClipboardList, Stethoscope, Glasses, FileText, ExternalLink, ChevronLeft, ChevronRight, UserPlus, X, CheckCircle, Copy, Shield, FileSpreadsheet, Download } from 'lucide-react';
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
  const [blocks, setBlocks] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // Active section state: 'stats' | 'createUser' | 'rhpApps'
  const [activeSection, setActiveSection] = useState('stats');

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

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch districts on mount
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const res = await axios.get(`${API}/districts`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setDistricts(res.data.data);
      } catch (err) { console.error('Load districts error:', err); }
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

  useEffect(() => {
    // 1. Fetch static summary statistics
    fetchStats();

    // 2. Initialize Socket.io connection with JWT auth token
    socketRef.current = io(SOCKET_URL, {
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

  const totalPages = Math.ceil(tableTotal / 100) || 1;

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'districtId') setFormData(prev => ({ ...prev, districtId: value, blockId: '' }));
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
        districtId: formData.districtId,
        blockId: formData.blockId,
      };
      if (createRole === 'rhp') {
        payload.centerName = formData.centerName;
        payload.village = formData.village;
      } else {
        payload.coverageArea = formData.coverageArea;
      }
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
                <a href={row.proof_image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-xs font-semibold">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View</span>
                </a>
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
            <td className="td-cell text-xs">{row.spherical_left?.toFixed(2) ?? '—'} / {row.spherical_right?.toFixed(2) ?? '—'}</td>
            <td className="td-cell text-xs">{row.cylindrical_left?.toFixed(2) ?? '—'} / {row.cylindrical_right?.toFixed(2) ?? '—'}</td>
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
            <td className="td-cell text-xs">{row.left_power_sph?.toFixed(2) ?? '—'} / {row.right_power_sph?.toFixed(2) ?? '—'}</td>
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
                <p className="text-slate-500 text-sm mt-1">Provision a Field Officer or RHP with full account and profile</p>
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
                    <h3 className="font-bold text-emerald-900 text-lg">{createdUser.role === 'rhp' ? 'RHP' : 'Field Officer'} Created Successfully!</h3>
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

                {/* District + Block dropdowns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">District *</label>
                    <select required value={formData.districtId} onChange={e => handleFormChange('districtId', e.target.value)} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm appearance-none">
                      <option value="">Select district...</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Block *</label>
                    <select required value={formData.blockId} onChange={e => handleFormChange('blockId', e.target.value)} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm appearance-none" disabled={!formData.districtId}>
                      <option value="">{formData.districtId ? 'Select block...' : 'Select district first'}</option>
                      {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Role-specific fields */}
                {createRole === 'rhp' ? (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                    <div>
                      <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Vision Center Name *</label>
                      <input type="text" required value={formData.centerName} onChange={e => handleFormChange('centerName', e.target.value)} placeholder="Sunita's Vision Center" className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-purple-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Village *</label>
                      <input type="text" required value={formData.village} onChange={e => handleFormChange('village', e.target.value)} placeholder="Harnaut Village" className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-purple-500 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                    <label className="block text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">Coverage Area</label>
                    <input type="text" value={formData.coverageArea} onChange={e => handleFormChange('coverageArea', e.target.value)} placeholder="Patna Sadar blocks coverage" className="w-full px-4 py-3 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm" />
                  </div>
                )}

                {/* Info box */}
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 flex items-start space-x-2">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>A default password <strong>Saviess@[last 4 digits of phone]</strong> will be auto-generated. The credentials will be shown after creation.</span>
                </div>

                <button type="submit" disabled={createLoading} className={`w-full py-3.5 font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 ${createRole === 'rhp' ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/15' : 'bg-teal-500 hover:bg-teal-600 text-white shadow-teal-500/15'}`}>
                  {createLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <><UserPlus className="w-4 h-4" /><span>Create {createRole === 'rhp' ? 'RHP' : 'Field Officer'} Account</span></>}
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
        ) : (
        <>
        /* ================================================================ */
        /* RHP APPLICATIONS MANAGEMENT PANEL                                */
        /* ================================================================ */
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                className="px-3 py-2.5 border rounded-xl bg-slate-50 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
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
                          <a key={i} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border hover:border-indigo-300 hover:bg-indigo-50/50 transition-all">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{doc.file_name}</p>
                              <p className="text-[10px] text-slate-400 uppercase">{doc.document_type?.replace(/_/g, ' ')}</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                          </a>
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
        </> /* end of stats/data view */
        )}

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
