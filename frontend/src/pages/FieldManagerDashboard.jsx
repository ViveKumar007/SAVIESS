import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users, UserCheck, MapPin, LogOut, Activity, ClipboardList, FileText,
  CheckCircle, XCircle, Clock, AlertTriangle, GraduationCap, Package,
  ChevronDown, ChevronUp, Search, Calendar, MessageSquare, Send,
  Eye, Stethoscope, UserPlus, X, ChevronLeft, ChevronRight, Truck, ShieldCheck
} from 'lucide-react';

import { API } from '../api';

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

  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchFmSummary(); }, []);

  useEffect(() => {
    if (activeSection === 'reports') fetchReports();
    if (activeSection === 'onboarding') fetchApplications();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'reports') fetchReports();
  }, [reportsPage, reportFilter]);

  useEffect(() => {
    if (activeSection === 'onboarding') fetchApplications();
  }, [appStatusFilter]);

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

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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
  };

  const getStatusBadge = (status) => {
    const cls = statusColors[status] || 'bg-slate-100 text-slate-500 border-slate-200';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{status?.replace(/_/g, ' ')}</span>;
  };

  const reportPages = Math.ceil(reportsTotal / 20) || 1;

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
              <div className="px-6 pt-6 pb-4 border-b">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-teal-500" />
                  <span>Managed Field Officers</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">{managedFos?.length || 0}</span>
                </h2>
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

      {/* Table cell styles */}
      <style>{`
        .th-cell { padding: 10px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .td-cell { padding: 10px 14px; font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
      `}</style>
    </div>
  );
};

export default FieldManagerDashboard;
