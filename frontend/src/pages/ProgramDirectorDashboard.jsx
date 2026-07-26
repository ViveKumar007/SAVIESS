import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  Users, UserCheck, Eye, Sparkles, TrendingUp, DollarSign, LogOut,
  BarChart3, Target, Handshake, Building2, Activity, AlertTriangle,
  Plus, Edit3, Trash2, X, CheckCircle, ChevronLeft, ChevronRight,
  Search, Calendar, FileText, ArrowUpRight, ArrowDownRight, Minus,
  MapPin, Glasses, PackageCheck, Send, PieChart as PieChartIcon,
  Download, Upload, Image, ExternalLink, Package, RefreshCw
} from 'lucide-react';

import { API } from '../api';

const ProgramDirectorDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdData, setPdData] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const navigate = useNavigate();

  // Partner management state
  const [partners, setPartners] = useState([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerForm, setPartnerForm] = useState({ name: '', type: 'ngo', contactPerson: '', phone: '', email: '', districtId: '', notes: '' });
  const [partnerError, setPartnerError] = useState('');

  // KPI state
  const [kpiActuals, setKpiActuals] = useState([]);
  const [kpiMonth, setKpiMonth] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiTargetForm, setKpiTargetForm] = useState({ districtId: '', screeningsTarget: '', dispensingsTarget: '', rhpOnboardingTarget: '', revenueTarget: '' });
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiSaveMsg, setKpiSaveMsg] = useState('');

  // Districts for forms
  const [districts, setDistricts] = useState([]);

  // ── PD Module: Visit Management ──
  const [visits, setVisits] = useState([]);
  const [visitTotal, setVisitTotal] = useState(0);
  const [visitPage, setVisitPage] = useState(1);
  const [visitSearch, setVisitSearch] = useState('');
  const [visitDateStart, setVisitDateStart] = useState('');
  const [visitDateEnd, setVisitDateEnd] = useState('');
  const [visitLoading, setVisitLoading] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [visitForm, setVisitForm] = useState({ visitDate: '', place: '', keyObservations: '', areasForImprovement: '', remarks: '' });
  const [visitFormError, setVisitFormError] = useState('');

  // ── PD Module: Eyeglass Inventory ──
  const [eyeglassColors, setEyeglassColors] = useState([]);
  const [eyeglassStock, setEyeglassStock] = useState({ stock: [], log: [] });
  const [eyeglassLoading, setEyeglassLoading] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockForm, setStockForm] = useState({ colorId: '', quantity: '', notes: '' });
  const [showColorForm, setShowColorForm] = useState(false);
  const [colorForm, setColorForm] = useState({ name: '', hexCode: '#000000', emoji: '' });
  const [stockMsg, setStockMsg] = useState('');

  // ── PD Module: FO Allocations ──
  const [foList, setFoList] = useState([]);
  const [foAllocations, setFoAllocations] = useState({ allocations: [], log: [] });
  const [allocLoading, setAllocLoading] = useState(false);
  const [selectedFoFilter, setSelectedFoFilter] = useState('');
  const [showAllocForm, setShowAllocForm] = useState(false);
  const [allocForm, setAllocForm] = useState({ foId: '', colorId: '', quantity: '', notes: '' });
  const [allocMsg, setAllocMsg] = useState('');

  // ── PD Module: Distribution ──
  const [distributions, setDistributions] = useState([]);
  const [distTotal, setDistTotal] = useState(0);
  const [distPage, setDistPage] = useState(1);
  const [distLoading, setDistLoading] = useState(false);
  const [showDistForm, setShowDistForm] = useState(false);
  const [distForm, setDistForm] = useState({ foId: '', colorId: '', quantity: '', patientName: '', patientPhone: '', patientDetails: '', distributionDate: '', notes: '' });
  const [distProofFile, setDistProofFile] = useState(null);
  const [distFormError, setDistFormError] = useState('');
  const [distSubmitting, setDistSubmitting] = useState(false);

  // ── PD Module: Analytics ──
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchPdSummary();
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (activeSection === 'partners') fetchPartners();
    if (activeSection === 'kpi') fetchKpiActuals();
    if (activeSection === 'visits') fetchVisits();
    if (activeSection === 'eyeglass-inventory') { fetchEyeglassStock(); fetchColors(); }
    if (activeSection === 'fo-allocation') { fetchFoList(); fetchFoAllocations(); fetchColors(); }
    if (activeSection === 'distribution') { fetchFoList(); fetchColors(); fetchDistributions(); }
    if (activeSection === 'pd-analytics') fetchAnalytics();
  }, [activeSection]);

  // ── Core fetchers ──
  const fetchPdSummary = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/pd-summary`, { headers });
      if (res.data.success) setPdData(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error('PD summary error:', err);
      setError('Unable to load Program Director dashboard data.');
      setLoading(false);
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await axios.get(`${API}/districts`, { headers });
      if (res.data.success) setDistricts(res.data.data);
    } catch (err) { console.error('Districts error:', err); }
  };

  const fetchPartners = async () => {
    setPartnerLoading(true);
    try {
      const res = await axios.get(`${API}/partners`, { headers });
      if (res.data.success) setPartners(res.data.data);
    } catch (err) { console.error('Partners error:', err); }
    setPartnerLoading(false);
  };

  const fetchKpiActuals = async () => {
    setKpiLoading(true);
    try {
      const res = await axios.get(`${API}/kpis/actuals?month=${kpiMonth}`, { headers });
      if (res.data.success) setKpiActuals(res.data.data);
    } catch (err) { console.error('KPI error:', err); }
    setKpiLoading(false);
  };

  useEffect(() => {
    if (activeSection === 'kpi') fetchKpiActuals();
  }, [kpiMonth]);

  // ── Visit fetchers ──
  const fetchVisits = async () => {
    setVisitLoading(true);
    try {
      let url = `${API}/pd/visits?page=${visitPage}&limit=15`;
      if (visitSearch) url += `&search=${encodeURIComponent(visitSearch)}`;
      if (visitDateStart) url += `&startDate=${visitDateStart}`;
      if (visitDateEnd) url += `&endDate=${visitDateEnd}`;
      const res = await axios.get(url, { headers });
      if (res.data.success) { setVisits(res.data.data); setVisitTotal(res.data.total); }
    } catch (err) { console.error('Visits error:', err); }
    setVisitLoading(false);
  };
  useEffect(() => { if (activeSection === 'visits') fetchVisits(); }, [visitPage, visitSearch, visitDateStart, visitDateEnd]);

  // ── Color/Stock fetchers ──
  const fetchColors = async () => {
    try {
      const res = await axios.get(`${API}/pd/eyeglass-colors`, { headers });
      if (res.data.success) setEyeglassColors(res.data.data);
    } catch (err) { console.error('Colors error:', err); }
  };
  const fetchEyeglassStock = async () => {
    setEyeglassLoading(true);
    try {
      const res = await axios.get(`${API}/pd/eyeglass-stock`, { headers });
      if (res.data.success) setEyeglassStock(res.data.data);
    } catch (err) { console.error('Eyeglass stock error:', err); }
    setEyeglassLoading(false);
  };

  // ── FO Allocation fetchers ──
  const fetchFoList = async () => {
    try {
      const res = await axios.get(`${API}/pd/fo-list`, { headers });
      if (res.data.success) setFoList(res.data.data);
    } catch (err) { console.error('FO list error:', err); }
  };
  const fetchFoAllocations = async () => {
    setAllocLoading(true);
    try {
      let url = `${API}/pd/fo-allocations`;
      if (selectedFoFilter) url += `?foId=${selectedFoFilter}`;
      const res = await axios.get(url, { headers });
      if (res.data.success) setFoAllocations(res.data.data);
    } catch (err) { console.error('FO allocations error:', err); }
    setAllocLoading(false);
  };
  useEffect(() => { if (activeSection === 'fo-allocation') fetchFoAllocations(); }, [selectedFoFilter]);

  // ── Distribution fetchers ──
  const fetchDistributions = async () => {
    setDistLoading(true);
    try {
      const res = await axios.get(`${API}/pd/distributions?page=${distPage}&limit=15`, { headers });
      if (res.data.success) { setDistributions(res.data.data); setDistTotal(res.data.total); }
    } catch (err) { console.error('Distributions error:', err); }
    setDistLoading(false);
  };
  useEffect(() => { if (activeSection === 'distribution') fetchDistributions(); }, [distPage]);

  // ── Analytics fetcher ──
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await axios.get(`${API}/pd/analytics`, { headers });
      if (res.data.success) setAnalytics(res.data.data);
    } catch (err) { console.error('Analytics error:', err); }
    setAnalyticsLoading(false);
  };

  // ── Partner CRUD ──
  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    setPartnerError('');
    try {
      if (editingPartner) {
        await axios.put(`${API}/partners/${editingPartner.id}`, partnerForm, { headers });
      } else {
        await axios.post(`${API}/partners`, partnerForm, { headers });
      }
      setShowPartnerForm(false);
      setEditingPartner(null);
      setPartnerForm({ name: '', type: 'ngo', contactPerson: '', phone: '', email: '', districtId: '', notes: '' });
      fetchPartners();
    } catch (err) {
      setPartnerError(err.response?.data?.error || 'Failed to save partner');
    }
  };

  const handleDeletePartner = async (id) => {
    if (!window.confirm('Deactivate this partner?')) return;
    try {
      await axios.delete(`${API}/partners/${id}`, { headers });
      fetchPartners();
    } catch (err) { console.error('Delete partner error:', err); }
  };

  const handleEditPartner = (p) => {
    setEditingPartner(p);
    setPartnerForm({ name: p.name, type: p.type, contactPerson: p.contact_person, phone: p.phone || '', email: p.email || '', districtId: p.district_id || '', notes: p.notes || '' });
    setShowPartnerForm(true);
  };

  // ── KPI Target Save ──
  const handleKpiSave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/kpis/targets`, { ...kpiTargetForm, targetMonth: kpiMonth }, { headers });
      setKpiSaveMsg('Targets saved!');
      setShowKpiForm(false);
      setTimeout(() => setKpiSaveMsg(''), 3000);
      fetchKpiActuals();
    } catch (err) { console.error('KPI save error:', err); }
  };

  // ── Visit CRUD ──
  const handleVisitSubmit = async (e) => {
    e.preventDefault();
    setVisitFormError('');
    try {
      if (editingVisit) {
        await axios.put(`${API}/pd/visits/${editingVisit.id}`, visitForm, { headers });
      } else {
        await axios.post(`${API}/pd/visits`, visitForm, { headers });
      }
      setShowVisitForm(false);
      setEditingVisit(null);
      setVisitForm({ visitDate: '', place: '', keyObservations: '', areasForImprovement: '', remarks: '' });
      fetchVisits();
    } catch (err) {
      setVisitFormError(err.response?.data?.error || 'Failed to save visit');
    }
  };
  const handleEditVisit = (v) => {
    setEditingVisit(v);
    setVisitForm({ visitDate: v.visit_date?.slice(0, 10), place: v.place, keyObservations: v.key_observations || '', areasForImprovement: v.areas_for_improvement || '', remarks: v.remarks || '' });
    setShowVisitForm(true);
  };
  const handleDeleteVisit = async (id) => {
    if (!window.confirm('Delete this visit record?')) return;
    try {
      await axios.delete(`${API}/pd/visits/${id}`, { headers });
      fetchVisits();
    } catch (err) { console.error('Delete visit error:', err); }
  };

  // ── Stock Add ──
  const handleStockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/pd/eyeglass-stock`, stockForm, { headers });
      setStockMsg('Stock added!');
      setShowStockForm(false);
      setStockForm({ colorId: '', quantity: '', notes: '' });
      setTimeout(() => setStockMsg(''), 3000);
      fetchEyeglassStock();
    } catch (err) {
      setStockMsg(err.response?.data?.error || 'Failed to add stock');
    }
  };
  const handleColorSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/pd/eyeglass-colors`, colorForm, { headers });
      setShowColorForm(false);
      setColorForm({ name: '', hexCode: '#000000', emoji: '' });
      fetchColors();
      fetchEyeglassStock();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add color');
    }
  };

  // ── Allocation Submit ──
  const handleAllocSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/pd/fo-allocations`, allocForm, { headers });
      setAllocMsg('Allocated successfully!');
      setShowAllocForm(false);
      setAllocForm({ foId: '', colorId: '', quantity: '', notes: '' });
      setTimeout(() => setAllocMsg(''), 3000);
      fetchFoAllocations();
      fetchEyeglassStock();
    } catch (err) {
      setAllocMsg(err.response?.data?.error || 'Allocation failed');
    }
  };

  // ── Distribution Submit ──
  const handleDistSubmit = async (e) => {
    e.preventDefault();
    if (!distProofFile) {
      setDistFormError('Proof upload is mandatory. Please attach a photo or document.');
      return;
    }
    setDistSubmitting(true);
    setDistFormError('');
    try {
      const fd = new FormData();
      Object.entries(distForm).forEach(([k, v]) => { if (v) fd.append(k, v); });
      fd.append('proof', distProofFile);
      await axios.post(`${API}/pd/distributions`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      setShowDistForm(false);
      setDistForm({ foId: '', colorId: '', quantity: '', patientName: '', patientPhone: '', patientDetails: '', distributionDate: '', notes: '' });
      setDistProofFile(null);
      fetchDistributions();
      fetchFoAllocations();
    } catch (err) {
      setDistFormError(err.response?.data?.error || 'Distribution failed');
    }
    setDistSubmitting(false);
  };

  // ── Export helpers ──
  const handleExport = (endpoint, filename) => {
    window.open(`${API}/${endpoint}?token=${token}`, '_blank');
    // Fallback: use axios for download
    axios.get(`${API}/${endpoint}`, { headers, responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => console.error('Export error:', err));
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatCurrency = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN');
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading Program Director workspace...</p>
        </div>
      </div>
    );
  }

  const { counts, screeningStats, financials, districtPerformance, revenueByDistrict, monthlyScreenings, monthlyDispensings, appPipeline } = pdData || {};

  // Pipeline data for chart
  const pipelineData = appPipeline ? appPipeline.map(s => ({ name: s.status.replace(/_/g, ' '), value: s.count })) : [];
  const PIPELINE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#22c55e', '#ef4444'];

  const sidebarItems = [
    { key: 'overview', label: 'State Overview', icon: Activity },
    { key: 'financial', label: 'Financial Tracking', icon: DollarSign },
    { key: 'partners', label: 'Partner Management', icon: Handshake },
    { key: 'kpi', label: 'KPI Tracker', icon: Target },
    { key: 'visits', label: 'Field Visits', icon: MapPin },
    { key: 'eyeglass-inventory', label: 'Eyeglass Inventory', icon: Glasses },
    { key: 'fo-allocation', label: 'FO Allocations', icon: PackageCheck },
    { key: 'distribution', label: 'Distribution', icon: Send },
    { key: 'pd-analytics', label: 'Analytics Dashboard', icon: PieChartIcon },
  ];

  // Pie chart colors for analytics
  const ANALYTICS_PIE_COLORS = ['#EF4444', '#92400E', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

  // KPI progress helper
  const KpiBar = ({ label, actual, target }) => {
    const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">{label}</span>
          <span className="text-slate-400">{actual} / {target || '—'}</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  // Pagination helper
  const Pagination = ({ page, total, limit, setPage }) => {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-2 pt-4">
        <span className="text-xs text-slate-400 font-medium">{total} record{total !== 1 ? 's' : ''}</span>
        <div className="flex items-center space-x-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs font-bold text-slate-600">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row">

      {/* ── Sidebar ── */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between flex-shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 text-center">
            <span className="text-indigo-400 font-extrabold text-2xl tracking-widest block">SAVIESS</span>
            <span className="text-slate-400 text-[10px] tracking-wider uppercase mt-1 block font-medium">Program Director</span>
          </div>
          <nav className="p-4 space-y-1">
            {sidebarItems.map(item => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all ${
                    active
                      ? 'bg-slate-800/80 text-indigo-400 border-l-4 border-indigo-500'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
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
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Program Director Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">State-level monitoring, partner management, KPI & financial tracking</p>
          </div>
          <div className="flex items-center space-x-3 bg-white p-2 rounded-xl border shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-600">
              {sidebarItems.find(i => i.key === activeSection)?.label || 'State Overview'}
            </span>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: STATE OVERVIEW                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'overview' && (
          <>
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              {[
                { label: 'Total RHPs', value: counts?.totalRhps, sub: `${counts?.activeRhps || 0} active`, icon: Users, accent: 'bg-indigo-50 text-indigo-600' },
                { label: 'Field Officers', value: counts?.totalFos, sub: `${counts?.activeFos || 0} active`, icon: UserCheck, accent: 'bg-teal-50 text-teal-600' },
                { label: 'Partners', value: counts?.totalPartners, sub: `${counts?.activePartners || 0} active`, icon: Handshake, accent: 'bg-violet-50 text-violet-600' },
                { label: 'Screenings', value: screeningStats?.total, sub: `${screeningStats?.referrals || 0} referrals`, icon: Eye, accent: 'bg-blue-50 text-blue-600' },
                { label: 'Glasses Sold', value: financials?.glassesSold, sub: formatCurrency(financials?.totalCollected), icon: Sparkles, accent: 'bg-purple-50 text-purple-600' },
                { label: 'Revenue', value: formatCurrency(financials?.totalRevenue), sub: `${formatCurrency(financials?.outstanding)} due`, icon: TrendingUp, accent: 'bg-emerald-50 text-emerald-600', isText: true },
              ].map((card, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{card.label}</span>
                    <div className={`p-2 rounded-lg ${card.accent} group-hover:scale-110 transition-transform`}><card.icon className="w-5 h-5" /></div>
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl font-black text-slate-900">{card.isText ? card.value : (card.value || 0)}</span>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* District Performance Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  <span>District Performance Breakdown</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      <th className="th-cell">District</th>
                      <th className="th-cell">RHP Count</th>
                      <th className="th-cell">Total Screened</th>
                      <th className="th-cell">Total Dispensed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(districtPerformance || []).map((d, i) => (
                      <tr key={d.district_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="td-cell font-semibold text-slate-800">{d.district_name}</td>
                        <td className="td-cell"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{d.rhp_count}</span></td>
                        <td className="td-cell font-semibold">{d.total_screened}</td>
                        <td className="td-cell font-semibold text-purple-700">{d.total_dispensed}</td>
                      </tr>
                    ))}
                    {(!districtPerformance || districtPerformance.length === 0) && (
                      <tr><td colSpan="4" className="text-center py-12 text-slate-400 text-sm">No district data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monthly Screenings Trend */}
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6">Monthly Screening Trends</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyScreenings || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line type="monotone" dataKey="count" name="Screenings" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Dispensings + Revenue */}
              <div className="bg-white p-5 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6">Monthly Dispensings & Revenue</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyDispensings || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar dataKey="count" name="Glasses Sold" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revenue" name="Revenue (₹)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Application Pipeline */}
            {pipelineData.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6">RHP Application Pipeline</h3>
                <div className="flex flex-wrap gap-4 items-center">
                  {pipelineData.map((entry, i) => (
                    <div key={i} className="flex items-center space-x-3 bg-slate-50 px-4 py-3 rounded-xl border">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIPELINE_COLORS[i % PIPELINE_COLORS.length] }} />
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{entry.name}</p>
                        <p className="text-xl font-black text-slate-900">{entry.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: FINANCIAL TRACKING                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'financial' && (
          <>
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total Revenue', value: formatCurrency(financials?.totalRevenue), icon: DollarSign, accent: 'text-emerald-600 bg-emerald-50' },
                { label: 'Collected', value: formatCurrency(financials?.totalCollected), icon: CheckCircle, accent: 'text-blue-600 bg-blue-50' },
                { label: 'Outstanding', value: formatCurrency(financials?.outstanding), icon: AlertTriangle, accent: 'text-amber-600 bg-amber-50' },
                { label: 'Subsidies Given', value: formatCurrency(financials?.totalSubsidy), icon: Sparkles, accent: 'text-purple-600 bg-purple-50' },
              ].map((c, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{c.label}</span>
                    <div className={`p-2 rounded-lg ${c.accent}`}><c.icon className="w-5 h-5" /></div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 mt-4">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Training Fees */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Training Fees Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                    <span className="text-sm font-semibold text-slate-600">Total Charged</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrency(financials?.trainingFeesCharged)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                    <span className="text-sm font-semibold text-slate-600">Total Paid</span>
                    <span className="text-lg font-black text-emerald-700">{formatCurrency(financials?.trainingFeesPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-sm font-semibold text-amber-700">Pending</span>
                    <span className="text-lg font-black text-amber-700">{formatCurrency((financials?.trainingFeesCharged || 0) - (financials?.trainingFeesPaid || 0))}</span>
                  </div>
                </div>
              </div>

              {/* Revenue by District */}
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Revenue by District</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th-cell">District</th>
                        <th className="th-cell">Sold</th>
                        <th className="th-cell">Revenue</th>
                        <th className="th-cell">Collected</th>
                        <th className="th-cell">Subsidy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(revenueByDistrict || []).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="td-cell font-semibold text-slate-800">{r.district_name}</td>
                          <td className="td-cell">{r.glasses_sold}</td>
                          <td className="td-cell font-semibold">{formatCurrency(r.total_cost)}</td>
                          <td className="td-cell font-semibold text-emerald-700">{formatCurrency(r.total_paid)}</td>
                          <td className="td-cell text-purple-600">{formatCurrency(r.total_subsidy)}</td>
                        </tr>
                      ))}
                      {(!revenueByDistrict || revenueByDistrict.length === 0) && (
                        <tr><td colSpan="5" className="text-center py-12 text-slate-400 text-sm">No revenue data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: PARTNER MANAGEMENT                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'partners' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <Handshake className="w-5 h-5 text-indigo-500" />
                <span>Partner Organizations</span>
              </h2>
              <button
                onClick={() => { setShowPartnerForm(true); setEditingPartner(null); setPartnerForm({ name: '', type: 'ngo', contactPerson: '', phone: '', email: '', districtId: '', notes: '' }); }}
                className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /><span>Add Partner</span>
              </button>
            </div>

            {/* Partner Form Modal */}
            {showPartnerForm && (
              <div className="bg-white rounded-2xl border shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">{editingPartner ? 'Edit Partner' : 'New Partner'}</h3>
                  <button onClick={() => { setShowPartnerForm(false); setPartnerError(''); }} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                {partnerError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{partnerError}</div>}
                <form onSubmit={handlePartnerSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Organization Name *</label>
                    <input required value={partnerForm.name} onChange={e => setPartnerForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="VisionSpring" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                    <select value={partnerForm.type} onChange={e => setPartnerForm(p => ({ ...p, type: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="ngo">NGO</option>
                      <option value="hospital">Hospital</option>
                      <option value="government">Government</option>
                      <option value="corporate">Corporate</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Person *</label>
                    <input required value={partnerForm.contactPerson} onChange={e => setPartnerForm(p => ({ ...p, contactPerson: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Rajesh Kumar" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                    <input value={partnerForm.phone} onChange={e => setPartnerForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="+91..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                    <input type="email" value={partnerForm.email} onChange={e => setPartnerForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="contact@org.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">District</label>
                    <select value={partnerForm.districtId} onChange={e => setPartnerForm(p => ({ ...p, districtId: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">All / Unassigned</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                    <textarea value={partnerForm.notes} onChange={e => setPartnerForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm resize-none" placeholder="Partnership details..." />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl transition-all shadow-md">
                      {editingPartner ? 'Update Partner' : 'Create Partner'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Partners Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {partnerLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr>
                        <th className="th-cell">Organization</th>
                        <th className="th-cell">Type</th>
                        <th className="th-cell">Contact</th>
                        <th className="th-cell">Phone</th>
                        <th className="th-cell">District</th>
                        <th className="th-cell">Status</th>
                        <th className="th-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-16">
                          <div className="flex flex-col items-center space-y-3">
                            <Handshake className="w-10 h-10 text-slate-300" />
                            <p className="text-slate-400 text-sm">No partners registered yet</p>
                          </div>
                        </td></tr>
                      ) : partners.map((p, i) => (
                        <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="td-cell font-semibold text-slate-800">{p.name}</td>
                          <td className="td-cell"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">{p.type}</span></td>
                          <td className="td-cell">{p.contact_person}</td>
                          <td className="td-cell text-xs">{p.phone || '—'}</td>
                          <td className="td-cell">{p.district_name || '—'}</td>
                          <td className="td-cell">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{p.status}</span>
                          </td>
                          <td className="td-cell">
                            <div className="flex items-center space-x-2">
                              <button onClick={() => handleEditPartner(p)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition-all"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeletePartner(p.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                            </div>
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
        {/* SECTION: KPI TRACKER                                                */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'kpi' && (
          <>
            {/* Month Selector & Set Targets Button */}
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <Target className="w-5 h-5 text-indigo-500" />
                <span>KPI Targets vs Actuals</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="month"
                  value={kpiMonth.slice(0, 7)}
                  onChange={e => setKpiMonth(e.target.value + '-01')}
                  className="px-3 py-2 border rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-sm"
                />
                <button
                  onClick={() => setShowKpiForm(!showKpiForm)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all"
                >
                  <Target className="w-4 h-4" /><span>Set Targets</span>
                </button>
              </div>
            </div>

            {kpiSaveMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" /><span>{kpiSaveMsg}</span>
              </div>
            )}

            {/* Set Target Form */}
            {showKpiForm && (
              <form onSubmit={handleKpiSave} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Set Monthly Targets for {kpiMonth.slice(0, 7)}</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">District *</label>
                    <select required value={kpiTargetForm.districtId} onChange={e => setKpiTargetForm(p => ({ ...p, districtId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select...</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Screenings</label>
                    <input type="number" value={kpiTargetForm.screeningsTarget} onChange={e => setKpiTargetForm(p => ({ ...p, screeningsTarget: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dispensings</label>
                    <input type="number" value={kpiTargetForm.dispensingsTarget} onChange={e => setKpiTargetForm(p => ({ ...p, dispensingsTarget: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RHP Onboarding</label>
                    <input type="number" value={kpiTargetForm.rhpOnboardingTarget} onChange={e => setKpiTargetForm(p => ({ ...p, rhpOnboardingTarget: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revenue (₹)</label>
                    <input type="number" value={kpiTargetForm.revenueTarget} onChange={e => setKpiTargetForm(p => ({ ...p, revenueTarget: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">Save Targets</button>
              </form>
            )}

            {/* KPI Cards per District */}
            {kpiLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {kpiActuals.map((d, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-bold text-slate-800 text-lg">{d.districtName}</h3>
                      <Building2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="space-y-4">
                      <KpiBar label="Screenings" actual={d.screenings.actual} target={d.screenings.target} />
                      <KpiBar label="Dispensings" actual={d.dispensings.actual} target={d.dispensings.target} />
                      <KpiBar label="RHP Onboarding" actual={d.rhpOnboarding.actual} target={d.rhpOnboarding.target} />
                      <KpiBar label="Revenue" actual={d.revenue.actual} target={d.revenue.target} />
                    </div>
                  </div>
                ))}
                {kpiActuals.length === 0 && (
                  <div className="col-span-full text-center py-16">
                    <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No KPI data for this month</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: FIELD VISITS                                                */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'visits' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <span>Field Visit Log</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <button onClick={() => { setShowVisitForm(true); setEditingVisit(null); setVisitForm({ visitDate: new Date().toISOString().slice(0, 10), place: '', keyObservations: '', areasForImprovement: '', remarks: '' }); }}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all">
                  <Plus className="w-4 h-4" /><span>Record Visit</span>
                </button>
                <button onClick={() => handleExport('pd/visits/export', 'field_visits.xlsx')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">
                  <Download className="w-4 h-4" /><span>Export</span>
                </button>
              </div>
            </div>

            {/* Search / Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={visitSearch} onChange={e => { setVisitSearch(e.target.value); setVisitPage(1); }} placeholder="Search by place or observation..." className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-sm" />
              </div>
              <input type="date" value={visitDateStart} onChange={e => { setVisitDateStart(e.target.value); setVisitPage(1); }} className="px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-sm" />
              <input type="date" value={visitDateEnd} onChange={e => { setVisitDateEnd(e.target.value); setVisitPage(1); }} className="px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-sm" />
            </div>

            {/* Visit Form */}
            {showVisitForm && (
              <div className="bg-white rounded-2xl border shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">{editingVisit ? 'Edit Visit' : 'New Visit Record'}</h3>
                  <button onClick={() => { setShowVisitForm(false); setVisitFormError(''); }} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                {visitFormError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{visitFormError}</div>}
                <form onSubmit={handleVisitSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date of Visit *</label>
                    <input type="date" required value={visitForm.visitDate} onChange={e => setVisitForm(f => ({ ...f, visitDate: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Place of Visit *</label>
                    <input required value={visitForm.place} onChange={e => setVisitForm(f => ({ ...f, place: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="District / Village name" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Key Observations</label>
                    <textarea value={visitForm.keyObservations} onChange={e => setVisitForm(f => ({ ...f, keyObservations: e.target.value }))} rows={3} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm resize-none" placeholder="What did you observe during the visit?" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Areas for Improvement</label>
                    <textarea value={visitForm.areasForImprovement} onChange={e => setVisitForm(f => ({ ...f, areasForImprovement: e.target.value }))} rows={2} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm resize-none" placeholder="Suggestions and improvement areas..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
                    <input value={visitForm.remarks} onChange={e => setVisitForm(f => ({ ...f, remarks: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Additional remarks" />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl transition-all shadow-md">{editingVisit ? 'Update Visit' : 'Save Visit'}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Visits Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {visitLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr>
                          <th className="th-cell">Date</th>
                          <th className="th-cell">Place</th>
                          <th className="th-cell">Key Observations</th>
                          <th className="th-cell">Improvement Areas</th>
                          <th className="th-cell">Remarks</th>
                          <th className="th-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visits.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-16"><div className="flex flex-col items-center space-y-3"><MapPin className="w-10 h-10 text-slate-300" /><p className="text-slate-400 text-sm">No visits recorded yet</p></div></td></tr>
                        ) : visits.map((v, i) => (
                          <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="td-cell font-semibold text-slate-800 whitespace-nowrap">{formatDate(v.visit_date)}</td>
                            <td className="td-cell font-semibold text-indigo-700">{v.place}</td>
                            <td className="td-cell max-w-[250px] truncate" title={v.key_observations}>{v.key_observations || '—'}</td>
                            <td className="td-cell max-w-[200px] truncate" title={v.areas_for_improvement}>{v.areas_for_improvement || '—'}</td>
                            <td className="td-cell text-xs">{v.remarks || '—'}</td>
                            <td className="td-cell">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => handleEditVisit(v)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition-all"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteVisit(v.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 pb-4">
                    <Pagination page={visitPage} total={visitTotal} limit={15} setPage={setVisitPage} />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: EYEGLASS INVENTORY                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'eyeglass-inventory' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <Glasses className="w-5 h-5 text-indigo-500" />
                <span>Eyeglass Inventory</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <button onClick={() => setShowStockForm(!showStockForm)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all">
                  <Plus className="w-4 h-4" /><span>Add Stock</span>
                </button>
                <button onClick={() => setShowColorForm(!showColorForm)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">
                  <Plus className="w-4 h-4" /><span>New Color</span>
                </button>
                <button onClick={() => handleExport('pd/inventory/export', 'eyeglass_inventory.xlsx')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">
                  <Download className="w-4 h-4" /><span>Export</span>
                </button>
              </div>
            </div>

            {stockMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" /><span>{stockMsg}</span>
              </div>
            )}

            {/* Add Stock Form */}
            {showStockForm && (
              <form onSubmit={handleStockSubmit} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Add Eyeglass Stock</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Color *</label>
                    <select required value={stockForm.colorId} onChange={e => setStockForm(f => ({ ...f, colorId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select color...</option>
                      {eyeglassColors.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity *</label>
                    <input type="number" min="1" required value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                    <input value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Batch/supplier info" />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">Add Stock</button>
              </form>
            )}

            {/* Add Color Form */}
            {showColorForm && (
              <form onSubmit={handleColorSubmit} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Add New Frame Color</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Color Name *</label>
                    <input required value={colorForm.name} onChange={e => setColorForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="e.g. Green" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hex Code</label>
                    <div className="flex items-center space-x-2">
                      <input type="color" value={colorForm.hexCode} onChange={e => setColorForm(f => ({ ...f, hexCode: e.target.value }))} className="w-10 h-10 rounded-lg border cursor-pointer" />
                      <input value={colorForm.hexCode} onChange={e => setColorForm(f => ({ ...f, hexCode: e.target.value }))} className="flex-1 px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Emoji</label>
                    <input value={colorForm.emoji} onChange={e => setColorForm(f => ({ ...f, emoji: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="🟢" />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">Add Color</button>
              </form>
            )}

            {/* Stock Cards */}
            {eyeglassLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {eyeglassStock.stock.map(s => (
                    <div key={s.id} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{s.emoji}</span>
                        <div className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: s.hex_code || '#999' }} />
                      </div>
                      <p className="text-lg font-extrabold text-slate-900 mt-3">{s.quantity}</p>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.color_name} Frames</p>
                      <div className={`mt-3 h-1.5 rounded-full ${s.quantity > 50 ? 'bg-emerald-400' : s.quantity > 20 ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    </div>
                  ))}
                  {eyeglassStock.stock.length === 0 && (
                    <div className="col-span-full text-center py-16"><Glasses className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">No stock data. Run the migration first.</p></div>
                  )}
                </div>

                {/* Stock Log */}
                {eyeglassStock.log.length > 0 && (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Stock Addition History</h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead><tr><th className="th-cell">Date</th><th className="th-cell">Color</th><th className="th-cell">Qty Added</th><th className="th-cell">By</th><th className="th-cell">Notes</th></tr></thead>
                        <tbody>
                          {eyeglassStock.log.map((l, i) => (
                            <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="td-cell whitespace-nowrap">{formatDate(l.created_at)}</td>
                              <td className="td-cell"><span className="flex items-center space-x-1"><span>{l.emoji}</span><span className="font-semibold">{l.color_name}</span></span></td>
                              <td className="td-cell font-bold text-emerald-700">+{l.quantity_added}</td>
                              <td className="td-cell">{l.first_name} {l.last_name}</td>
                              <td className="td-cell text-xs">{l.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: FO ALLOCATIONS                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'fo-allocation' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-indigo-500" />
                <span>Field Officer Allocations</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <select value={selectedFoFilter} onChange={e => setSelectedFoFilter(e.target.value)} className="px-3 py-2.5 border rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-sm">
                  <option value="">All Field Officers</option>
                  {foList.map(fo => <option key={fo.fo_id} value={fo.fo_id}>{fo.first_name} {fo.last_name}</option>)}
                </select>
                <button onClick={() => setShowAllocForm(!showAllocForm)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all">
                  <Package className="w-4 h-4" /><span>Allocate</span>
                </button>
              </div>
            </div>

            {allocMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" /><span>{allocMsg}</span>
              </div>
            )}

            {/* Allocate Form */}
            {showAllocForm && (
              <form onSubmit={handleAllocSubmit} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800">Allocate Eyeglasses to Field Officer</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Field Officer *</label>
                    <select required value={allocForm.foId} onChange={e => setAllocForm(f => ({ ...f, foId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select FO...</option>
                      {foList.map(fo => <option key={fo.fo_id} value={fo.fo_id}>{fo.first_name} {fo.last_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Color *</label>
                    <select required value={allocForm.colorId} onChange={e => setAllocForm(f => ({ ...f, colorId: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select color...</option>
                      {eyeglassColors.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity *</label>
                    <input type="number" min="1" required value={allocForm.quantity} onChange={e => setAllocForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                    <input value={allocForm.notes} onChange={e => setAllocForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Reason" />
                  </div>
                </div>
                <button type="submit" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">Allocate</button>
              </form>
            )}

            {/* FO Allocation Cards */}
            {allocLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {/* Group allocations by FO */}
                {(() => {
                  const grouped = {};
                  foAllocations.allocations.forEach(a => {
                    const key = a.fo_id;
                    if (!grouped[key]) grouped[key] = { name: `${a.fo_first_name} ${a.fo_last_name}`, items: [] };
                    grouped[key].items.push(a);
                  });
                  const groups = Object.entries(grouped);
                  if (groups.length === 0) return (
                    <div className="text-center py-16"><PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">No allocations made yet</p></div>
                  );
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {groups.map(([foId, group]) => (
                        <div key={foId} className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 text-lg">{group.name}</h3>
                            <UserCheck className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div className="space-y-3">
                            {group.items.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{item.emoji}</span>
                                  <span className="text-sm font-semibold text-slate-700">{item.color_name}</span>
                                </div>
                                <span className="text-xl font-black text-slate-900">{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Allocation Log */}
                {foAllocations.log.length > 0 && (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Allocation History</h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead><tr><th className="th-cell">Date</th><th className="th-cell">Field Officer</th><th className="th-cell">Color</th><th className="th-cell">Qty</th><th className="th-cell">By</th><th className="th-cell">Notes</th></tr></thead>
                        <tbody>
                          {foAllocations.log.map((l, i) => (
                            <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="td-cell whitespace-nowrap">{formatDate(l.created_at)}</td>
                              <td className="td-cell font-semibold">{l.fo_first_name} {l.fo_last_name}</td>
                              <td className="td-cell"><span className="flex items-center space-x-1"><span>{l.emoji}</span><span>{l.color_name}</span></span></td>
                              <td className="td-cell font-bold text-indigo-700">+{l.quantity_allocated}</td>
                              <td className="td-cell text-xs">{l.performed_by_first} {l.performed_by_last}</td>
                              <td className="td-cell text-xs">{l.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: DISTRIBUTION                                               */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'distribution' && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <Send className="w-5 h-5 text-indigo-500" />
                <span>Patient Distribution</span>
              </h2>
              <div className="flex items-center space-x-2 ml-auto">
                <button onClick={() => { setShowDistForm(!showDistForm); setDistFormError(''); }}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-500/20 transition-all">
                  <Plus className="w-4 h-4" /><span>Record Distribution</span>
                </button>
                <button onClick={() => handleExport('pd/distributions/export', 'distributions.xlsx')}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md transition-all">
                  <Download className="w-4 h-4" /><span>Export</span>
                </button>
              </div>
            </div>

            {/* Distribution Form */}
            {showDistForm && (
              <div className="bg-white rounded-2xl border shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">New Distribution Record</h3>
                  <button onClick={() => { setShowDistForm(false); setDistFormError(''); }} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                {distFormError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{distFormError}</div>}
                <form onSubmit={handleDistSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Field Officer *</label>
                    <select required value={distForm.foId} onChange={e => setDistForm(f => ({ ...f, foId: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select FO...</option>
                      {foList.map(fo => <option key={fo.fo_id} value={fo.fo_id}>{fo.first_name} {fo.last_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Eyeglass Color *</label>
                    <select required value={distForm.colorId} onChange={e => setDistForm(f => ({ ...f, colorId: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm">
                      <option value="">Select color...</option>
                      {eyeglassColors.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity *</label>
                    <input type="number" min="1" required value={distForm.quantity} onChange={e => setDistForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Distribution Date *</label>
                    <input type="date" required value={distForm.distributionDate} onChange={e => setDistForm(f => ({ ...f, distributionDate: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Name</label>
                    <input value={distForm.patientName} onChange={e => setDistForm(f => ({ ...f, patientName: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Patient full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Patient Phone</label>
                    <input value={distForm.patientPhone} onChange={e => setDistForm(f => ({ ...f, patientPhone: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="+91..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes</label>
                    <input value={distForm.notes} onChange={e => setDistForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-slate-50 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Additional notes" />
                  </div>

                  {/* Mandatory Proof Upload */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Proof Upload * (Mandatory)</label>
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${distProofFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'}`}>
                      <input type="file" accept="image/*,.pdf" onChange={e => setDistProofFile(e.target.files[0])} className="hidden" id="proof-upload" />
                      <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                        {distProofFile ? (
                          <>
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                            <span className="text-sm font-semibold text-emerald-700">{distProofFile.name}</span>
                            <span className="text-xs text-emerald-500">Click to change</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-600">Click to upload proof</span>
                            <span className="text-xs text-slate-400">Patient photo, signed acknowledgment, or distribution document</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <button type="submit" disabled={distSubmitting} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center space-x-2">
                      {distSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>Submitting...</span></> : <><Send className="w-4 h-4" /><span>Submit Distribution</span></>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Distribution History */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Distribution Records</h3></div>
              {distLoading ? (
                <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead><tr><th className="th-cell">Date</th><th className="th-cell">Field Officer</th><th className="th-cell">Color</th><th className="th-cell">Qty</th><th className="th-cell">Patient</th><th className="th-cell">Proof</th></tr></thead>
                      <tbody>
                        {distributions.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-16"><div className="flex flex-col items-center space-y-3"><Send className="w-10 h-10 text-slate-300" /><p className="text-slate-400 text-sm">No distributions recorded yet</p></div></td></tr>
                        ) : distributions.map((d, i) => (
                          <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="td-cell whitespace-nowrap">{formatDate(d.distribution_date)}</td>
                            <td className="td-cell font-semibold">{d.fo_first_name} {d.fo_last_name}</td>
                            <td className="td-cell"><span className="flex items-center space-x-1"><span>{d.emoji}</span><span>{d.color_name}</span></span></td>
                            <td className="td-cell font-bold text-indigo-700">{d.quantity}</td>
                            <td className="td-cell">{d.patient_name || '—'}</td>
                            <td className="td-cell">
                              {d.proof_url ? (
                                <a href={d.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-indigo-500 hover:text-indigo-700 transition-colors">
                                  <Image className="w-4 h-4" /><span className="text-xs font-semibold">View</span><ExternalLink className="w-3 h-3" />
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 pb-4">
                    <Pagination page={distPage} total={distTotal} limit={15} setPage={setDistPage} />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SECTION: ANALYTICS DASHBOARD                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeSection === 'pd-analytics' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <PieChartIcon className="w-5 h-5 text-indigo-500" />
                <span>Analytics Dashboard</span>
              </h2>
              <button onClick={fetchAnalytics} className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all">
                <RefreshCw className="w-4 h-4" /><span>Refresh</span>
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : analytics ? (
              <>
                {/* Summary KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                  {[
                    { label: 'Total Added', value: analytics.summary.totalAdded, icon: Plus, accent: 'bg-blue-50 text-blue-600' },
                    { label: 'In Central Stock', value: analytics.summary.totalStock, icon: Package, accent: 'bg-indigo-50 text-indigo-600' },
                    { label: 'With Field Officers', value: analytics.summary.totalAllocated, icon: PackageCheck, accent: 'bg-violet-50 text-violet-600' },
                    { label: 'Distributed', value: analytics.summary.totalDistributed, icon: Send, accent: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Total Remaining', value: analytics.summary.remaining, icon: Glasses, accent: 'bg-amber-50 text-amber-600' },
                  ].map((card, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{card.label}</span>
                        <div className={`p-2 rounded-lg ${card.accent} group-hover:scale-110 transition-transform`}><card.icon className="w-5 h-5" /></div>
                      </div>
                      <p className="text-2xl font-black text-slate-900 mt-4">{card.value || 0}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Distribution by Color — Pie Chart */}
                  <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6">Distribution by Color</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={(analytics.byColor || []).map(c => ({ name: c.name, value: c.distributed }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                            {(analytics.byColor || []).map((c, i) => (
                              <Cell key={i} fill={c.hex_code || ANALYTICS_PIE_COLORS[i % ANALYTICS_PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribution by FO — Bar Chart */}
                  <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6">Inventory by Field Officer</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(analytics.byFo || []).map(f => ({ name: `${f.first_name} ${f.last_name?.charAt(0)}.`, inventory: f.current_inventory, distributed: f.total_distributed }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                          <Tooltip />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Bar dataKey="inventory" name="Current Inventory" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="distributed" name="Total Distributed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Color Breakdown Table */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Stock Breakdown by Color</h3></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead><tr><th className="th-cell">Color</th><th className="th-cell">Central Stock</th><th className="th-cell">Allocated to FOs</th><th className="th-cell">Distributed</th><th className="th-cell">Total Remaining</th></tr></thead>
                      <tbody>
                        {(analytics.byColor || []).map((c, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="td-cell font-semibold"><span className="flex items-center space-x-2"><span className="text-lg">{c.emoji}</span><span>{c.name}</span></span></td>
                            <td className="td-cell font-semibold text-indigo-700">{c.in_stock}</td>
                            <td className="td-cell font-semibold text-violet-700">{c.allocated}</td>
                            <td className="td-cell font-semibold text-emerald-700">{c.distributed}</td>
                            <td className="td-cell font-black text-slate-900">{c.in_stock + c.allocated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Distributions */}
                {analytics.recentDistributions?.length > 0 && (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Recent Distribution Activity</h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead><tr><th className="th-cell">Date</th><th className="th-cell">Field Officer</th><th className="th-cell">Color</th><th className="th-cell">Qty</th><th className="th-cell">Patient</th><th className="th-cell">Proof</th></tr></thead>
                        <tbody>
                          {analytics.recentDistributions.map((d, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="td-cell whitespace-nowrap">{formatDate(d.distribution_date)}</td>
                              <td className="td-cell font-semibold">{d.fo_first} {d.fo_last}</td>
                              <td className="td-cell"><span className="flex items-center space-x-1"><span>{d.emoji}</span><span>{d.color_name}</span></span></td>
                              <td className="td-cell font-bold text-indigo-700">{d.quantity}</td>
                              <td className="td-cell">{d.patient_name || '—'}</td>
                              <td className="td-cell">{d.proof_url ? <a href={d.proof_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700"><ExternalLink className="w-4 h-4" /></a> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Visits */}
                {analytics.recentVisits?.length > 0 && (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="px-6 pt-5 pb-3 border-b"><h3 className="font-bold text-slate-800">Recent Visit Reports</h3></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead><tr><th className="th-cell">Date</th><th className="th-cell">Place</th><th className="th-cell">Key Observations</th></tr></thead>
                        <tbody>
                          {analytics.recentVisits.map((v, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="td-cell whitespace-nowrap">{formatDate(v.visit_date)}</td>
                              <td className="td-cell font-semibold text-indigo-700">{v.place}</td>
                              <td className="td-cell max-w-[350px] truncate">{v.key_observations || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20"><PieChartIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-400 text-sm">No analytics data available</p></div>
            )}
          </>
        )}

      </main>

      {/* Inline table cell styles */}
      <style>{`
        .th-cell { padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .td-cell { padding: 10px 14px; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
      `}</style>
    </div>
  );
};

export default ProgramDirectorDashboard;
