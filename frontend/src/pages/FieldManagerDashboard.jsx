import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, UserCheck, MapPin, LogOut, Activity, ClipboardList, FileText,
  CheckCircle, XCircle, Clock, AlertTriangle, GraduationCap, Package,
  ChevronDown, ChevronUp, Search, Calendar, MessageSquare, Send,
  Eye, Stethoscope, UserPlus, X, ChevronLeft, ChevronRight, Truck, ShieldCheck,
  UsersRound, Plus, Trash2, Edit3, MapPinned, Image, Filter, Radio, BatteryMedium,
  Navigation, Camera, ExternalLink
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { API } from '../api';

// Fix Leaflet default icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored map markers
const createColoredIcon = (color) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      background: ${color}; transform: rotate(-45deg);
      border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    "><div style="
      width: 10px; height: 10px; border-radius: 50%;
      background: white; transform: rotate(45deg);
    "></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const greenIcon = createColoredIcon('#10b981');
const amberIcon = createColoredIcon('#f59e0b');

const FieldManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fmData, setFmData] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const navigate = useNavigate();

  // Field reports state
  const [reports, setReports] = useState([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('');
  const [reviewingReport, setReviewingReport] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Applications state
  const [applications, setApplications] = useState([]);
  const [appLoading, setAppLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [updatingApp, setUpdatingApp] = useState(null);
  const [appComment, setAppComment] = useState('');
  const [appUpdateLoading, setAppUpdateLoading] = useState(false);

  // Indent state
  const [indentUpdating, setIndentUpdating] = useState(null);
  const [indentComment, setIndentComment] = useState('');

  // ── NEW: Create FO Modal state ──
  const [showCreateFO, setShowCreateFO] = useState(false);
  const [foForm, setFoForm] = useState({ firstName: '', lastName: '', phone: '', email: '', districtId: '', blockId: '', coverageArea: '' });
  const [foCreating, setFoCreating] = useState(false);
  const [foCreatedResult, setFoCreatedResult] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [blocks, setBlocks] = useState([]);

  // ── NEW: Team Management state ──
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [teamCreating, setTeamCreating] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [availableFos, setAvailableFos] = useState([]);
  const [availableFosError, setAvailableFosError] = useState('');
  const [selectedFosToAdd, setSelectedFosToAdd] = useState([]);
  const [addingMembers, setAddingMembers] = useState(null);

  // ── NEW: Live Tracking state ──
  const [liveLocations, setLiveLocations] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const trackingIntervalRef = useRef(null);

  // ── NEW: RHP Center Visits state ──
  const [rhpVisits, setRhpVisits] = useState([]);
  const [rhpVisitsTotal, setRhpVisitsTotal] = useState(0);
  const [rhpVisitsPage, setRhpVisitsPage] = useState(1);
  const [rhpVisitsLoading, setRhpVisitsLoading] = useState(false);
  const [rhpVisitStartDate, setRhpVisitStartDate] = useState('');
  const [rhpVisitEndDate, setRhpVisitEndDate] = useState('');
  const [rhpVisitPurpose, setRhpVisitPurpose] = useState('');
  const [rhpVisitSearch, setRhpVisitSearch] = useState('');
  const [proofModal, setProofModal] = useState(null);

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchFmSummary(); }, []);

  useEffect(() => {
    if (activeSection === 'reports') fetchReports();
    if (activeSection === 'onboarding') fetchApplications();
    if (activeSection === 'teams') { fetchTeams(); fetchAvailableFos(); }
    if (activeSection === 'tracking') fetchLiveLocations();
    if (activeSection === 'rhp_visits') fetchRhpVisits();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'reports') fetchReports();
  }, [reportsPage, reportFilter]);

  useEffect(() => {
    if (activeSection === 'onboarding') fetchApplications();
  }, [appStatusFilter]);

  // Auto-refresh live tracking every 30 seconds
  useEffect(() => {
    if (activeSection === 'tracking') {
      trackingIntervalRef.current = setInterval(fetchLiveLocations, 30000);
    }
    return () => {
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [activeSection]);

  // Refresh RHP visits when filters change
  useEffect(() => {
    if (activeSection === 'rhp_visits') fetchRhpVisits();
  }, [rhpVisitsPage, rhpVisitStartDate, rhpVisitEndDate, rhpVisitPurpose]);

  // Load districts for Create FO modal
  useEffect(() => {
    if (showCreateFO && districts.length === 0) {
      axios.get(`${API}/districts`, { headers }).then(r => { if (r.data.success) setDistricts(r.data.data); }).catch(() => {});
    }
  }, [showCreateFO]);

  // Load blocks when district changes
  useEffect(() => {
    if (foForm.districtId) {
      axios.get(`${API}/blocks?districtId=${foForm.districtId}`, { headers }).then(r => { if (r.data.success) setBlocks(r.data.data); }).catch(() => {});
    } else {
      setBlocks([]);
    }
  }, [foForm.districtId]);

  // ── Data fetchers ──
  const fetchFmSummary = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/fm-summary`, { headers });
      if (res.data.success) setFmData(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error('FM summary error:', err);
      setError('Unable to load Field Manager dashboard.');
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({ page: reportsPage, limit: 20 });
      if (reportFilter) params.append('status', reportFilter);
      const res = await axios.get(`${API}/field-reports?${params}`, { headers });
      if (res.data.success) {
        setReports(res.data.data);
        setReportsTotal(res.data.total);
      }
    } catch (err) { console.error('Reports error:', err); }
    setReportsLoading(false);
  };

  const fetchApplications = async () => {
    setAppLoading(true);
    try {
      const params = appStatusFilter ? `?status=${appStatusFilter}` : '';
      const res = await axios.get(`${API}/applications${params}`, { headers });
      if (res.data.success) setApplications(res.data.data);
    } catch (err) { console.error('Applications error:', err); }
    setAppLoading(false);
  };

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const res = await axios.get(`${API}/fm/teams`, { headers });
      if (res.data.success) setTeams(res.data.data);
    } catch (err) { console.error('Teams error:', err); }
    setTeamsLoading(false);
  };

  const fetchAvailableFos = async () => {
    try {
      const res = await axios.get(`${API}/fm/field-officers`, { headers });
      if (res.data.success) { setAvailableFos(res.data.data); setAvailableFosError(''); }
    } catch (err) {
      console.error('Available FOs error:', err);
      setAvailableFosError('Unable to load Field Officers. Refresh to try again.');
    }
  };

  const fetchLiveLocations = async () => {
    setTrackingLoading(true);
    try {
      const res = await axios.get(`${API}/fm/team-locations`, { headers });
      if (res.data.success) setLiveLocations(res.data.data);
    } catch (err) { console.error('Live locations error:', err); }
    setTrackingLoading(false);
  };

  const fetchRhpVisits = async () => {
    setRhpVisitsLoading(true);
    try {
      const params = new URLSearchParams({ page: rhpVisitsPage, limit: 20 });
      if (rhpVisitStartDate) params.append('startDate', rhpVisitStartDate);
      if (rhpVisitEndDate) params.append('endDate', rhpVisitEndDate);
      if (rhpVisitPurpose) params.append('purpose', rhpVisitPurpose);
      if (rhpVisitSearch) params.append('search', rhpVisitSearch);
      const res = await axios.get(`${API}/fm/rhp-visits?${params}`, { headers });
      if (res.data.success) {
        setRhpVisits(res.data.data);
        setRhpVisitsTotal(res.data.total);
      }
    } catch (err) { console.error('RHP visits error:', err); }
    setRhpVisitsLoading(false);
  };

  // ── Action handlers ──
  const handleReviewReport = async (reportId, status) => {
    setReviewLoading(true);
    try {
      await axios.put(`${API}/field-reports/${reportId}/review`, { status, reviewComments: reviewComment }, { headers });
      setReviewingReport(null);
      setReviewComment('');
      fetchReports();
      fetchFmSummary();
    } catch (err) { console.error('Review error:', err); }
    setReviewLoading(false);
  };

  const handleUpdateAppStatus = async (appId, newStatus) => {
    setAppUpdateLoading(true);
    try {
      await axios.put(`${API}/applications/${appId}/status`, { status: newStatus, comments: appComment }, { headers });
      setUpdatingApp(null);
      setAppComment('');
      fetchApplications();
      fetchFmSummary();
    } catch (err) { console.error('App status error:', err); }
    setAppUpdateLoading(false);
  };

  const handleIndentAction = async (indentId, newStatus) => {
    try {
      await axios.put(`${API}/indents/${indentId}/status`, { status: newStatus, comments: indentComment }, { headers });
      setIndentUpdating(null);
      setIndentComment('');
      fetchFmSummary();
    } catch (err) { console.error('Indent action error:', err); }
  };

  const handleCreateFO = async (e) => {
    e.preventDefault();
    setFoCreating(true);
    try {
      const res = await axios.post(`${API}/auth/provision`, {
        ...foForm,
        role: 'field_officer',
        districtId: parseInt(foForm.districtId),
        blockId: parseInt(foForm.blockId)
      }, { headers });
      if (res.data.success) {
        setFoCreatedResult(res.data.data);
        fetchFmSummary();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create Field Officer');
    }
    setFoCreating(false);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setTeamCreating(true);
    try {
      await axios.post(`${API}/fm/teams`, { name: newTeamName, description: newTeamDesc }, { headers });
      setNewTeamName('');
      setNewTeamDesc('');
      fetchTeams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create team');
    }
    setTeamCreating(false);
  };

  const handleUpdateTeam = async (teamId) => {
    try {
      await axios.put(`${API}/fm/teams/${teamId}`, { name: editTeamName, description: editTeamDesc }, { headers });
      setEditingTeam(null);
      fetchTeams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? All member assignments will be removed.')) return;
    try {
      await axios.delete(`${API}/fm/teams/${teamId}`, { headers });
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete team'); }
  };

  const handleAddMembers = async (teamId) => {
    if (selectedFosToAdd.length === 0) return;
    try {
      await axios.post(`${API}/fm/teams/${teamId}/members`, { foIds: selectedFosToAdd }, { headers });
      setSelectedFosToAdd([]);
      setAddingMembers(null);
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to add members'); }
  };

  const handleRemoveMember = async (teamId, foId) => {
    try {
      await axios.delete(`${API}/fm/teams/${teamId}/members/${foId}`, { headers });
      fetchTeams();
    } catch (err) { alert(err.response?.data?.error || 'Failed to remove member'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const resetCreateFOModal = () => {
    setShowCreateFO(false);
    setFoForm({ firstName: '', lastName: '', phone: '', email: '', districtId: '', blockId: '', coverageArea: '' });
    setFoCreatedResult(null);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const minutesAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 60000) : null;

  // Proof photos are stored with authenticated (non-public) Cloudinary delivery —
  // fetch a short-lived signed URL before opening the viewer modal.
  const openProofModal = async ({ publicId, mimeType, name, foName, center, date }) => {
    try {
      const res = await axios.get(`${API}/uploads/signed-url`, {
        headers,
        params: { publicId, mimeType }
      });
      if (res.data.success) setProofModal({ url: res.data.url, name, foName, center, date });
    } catch (err) {
      console.error('View proof error:', err);
      alert('Unable to load this file right now.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading Field Manager workspace...</p>
        </div>
      </div>
    );
  }

  const { managedFos, reports: reportStats, appPipeline, trainingBatches, pendingIndents, quickStats } = fmData || {};

  const sidebarItems = [
    { key: 'overview', label: 'Team Overview', icon: Activity },
    { key: 'reports', label: 'Field Reports', icon: FileText, badge: reportStats?.pending },
    { key: 'onboarding', label: 'RHP Onboarding', icon: UserPlus },
    { key: 'teams', label: 'Team Management', icon: UsersRound },
    { key: 'tracking', label: 'Live Tracking', icon: MapPinned },
    { key: 'rhp_visits', label: 'RHP Center Visits', icon: Stethoscope },
    { key: 'training', label: 'Training Mgmt', icon: GraduationCap },
    { key: 'indents', label: 'Inventory Requests', icon: Package, badge: pendingIndents?.length },
  ];

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    applied: 'bg-blue-50 text-blue-700 border-blue-200',
    under_review: 'bg-violet-50 text-violet-700 border-violet-200',
    interviewed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    training_scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-slate-100 text-slate-500 border-slate-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    ongoing: 'bg-teal-50 text-teal-700 border-teal-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
    draft: 'bg-slate-100 text-slate-500 border-slate-200',
    planned: 'bg-blue-50 text-blue-700 border-blue-200',
    archived: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const getStatusBadge = (status) => {
    const cls = statusColors[status] || 'bg-slate-100 text-slate-500 border-slate-200';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{status?.replace(/_/g, ' ')}</span>;
  };

  const reportPages = Math.ceil(reportsTotal / 20) || 1;
  const rhpVisitsPages = Math.ceil(rhpVisitsTotal / 20) || 1;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">

      {/* ── Sidebar ── */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 text-center">
            <span className="text-teal-400 font-extrabold text-2xl tracking-widest block">SAVIESS</span>
            <span className="text-slate-400 text-[10px] tracking-wider uppercase mt-1 block font-medium">Field Manager</span>
          </div>
          <nav className="p-4 space-y-1">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${
                    active
                      ? 'bg-slate-800/80 text-teal-400 border-l-4 border-teal-500'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{item.badge}</span>
                  )}
                </div>
              );
            })}

            <div className="px-4 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-6">Profile</div>
            <div className="px-4 py-2">
              <p className="text-sm font-semibold text-slate-200">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-slate-500 uppercase mt-0.5 tracking-wider font-semibold">{user.role?.replace(/_/g, ' ')}</p>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-rose-500/10 hover:text-rose-400 font-semibold text-sm transition-all">
            <LogOut className="w-5 h-5" /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto max-w-[1600px] mx-auto w-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Field Manager Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage field officers, approve reports, track onboarding & training</p>
          </div>
          <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-600">Operations Center</span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: TEAM OVERVIEW                                              */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'overview' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total FOs', value: quickStats?.totalFos || 0, icon: Users, accent: 'bg-teal-50 text-teal-600' },
                { label: 'Active FOs', value: quickStats?.activeFos || 0, icon: UserCheck, accent: 'bg-emerald-50 text-emerald-600' },
                { label: 'Visits Today', value: quickStats?.visitsToday || 0, icon: MapPin, accent: 'bg-blue-50 text-blue-600' },
                { label: 'Pending Reports', value: reportStats?.pending || 0, icon: FileText, accent: reportStats?.pending > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600' },
              ].map((c, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{c.label}</span>
                    <div className={`p-2 rounded-lg ${c.accent} group-hover:scale-110 transition-transform`}><c.icon className="w-5 h-5" /></div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 mt-4">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Managed Field Officers Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-teal-500" />
                  <span>Managed Field Officers</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">{managedFos?.length || 0}</span>
                </h2>
                <button
                  id="btn-create-fo"
                  onClick={() => setShowCreateFO(true)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4" /><span>Create Field Officer</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="th-cell">Name</th>
                      <th className="th-cell">Phone</th>
                      <th className="th-cell">District</th>
                      <th className="th-cell">Block</th>
                      <th className="th-cell">Visits Today</th>
                      <th className="th-cell">Visits This Month</th>
                      <th className="th-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!managedFos || managedFos.length === 0) ? (
                      <tr><td colSpan="7" className="text-center py-16">
                        <div className="flex flex-col items-center space-y-3">
                          <Users className="w-10 h-10 text-slate-300" />
                          <p className="text-slate-400 text-sm">No field officers assigned to you</p>
                        </div>
                      </td></tr>
                    ) : managedFos.map((fo, i) => (
                      <tr key={fo.fo_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="td-cell font-semibold text-slate-800">{fo.first_name} {fo.last_name}</td>
                        <td className="td-cell text-xs">{fo.phone}</td>
                        <td className="td-cell">{fo.district_name}</td>
                        <td className="td-cell">{fo.block_name}</td>
                        <td className="td-cell">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${fo.visits_today > 0 ? 'bg-teal-50 text-teal-700' : 'bg-slate-50 text-slate-400'}`}>{fo.visits_today}</span>
                        </td>
                        <td className="td-cell font-semibold">{fo.visits_this_month}</td>
                        <td className="td-cell">{getStatusBadge(fo.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Application Pipeline Summary */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-teal-500" />
                <span>RHP Onboarding Pipeline Summary</span>
              </h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(appPipeline || {}).filter(([k]) => k !== 'total').map(([status, count]) => (
                  <div key={status} className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-xl border hover:shadow-sm transition-shadow">
                    {getStatusBadge(status)}
                    <span className="text-lg font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: FIELD REPORTS                                              */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'reports' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-500" />
                <span>Field Reports</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <select value={reportFilter} onChange={e => { setReportFilter(e.target.value); setReportsPage(1); }} className="px-3 py-2 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm">
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {reportsLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="divide-y">
                  {reports.length === 0 ? (
                    <div className="py-16 text-center">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">No field reports found</p>
                    </div>
                  ) : reports.map(r => (
                    <div key={r.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-bold text-slate-800">{r.fo_first} {r.fo_last}</span>
                            {getStatusBadge(r.status)}
                            <span className="text-xs text-slate-400">{formatDate(r.visit_date)}</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{r.report_text}</p>
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                            <span>Purpose: <strong className="text-slate-500">{r.purpose?.replace(/_/g, ' ')}</strong></span>
                            {r.rhp_center && <span>• RHP: <strong className="text-slate-500">{r.rhp_center}</strong></span>}
                            {r.visit_notes && <span>• Notes: {r.visit_notes}</span>}
                          </div>
                          {r.review_comments && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg border text-xs text-slate-500">
                              <span className="font-semibold">Review: </span>{r.review_comments}
                              {r.reviewer_first && <span className="text-slate-400"> — {r.reviewer_first} {r.reviewer_last}</span>}
                            </div>
                          )}
                        </div>
                        {r.status === 'pending' && (
                          <div className="flex-shrink-0">
                            {reviewingReport === r.id ? (
                              <div className="space-y-2 w-64">
                                <textarea
                                  value={reviewComment}
                                  onChange={e => setReviewComment(e.target.value)}
                                  placeholder="Review comments (optional)..."
                                  rows={2}
                                  className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-xs resize-none"
                                />
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleReviewReport(r.id, 'approved')}
                                    disabled={reviewLoading}
                                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /><span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleReviewReport(r.id, 'rejected')}
                                    disabled={reviewLoading}
                                    className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /><span>Reject</span>
                                  </button>
                                </div>
                                <button onClick={() => { setReviewingReport(null); setReviewComment(''); }} className="w-full text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReviewingReport(r.id)}
                                className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" /><span>Review</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {reportPages > 1 && (
                <div className="px-5 py-4 border-t flex items-center justify-between">
                  <p className="text-xs text-slate-400">Page {reportsPage} of {reportPages} ({reportsTotal} total)</p>
                  <div className="flex space-x-2">
                    <button disabled={reportsPage <= 1} onClick={() => setReportsPage(p => p - 1)} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    <button disabled={reportsPage >= reportPages} onClick={() => setReportsPage(p => p + 1)} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: RHP ONBOARDING                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'onboarding' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-teal-500" />
                <span>RHP Onboarding Pipeline</span>
              </h2>
              <div className="ml-auto">
                <select value={appStatusFilter} onChange={e => setAppStatusFilter(e.target.value)} className="px-3 py-2 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm">
                  <option value="">All Status</option>
                  <option value="applied">Applied</option>
                  <option value="under_review">Under Review</option>
                  <option value="interviewed">Interviewed</option>
                  <option value="training_scheduled">Training Scheduled</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {appLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr>
                        <th className="th-cell">Applicant</th>
                        <th className="th-cell">Phone</th>
                        <th className="th-cell">District</th>
                        <th className="th-cell">Block</th>
                        <th className="th-cell">Village</th>
                        <th className="th-cell">Qualification</th>
                        <th className="th-cell">Status</th>
                        <th className="th-cell">Date</th>
                        <th className="th-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.length === 0 ? (
                        <tr><td colSpan="9" className="text-center py-16">
                          <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-400 text-sm">No applications found</p>
                        </td></tr>
                      ) : applications.map((app, i) => (
                        <tr key={app.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="td-cell font-semibold text-slate-800">{app.first_name} {app.last_name}<div className="text-[10px] text-slate-400">{app.gender}, {app.age}y</div></td>
                          <td className="td-cell text-xs">{app.phone}</td>
                          <td className="td-cell">{app.district_name}</td>
                          <td className="td-cell">{app.block_name}</td>
                          <td className="td-cell">{app.village}</td>
                          <td className="td-cell text-xs">{app.qualification}</td>
                          <td className="td-cell">{getStatusBadge(app.status)}</td>
                          <td className="td-cell text-xs text-slate-400">{formatDate(app.created_at)}</td>
                          <td className="td-cell">
                            {updatingApp === app.id ? (
                              <div className="space-y-2 min-w-[180px]">
                                <textarea value={appComment} onChange={e => setAppComment(e.target.value)} placeholder="Comments..." rows={1} className="w-full px-2 py-1.5 border rounded-lg bg-slate-50 text-xs resize-none focus:outline-none focus:border-teal-500" />
                                <div className="flex flex-wrap gap-1">
                                  {['under_review', 'interviewed', 'training_scheduled', 'approved', 'rejected']
                                    .filter(s => s !== app.status)
                                    .map(s => (
                                      <button key={s} onClick={() => handleUpdateAppStatus(app.id, s)} disabled={appUpdateLoading}
                                        className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase border transition-all ${
                                          s === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                          : s === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >{s.replace(/_/g, ' ')}</button>
                                    ))}
                                </div>
                                <button onClick={() => { setUpdatingApp(null); setAppComment(''); }} className="text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setUpdatingApp(app.id)} className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-lg border border-teal-200 transition-all">
                                Update
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: TEAM MANAGEMENT (NEW)                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'teams' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <UsersRound className="w-5 h-5 text-teal-500" />
                <span>Team Management</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">{teams.length}</span>
              </h2>
            </div>

            {/* Create Team Form */}
            <form onSubmit={handleCreateTeam} className="bg-white p-5 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-teal-500" />
                <span>Create New Team</span>
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Team Name *</label>
                  <input
                    id="input-team-name"
                    value={newTeamName} onChange={e => setNewTeamName(e.target.value)} required
                    placeholder="e.g. District Alpha Squad"
                    className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                  <input
                    id="input-team-desc"
                    value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>
                <button type="submit" disabled={teamCreating || !newTeamName.trim()} id="btn-create-team"
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50">
                  {teamCreating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>

            {/* Teams List */}
            {teamsLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : teams.length === 0 ? (
              <div className="bg-white rounded-2xl border shadow-sm py-16 text-center">
                <UsersRound className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No teams created yet</p>
                <p className="text-slate-300 text-xs mt-1">Create a team above to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {teams.map(team => (
                  <div key={team.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Team Header */}
                    <div className="p-5 flex items-center justify-between gap-3 cursor-pointer" onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-2 bg-teal-50 rounded-xl">
                          <UsersRound className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          {editingTeam === team.id ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} className="px-2 py-1 border rounded-lg text-sm font-bold focus:outline-none focus:border-teal-500" />
                              <input value={editTeamDesc} onChange={e => setEditTeamDesc(e.target.value)} placeholder="Description" className="px-2 py-1 border rounded-lg text-xs focus:outline-none focus:border-teal-500" />
                              <button onClick={() => handleUpdateTeam(team.id)} className="px-2 py-1 bg-teal-500 text-white rounded-lg text-xs font-bold">Save</button>
                              <button onClick={() => setEditingTeam(null)} className="px-2 py-1 text-slate-400 text-xs">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-bold text-slate-800 truncate">{team.name}</h3>
                              {team.description && <p className="text-xs text-slate-400 truncate">{team.description}</p>}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                        </span>
                        {getStatusBadge(team.status)}
                        <button onClick={(e) => { e.stopPropagation(); setEditingTeam(team.id); setEditTeamName(team.name); setEditTeamDesc(team.description || ''); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                          <Edit3 className="w-4 h-4 text-slate-400" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id); }} className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-4 h-4 text-rose-400" />
                        </button>
                        {expandedTeam === team.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Team Members */}
                    {expandedTeam === team.id && (
                      <div className="border-t bg-slate-50/50 p-5 space-y-4">
                        {/* Add Members */}
                        {addingMembers === team.id ? (
                          <div className="bg-white p-4 rounded-xl border space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Field Officers to Add</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                              {availableFos
                                .filter(fo => !team.members?.some(m => m.fo_id === fo.fo_id))
                                .map(fo => (
                                  <label key={fo.fo_id} className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedFosToAdd.includes(fo.fo_id) ? 'bg-teal-50 border-teal-300' : 'bg-white hover:bg-slate-50'}`}>
                                    <input type="checkbox" checked={selectedFosToAdd.includes(fo.fo_id)} onChange={(e) => {
                                      setSelectedFosToAdd(prev => e.target.checked ? [...prev, fo.fo_id] : prev.filter(id => id !== fo.fo_id));
                                    }} className="rounded border-slate-300 text-teal-500 focus:ring-teal-500" />
                                    <span className="text-sm font-medium text-slate-700">{fo.first_name} {fo.last_name}</span>
                                    <span className="text-[10px] text-slate-400">{fo.district_name}</span>
                                  </label>
                                ))}
                              {availableFos.filter(fo => !team.members?.some(m => m.fo_id === fo.fo_id)).length === 0 && (
                                <p className="text-xs text-slate-400 col-span-full py-2">
                                  {availableFosError || 'All managed FOs are already in this team'}
                                </p>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <button onClick={() => handleAddMembers(team.id)} disabled={selectedFosToAdd.length === 0}
                                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50">
                                Add {selectedFosToAdd.length} Member{selectedFosToAdd.length !== 1 ? 's' : ''}
                              </button>
                              <button onClick={() => { setAddingMembers(null); setSelectedFosToAdd([]); }} className="px-4 py-2 text-slate-400 text-xs hover:text-slate-600">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setAddingMembers(team.id)} className="flex items-center space-x-2 px-4 py-2.5 bg-white border-2 border-dashed border-teal-300 hover:border-teal-400 hover:bg-teal-50 text-teal-600 font-bold text-xs rounded-xl transition-all">
                            <Plus className="w-4 h-4" /><span>Add Field Officers</span>
                          </button>
                        )}

                        {/* Members Table */}
                        {team.members && team.members.length > 0 ? (
                          <div className="overflow-x-auto bg-white rounded-xl border">
                            <table className="w-full text-sm text-left">
                              <thead>
                                <tr>
                                  <th className="th-cell">Name</th>
                                  <th className="th-cell">Phone</th>
                                  <th className="th-cell">District</th>
                                  <th className="th-cell">Block</th>
                                  <th className="th-cell">Status</th>
                                  <th className="th-cell">Added</th>
                                  <th className="th-cell"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {team.members.map((m, i) => (
                                  <tr key={m.membership_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className="td-cell font-semibold text-slate-800">{m.first_name} {m.last_name}</td>
                                    <td className="td-cell text-xs">{m.phone}</td>
                                    <td className="td-cell">{m.district_name}</td>
                                    <td className="td-cell">{m.block_name}</td>
                                    <td className="td-cell">{getStatusBadge(m.fo_status)}</td>
                                    <td className="td-cell text-xs text-slate-400">{formatDate(m.added_at)}</td>
                                    <td className="td-cell">
                                      <button onClick={() => handleRemoveMember(team.id, m.fo_id)} className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Remove from team">
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl border py-8 text-center">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 text-xs">No members in this team yet</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: LIVE TRACKING (NEW)                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'tracking' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <MapPinned className="w-5 h-5 text-teal-500" />
                <span>Live Field Officer Tracking</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {liveLocations.length} online
                </span>
              </h2>
              <button onClick={fetchLiveLocations} disabled={trackingLoading}
                className="ml-auto flex items-center space-x-2 px-4 py-2 bg-white border rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-600 transition-all disabled:opacity-50">
                <Radio className="w-4 h-4" /><span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Map */}
              <div className="lg:col-span-3 bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ height: '520px' }}>
                {trackingLoading && liveLocations.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <MapContainer
                    center={liveLocations.length > 0 ? [liveLocations[0].latitude, liveLocations[0].longitude] : [25.6, 85.1]}
                    zoom={liveLocations.length > 0 ? 10 : 7}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {liveLocations.map(loc => {
                      const mins = minutesAgo(loc.last_updated);
                      const icon = mins !== null && mins <= 5 ? greenIcon : amberIcon;
                      return (
                        <Marker key={loc.fo_id} position={[loc.latitude, loc.longitude]} icon={icon}>
                          <Popup className="custom-map-popup">
                            <div className="p-1 min-w-[180px]">
                              <h4 className="font-bold text-slate-800 text-sm">{loc.first_name} {loc.last_name}</h4>
                              <p className="text-xs text-slate-500 mt-1">📞 {loc.phone}</p>
                              <p className="text-xs text-slate-500">📍 {loc.district_name}, {loc.block_name}</p>
                              {loc.coverage_area && <p className="text-xs text-slate-500">🗺️ {loc.coverage_area}</p>}
                              <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px]">
                                <span className="text-slate-400">Updated {mins}m ago</span>
                                {loc.battery_level !== null && (
                                  <span className={`font-bold ${loc.battery_level < 20 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    🔋 {loc.battery_level}%
                                  </span>
                                )}
                              </div>
                              {loc.accuracy && <p className="text-[10px] text-slate-300 mt-1">Accuracy: ±{loc.accuracy}m</p>}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                )}
              </div>

              {/* FO List Panel */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
                <div className="px-4 pt-4 pb-3 border-b">
                  <h3 className="font-bold text-slate-800 text-sm">Online Officers</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Auto-refreshes every 30s</p>
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {liveLocations.length === 0 ? (
                    <div className="py-12 text-center px-4">
                      <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-xs">No officers are currently sharing their location</p>
                    </div>
                  ) : liveLocations.map(loc => {
                    const mins = minutesAgo(loc.last_updated);
                    return (
                      <div key={loc.fo_id} className="p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${mins !== null && mins <= 5 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                          <span className="font-semibold text-slate-800 text-xs">{loc.first_name} {loc.last_name}</span>
                        </div>
                        <div className="ml-4.5 space-y-0.5">
                          <p className="text-[10px] text-slate-400">{loc.district_name} • {loc.block_name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{mins}m ago</span>
                            {loc.battery_level !== null && (
                              <span className={`text-[10px] font-bold ${loc.battery_level < 20 ? 'text-rose-500' : 'text-slate-400'}`}>
                                {loc.battery_level}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: RHP CENTER VISITS (NEW)                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'rhp_visits' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-teal-500" />
                <span>RHP Center Visits</span>
                {rhpVisitsTotal > 0 && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">{rhpVisitsTotal}</span>}
              </h2>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-wrap items-end gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">From Date</label>
                <input type="date" value={rhpVisitStartDate} onChange={e => { setRhpVisitStartDate(e.target.value); setRhpVisitsPage(1); }}
                  className="px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">To Date</label>
                <input type="date" value={rhpVisitEndDate} onChange={e => { setRhpVisitEndDate(e.target.value); setRhpVisitsPage(1); }}
                  className="px-3 py-2 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Purpose</label>
                <select value={rhpVisitPurpose} onChange={e => { setRhpVisitPurpose(e.target.value); setRhpVisitsPage(1); }}
                  className="px-3 py-2 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm">
                  <option value="">All</option>
                  <option value="routine">Routine</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="training_audit">Training Audit</option>
                  <option value="inventory_delivery">Inventory Delivery</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={rhpVisitSearch} onChange={e => setRhpVisitSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setRhpVisitsPage(1); fetchRhpVisits(); } }}
                    placeholder="Search FO, RHP center, village..."
                    className="w-full pl-9 pr-3 py-2 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" />
                </div>
              </div>
              <button onClick={() => { setRhpVisitsPage(1); fetchRhpVisits(); }}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs rounded-xl transition-all">
                Apply
              </button>
            </div>

            {/* Visits Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {rhpVisitsLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr>
                        <th className="th-cell">Field Officer</th>
                        <th className="th-cell">RHP Center</th>
                        <th className="th-cell">Visit Date</th>
                        <th className="th-cell">Purpose</th>
                        <th className="th-cell">Check-In</th>
                        <th className="th-cell">Check-Out</th>
                        <th className="th-cell">Status</th>
                        <th className="th-cell">Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rhpVisits.length === 0 ? (
                        <tr><td colSpan="8" className="text-center py-16">
                          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-400 text-sm">No RHP center visits found</p>
                          <p className="text-slate-300 text-xs mt-1">Visits will appear when FOs log visits to RHP centers</p>
                        </td></tr>
                      ) : rhpVisits.map((v, i) => (
                        <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="td-cell">
                            <div className="font-semibold text-slate-800">{v.fo_first} {v.fo_last}</div>
                            <div className="text-[10px] text-slate-400">{v.fo_phone}</div>
                          </td>
                          <td className="td-cell">
                            <div className="font-semibold text-slate-800">{v.rhp_center || '—'}</div>
                            <div className="text-[10px] text-slate-400">{v.rhp_village}{v.rhp_district ? `, ${v.rhp_district}` : ''}</div>
                          </td>
                          <td className="td-cell text-xs">{formatDate(v.visit_date)}</td>
                          <td className="td-cell">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              {v.purpose?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="td-cell text-xs">{formatTime(v.check_in_time)}</td>
                          <td className="td-cell text-xs">{formatTime(v.check_out_time)}</td>
                          <td className="td-cell">{getStatusBadge(v.status)}</td>
                          <td className="td-cell">
                            {v.proof_image_url ? (
                              <button onClick={() => openProofModal({ publicId: v.proof_public_id, mimeType: v.proof_mime_type, name: v.proof_file_name, foName: `${v.fo_first} ${v.fo_last}`, center: v.rhp_center, date: v.visit_date })}
                                className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 transition-all group">
                                <Camera className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                <span>View Proof</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">No proof</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {rhpVisitsPages > 1 && (
                <div className="px-5 py-4 border-t flex items-center justify-between">
                  <p className="text-xs text-slate-400">Page {rhpVisitsPage} of {rhpVisitsPages} ({rhpVisitsTotal} total)</p>
                  <div className="flex space-x-2">
                    <button disabled={rhpVisitsPage <= 1} onClick={() => setRhpVisitsPage(p => p - 1)} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    <button disabled={rhpVisitsPage >= rhpVisitsPages} onClick={() => setRhpVisitsPage(p => p + 1)} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: TRAINING MANAGEMENT                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'training' && (
          <>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-teal-500" />
              <span>Training Batches</span>
            </h2>

            {(!trainingBatches || trainingBatches.length === 0) ? (
              <div className="bg-white rounded-2xl border shadow-sm py-16 text-center">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No training batches scheduled yet</p>
                <p className="text-slate-300 text-xs mt-1">Batches will appear here once created</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {trainingBatches.map(batch => (
                  <div key={batch.id} className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">{batch.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Trainer: <strong className="text-slate-500">{batch.trainer_name}</strong></p>
                      </div>
                      {getStatusBadge(batch.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="p-3 bg-slate-50 rounded-xl border">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">{formatDate(batch.start_date)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</p>
                        <p className="text-sm font-semibold text-slate-800 mt-1">{formatDate(batch.end_date)}</p>
                      </div>
                      <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Unique Trainees</p>
                        <p className="text-xl font-black text-teal-700 mt-1">{batch.unique_trainees}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Attendance Logs</p>
                        <p className="text-xl font-black text-blue-700 mt-1">{batch.total_attendance}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: INVENTORY INDENT REQUESTS                                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'indents' && (
          <>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-teal-500" />
              <span>Pending Inventory Requests</span>
              {pendingIndents?.length > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{pendingIndents.length}</span>}
            </h2>

            {(!pendingIndents || pendingIndents.length === 0) ? (
              <div className="bg-white rounded-2xl border shadow-sm py-16 text-center">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No pending inventory requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingIndents.map(indent => (
                  <div key={indent.id} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-bold text-slate-800">{indent.rhp_first} {indent.rhp_last}</span>
                          {getStatusBadge(indent.status)}
                          <span className="text-xs text-slate-400">{formatDate(indent.request_date)}</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          <strong className="text-teal-700">{indent.rhp_center}</strong> — {indent.total_items} item(s) requested
                        </p>
                        {indent.comments && <p className="text-xs text-slate-400 mt-1">{indent.comments}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {indentUpdating === indent.id ? (
                          <div className="space-y-2 w-56">
                            <textarea value={indentComment} onChange={e => setIndentComment(e.target.value)} placeholder="Comments..." rows={1} className="w-full px-2 py-1.5 border rounded-lg bg-slate-50 text-xs resize-none focus:outline-none focus:border-teal-500" />
                            <div className="flex space-x-2">
                              <button onClick={() => handleIndentAction(indent.id, 'approved')} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1">
                                <CheckCircle className="w-3.5 h-3.5" /><span>Approve</span>
                              </button>
                              <button onClick={() => handleIndentAction(indent.id, 'dispatched')} className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center space-x-1">
                                <Truck className="w-3.5 h-3.5" /><span>Dispatch</span>
                              </button>
                            </div>
                            <button onClick={() => { setIndentUpdating(null); setIndentComment(''); }} className="w-full text-[10px] text-slate-400 hover:text-slate-600 text-center">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setIndentUpdating(indent.id)} className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 transition-all">
                            Take Action
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </main>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE FIELD OFFICER                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showCreateFO && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={resetCreateFOModal}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Create Field Officer</h2>
                <p className="text-xs text-slate-400 mt-0.5">New account will be assigned to you as manager</p>
              </div>
              <button onClick={resetCreateFOModal} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {foCreatedResult ? (
              /* Success state */
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Field Officer Created!</h3>
                  <p className="text-sm text-slate-500 mt-1">Share these credentials with the new field officer</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Name</span>
                    <span className="font-semibold text-slate-800">{foCreatedResult.firstName} {foCreatedResult.lastName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Email</span>
                    <span className="font-semibold text-teal-700">{foCreatedResult.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Password</span>
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">{foCreatedResult.defaultPassword}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Phone</span>
                    <span className="font-semibold text-slate-800">{foCreatedResult.phone}</span>
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-700">
                  <strong>⚠️ Important:</strong> Please note down these credentials. The password will not be shown again.
                </div>

                <button onClick={resetCreateFOModal} className="w-full py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm rounded-xl transition-all">
                  Done
                </button>
              </div>
            ) : (
              /* Form state */
              <form onSubmit={handleCreateFO} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">First Name *</label>
                    <input id="fo-first-name" value={foForm.firstName} onChange={e => setFoForm(f => ({ ...f, firstName: e.target.value }))} required
                      className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" placeholder="First name" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Last Name *</label>
                    <input id="fo-last-name" value={foForm.lastName} onChange={e => setFoForm(f => ({ ...f, lastName: e.target.value }))} required
                      className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" placeholder="Last name" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phone *</label>
                    <input id="fo-phone" value={foForm.phone} onChange={e => setFoForm(f => ({ ...f, phone: e.target.value }))} required
                      className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" placeholder="10-digit phone" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Email (Optional)</label>
                    <input id="fo-email" value={foForm.email} onChange={e => setFoForm(f => ({ ...f, email: e.target.value }))} type="email"
                      className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" placeholder="Auto-generated if blank" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">District *</label>
                    <select id="fo-district" value={foForm.districtId} onChange={e => setFoForm(f => ({ ...f, districtId: e.target.value, blockId: '' }))} required
                      className="w-full px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm">
                      <option value="">Select district</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Block *</label>
                    <select id="fo-block" value={foForm.blockId} onChange={e => setFoForm(f => ({ ...f, blockId: e.target.value }))} required
                      className="w-full px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-teal-500 text-sm" disabled={!foForm.districtId}>
                      <option value="">Select block</option>
                      {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Coverage Area</label>
                  <input id="fo-coverage" value={foForm.coverageArea} onChange={e => setFoForm(f => ({ ...f, coverageArea: e.target.value }))}
                    className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-teal-500 text-sm" placeholder="e.g. North Patna Rural" />
                </div>

                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-700">
                  <strong>ℹ️ Note:</strong> A default password (<code>Saviess@[last4digits]</code>) will be auto-generated based on the phone number.
                </div>

                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={resetCreateFOModal} className="flex-1 py-3 border rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={foCreating} id="btn-submit-fo"
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50">
                    {foCreating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PROOF IMAGE VIEWER                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {proofModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setProofModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Visit Proof</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {proofModal.foName} → {proofModal.center} • {formatDate(proofModal.date)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <a href={proofModal.url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Open in new tab">
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
                <button onClick={() => setProofModal(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50 min-h-[300px]">
              <img src={proofModal.url} alt={proofModal.name || 'Visit proof'}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-sm" />
            </div>
            {proofModal.name && (
              <div className="px-4 py-2 border-t text-xs text-slate-400 text-center">{proofModal.name}</div>
            )}
          </div>
        </div>
      )}

      {/* Table cell styles */}
      <style>{`
        .th-cell { padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .td-cell { padding: 10px 14px; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
        .custom-map-marker { background: none !important; border: none !important; }
      `}</style>
    </div>
  );
};

export default FieldManagerDashboard;
