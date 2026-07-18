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
  Search, Calendar, FileText, ArrowUpRight, ArrowDownRight, Minus
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
  }, [activeSection]);

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

  // Partner CRUD
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

  // KPI Target Save
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
  ];

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
            <span className="text-xs font-semibold text-slate-600">State Overview</span>
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
