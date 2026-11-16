import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Wallet,
  Clock,
  TrendingUp,
  Activity,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  FileText,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  Receipt,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Zap
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Dashboard state variables
  const [summary, setSummary] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [staffExpenses, setStaffExpenses] = useState<any[]>([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Read current user
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { email: 'user@company.com', role: 'STAFF', permissions: [] };
  const hasReportView = user.permissions?.includes('REPORT_VIEW') 
    || user.permissions?.includes('*') 
    || user.role === 'ADMIN' 
    || user.role === 'SUPER_ADMIN';

  const loadDashboardData = useCallback(async () => {
    setError('');
    try {
      try {
        const annRes = await api.get('/announcements');
        const activeAnns = (annRes.data.data || []).filter((a: any) => a.status === 'ACTIVE' && (!a.expiresAt || new Date(a.expiresAt) > new Date()));
        if (activeAnns.length > 0) {
          setLatestAnnouncement(activeAnns[0]);
        } else {
          setLatestAnnouncement(null);
        }
      } catch (annErr) {
        console.error('Failed to load announcements for dashboard: ', annErr);
      }

      if (hasReportView) {
        const [sumRes, cfRes, catRes] = await Promise.all([
          api.get('/reports/dashboard-summary'),
          api.get('/reports/cash-flow'),
          api.get('/reports/expenses-by-category')
        ]);
        setSummary(sumRes.data.data);
        setCashFlow(cfRes.data.data);
        setCategories(catRes.data.data.categories || []);
      } else {
        const expRes = await api.get('/expenses');
        setStaffExpenses(expRes.data.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [hasReportView]);

  // Initial load
  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // Auto-refresh every 30s
  useAutoRefresh(loadDashboardData, 30000, [hasReportView]);

  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // RENDER STAFF DASHBOARD
  if (!hasReportView) {
    const totalClaimed = staffExpenses.reduce((sum, item) => sum + item.amount, 0);
    const pendingClaims = staffExpenses.filter(e => e.status !== 'REIMBURSED' && e.status !== 'REJECTED');
    const reimbursedClaims = staffExpenses.filter(e => e.status === 'REIMBURSED');

    return (
      <div className="space-y-4 sm:space-y-8">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-[var(--card-border)] shadow-sm">
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-[var(--text-primary)]">Welcome back, {user.email.split('@')[0]}</h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1">This is your employee self-service control panel.</p>
          </div>
          <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/expenses')}
              className="flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Submit Expense</span>
            </button>
            <button
              onClick={() => navigate('/advances')}
              className="flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Request Advance</span>
            </button>
          </div>
        </div>

        {/* Latest Announcement */}
        {latestAnnouncement && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-[var(--primary)] p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm flex items-start gap-3 sm:gap-4 animate-scale-in relative overflow-hidden">
            <div className="p-1.5 sm:p-2 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg sm:rounded-xl shrink-0">
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">Latest Announcement</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">• {new Date(latestAnnouncement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1 truncate">{latestAnnouncement.title}</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 line-clamp-2">{latestAnnouncement.content}</p>
              <button 
                onClick={() => navigate('/announcements')}
                className="text-[10px] sm:text-[11px] font-bold text-[var(--primary)] hover:underline mt-1.5 sm:mt-2 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
              >
                <span>Read Full Announcement</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 sm:p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Staff KPIs - 2 columns on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-6">
          <div
            className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--primary)] transition-all flex flex-col justify-between"
            onClick={() => navigate('/expenses')}
            title="View all expense claims"
          >
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
                <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                  <span className="sm:hidden">Claims Filed</span>
                  <span className="hidden sm:inline">Total Claims Filed</span>
                </span>
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                  <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                {fmt(totalClaimed)}
              </div>
            </div>
            <div className="text-[9px] sm:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
              Submitted expenses
            </div>
          </div>

          <div
            className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--warning)] transition-all flex flex-col justify-between"
            onClick={() => navigate('/expenses')}
            title="View pending approvals"
          >
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
                <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                  Pending Approvals
                </span>
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#FFF7ED] text-[#EA580C] shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                {pendingClaims.length} Claims
              </div>
            </div>
            <div className="text-[9px] sm:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
              Awaiting review
            </div>
          </div>

          <div
            className="col-span-2 sm:col-span-1 p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--success)] transition-all flex flex-col justify-between"
            onClick={() => navigate('/expenses')}
            title="View reimbursed claims"
          >
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
                <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                  <span className="sm:hidden">Total Reimbursed</span>
                  <span className="hidden sm:inline">Total Reimbursed</span>
                </span>
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#ECFDF5] text-[#16A34A] shrink-0">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
                {fmt(reimbursedClaims.reduce((sum, item) => sum + item.amount, 0))}
              </div>
            </div>
            <div className="text-[9px] sm:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
              Settled &amp; paid
            </div>
          </div>
        </div>

        {/* Staff Recent Claims */}
        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] shrink-0" />
              <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] truncate">Your Recent Expense Requests</h3>
            </div>
            <button onClick={() => navigate('/expenses')} className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1 shrink-0">
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-[480px] sm:min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] sm:text-xs text-[var(--text-secondary)] uppercase">
                  <th className="pb-2.5 sm:pb-3">Expense Code</th>
                  <th className="pb-2.5 sm:pb-3">Purpose</th>
                  <th className="pb-2.5 sm:pb-3">Date</th>
                  <th className="pb-2.5 sm:pb-3">Status</th>
                  <th className="pb-2.5 sm:pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {staffExpenses.slice(0, 5).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 sm:py-4 font-mono font-bold text-[var(--text-primary)]">{exp.expenseNo}</td>
                    <td className="py-3 sm:py-4 text-[var(--text-primary)] font-medium">{exp.purpose}</td>
                    <td className="py-3 sm:py-4 text-[var(--text-secondary)]">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="py-3 sm:py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        exp.status === 'APPROVED' ? 'bg-emerald-50 text-[var(--success)]' :
                        exp.status === 'REIMBURSED' ? 'bg-blue-50 text-[var(--primary)]' :
                        exp.status === 'REJECTED' ? 'bg-red-50 text-[var(--danger)]' : 'bg-amber-50 text-[var(--warning)]'
                      }`}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-3 sm:py-4 text-right font-extrabold text-[var(--text-primary)]">{fmt(exp.amount)}</td>
                  </tr>
                ))}
                {staffExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 sm:py-8 text-center text-xs text-[var(--text-secondary)] font-medium">
                      No expenses submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // RENDER ADMIN / ACCOUNTS DASHBOARD
  const recentTxns = cashFlow?.transactions || [];

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Welcome Message with Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-[var(--card-border)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-2xl font-extrabold text-[var(--text-primary)]">
              Welcome back, {user.email.split('@')[0]}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1">
            Real-time financial pulse, live attendance roster, and operational workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/vouchers')}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Create Voucher</span>
          </button>
          <button
            type="button"
            onClick={() => loadDashboardData()}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 shrink-0" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Latest Announcement */}
      {latestAnnouncement && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-[var(--primary)] p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm flex items-start gap-3 sm:gap-4 animate-scale-in relative overflow-hidden">
          <div className="p-1.5 sm:p-2 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg sm:rounded-xl shrink-0">
            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">Latest Announcement</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">• {new Date(latestAnnouncement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1 truncate">{latestAnnouncement.title}</h4>
            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 sm:mt-1 line-clamp-2">{latestAnnouncement.content}</p>
            <button 
              onClick={() => navigate('/announcements')}
              className="text-[10px] sm:text-[11px] font-bold text-[var(--primary)] hover:underline mt-1.5 sm:mt-2 flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
            >
              <span>Read Full Announcement</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 sm:p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Operations & Workflows Hub */}
      <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-[var(--card-border)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Quick Operations & Shortcuts
            </h3>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">1-Click Actions</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Action 1: Create Voucher */}
          <button
            type="button"
            onClick={() => navigate('/vouchers')}
            className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition-all cursor-pointer text-left flex flex-col justify-between group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-white group-hover:bg-emerald-600 text-slate-700 group-hover:text-white transition-colors shadow-2xs border border-slate-200/60 group-hover:border-emerald-600">
                <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 block truncate">
                Payment Voucher
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block mt-0.5 line-clamp-1">
                Record Inflow / Outflow
              </span>
            </div>
          </button>

          {/* Action 2: Attendance & Shifts */}
          <button
            type="button"
            onClick={() => navigate('/attendance')}
            className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition-all cursor-pointer text-left flex flex-col justify-between group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-white group-hover:bg-emerald-600 text-slate-700 group-hover:text-white transition-colors shadow-2xs border border-slate-200/60 group-hover:border-emerald-600">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 block truncate">
                Live Attendance
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block mt-0.5 line-clamp-1">
                Punches, Shifts & Geofence
              </span>
            </div>
          </button>

          {/* Action 3: Review Approvals */}
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/60 border border-slate-200/80 hover:border-amber-300 transition-all cursor-pointer text-left flex flex-col justify-between group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-white group-hover:bg-amber-600 text-slate-700 group-hover:text-white transition-colors shadow-2xs border border-slate-200/60 group-hover:border-amber-600">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800">
                {summary?.pendingApprovalsCount || 0} reqs
              </span>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-700 block truncate">
                Approval Queue
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block mt-0.5 line-clamp-1">
                Claims & Salary Advances
              </span>
            </div>
          </button>

          {/* Action 4: Financial Reports */}
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer text-left flex flex-col justify-between group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-white group-hover:bg-blue-600 text-slate-700 group-hover:text-white transition-colors shadow-2xs border border-slate-200/60 group-hover:border-blue-600">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-700 block truncate">
                Financial Reports
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block mt-0.5 line-clamp-1">
                Cash Flow, P&L & Audits
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* KPI Grid - 2 of 2 pair on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {/* Card 1: Total Balance */}
        <div
          className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--primary)] transition-all cursor-pointer flex flex-col justify-between"
          onClick={() => navigate('/accounts')}
          title="View Bank & Cash Accounts"
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
              <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                <span className="sm:hidden">Net Liquidity</span>
                <span className="hidden sm:inline">Net Company Liquidity</span>
              </span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate" title={fmt(summary?.netLiquidity || 0)}>
              {fmt(summary?.netLiquidity || 0)}
            </div>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
            <span className="sm:hidden">Bank &amp; Cash Accounts</span>
            <span className="hidden sm:inline">Active Bank &amp; Cash Account Balances</span>
          </div>
        </div>

        {/* Card 2: Total Income */}
        <div
          className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--success)] transition-all cursor-pointer flex flex-col justify-between"
          onClick={() => navigate('/reports')}
          title="View Cash Flow Reports"
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
              <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                <span className="sm:hidden">Money In</span>
                <span className="hidden sm:inline">Total Money In</span>
              </span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#ECFDF5] text-[#16A34A] shrink-0">
                <ArrowUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate" title={fmt(summary?.totalMoneyIn || 0)}>
              {fmt(summary?.totalMoneyIn || 0)}
            </div>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
            <span className="sm:hidden">Confirmed Inflow</span>
            <span className="hidden sm:inline">Total Confirmed Cash Inflow</span>
          </div>
        </div>

        {/* Card 3: Total Expenses */}
        <div
          className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--danger)] transition-all cursor-pointer flex flex-col justify-between"
          onClick={() => navigate('/reports')}
          title="View Cash Flow & Expense Reports"
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
              <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                <span className="sm:hidden">Money Out</span>
                <span className="hidden sm:inline">Total Money Out</span>
              </span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#FEF2F2] text-[#DC2626] shrink-0">
                <ArrowDown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate" title={fmt(summary?.totalMoneyOut || 0)}>
              {fmt(summary?.totalMoneyOut || 0)}
            </div>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
            <span className="sm:hidden">Expenses &amp; Payouts</span>
            <span className="hidden sm:inline">Expenses, Payroll &amp; Payouts</span>
          </div>
        </div>

        {/* Card 4: Pending / Outstanding */}
        <div
          className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--warning)] transition-all cursor-pointer flex flex-col justify-between"
          onClick={() => navigate('/expenses')}
          title="View Pending Expense Claims & Approvals"
        >
          <div>
            <div className="flex items-start justify-between gap-1.5 mb-2 sm:mb-4">
              <span className="text-[11px] sm:text-sm text-[var(--text-secondary)] font-semibold leading-tight line-clamp-2">
                Pending Approvals
              </span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#FFF7ED] text-[#EA580C] shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight truncate">
              {summary?.pendingApprovalsCount || 0} reqs
            </div>
          </div>
          <div className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-1.5 sm:mt-2 truncate">
            Claims: {summary?.pendingBreakdown?.expenses || 0} · Adv: {summary?.pendingBreakdown?.advances || 0}
          </div>
        </div>
      </div>

      {/* Main Dashboard section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
        
        {/* Left Section: Ledger Entries (col-span-8) */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-8">
          
          {/* Recent transactions */}
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] shrink-0" />
                <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] truncate">Recent Ledger Entries</h3>
              </div>
              <button onClick={() => navigate('/ledger')} className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1 shrink-0">
                <span>View Full</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="min-w-[480px] sm:min-w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] sm:text-xs text-[var(--text-secondary)] uppercase">
                    <th className="pb-2.5 sm:pb-3">Voucher No</th>
                    <th className="pb-2.5 sm:pb-3">Category</th>
                    <th className="pb-2.5 sm:pb-3">Payment Mode</th>
                    <th className="pb-2.5 sm:pb-3">Date</th>
                    <th className="pb-2.5 sm:pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recentTxns.slice(0, 5).map((txn: any) => (
                    <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 sm:py-4 font-mono font-bold text-[var(--text-primary)]">{txn.transactionNo || 'TXN-NEW'}</td>
                      <td className="py-3 sm:py-4">
                        <span className="text-[var(--text-primary)] font-semibold">{txn.category}</span>
                        <span className={`block text-[9px] font-bold mt-0.5 ${
                          txn.type === 'PAYMENT_IN' ? 'text-[var(--success)]' :
                          txn.type === 'REVERSAL' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                        }`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-3 sm:py-4 text-xs text-[var(--text-secondary)] font-medium">{txn.paymentMode}</td>
                      <td className="py-3 sm:py-4 text-xs text-[var(--text-secondary)]">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className={`py-3 sm:py-4 text-right font-extrabold ${
                        txn.type === 'PAYMENT_IN' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                      }`}>
                        {txn.type === 'PAYMENT_IN' ? '+' : '-'}{fmt(txn.amount)}
                      </td>
                    </tr>
                  ))}
                  {recentTxns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 sm:py-8 text-center text-xs text-[var(--text-secondary)] font-medium">
                        No transactions registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Income vs Expense comparison bar */}
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mb-3 sm:mb-4">Cash Flow Balance Chart</h3>
            
            {/* Custom visual ratio */}
            {summary && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between text-xs font-semibold gap-1 sm:gap-0">
                  <span className="text-[var(--success)] font-bold">Total Inflow: {fmt(summary.totalMoneyIn)}</span>
                  <span className="text-[var(--danger)] font-bold">Total Outflow: {fmt(summary.totalMoneyOut)}</span>
                </div>
                
                {/* Horizontal comparative progress bar */}
                {(() => {
                  const total = summary.totalMoneyIn + summary.totalMoneyOut;
                  const incomePct = total > 0 ? (summary.totalMoneyIn / total) * 100 : 50;
                  const expensePct = total > 0 ? (summary.totalMoneyOut / total) * 100 : 50;

                  return (
                    <div className="w-full h-3.5 sm:h-4 rounded-full overflow-hidden flex bg-slate-100">
                      <div style={{ width: `${incomePct}%` }} className="bg-[var(--success)] h-full transition-all duration-500" title={`Income: ${incomePct.toFixed(1)}%`} />
                      <div style={{ width: `${expensePct}%` }} className="bg-[var(--danger)] h-full transition-all duration-500" title={`Expense: ${expensePct.toFixed(1)}%`} />
                    </div>
                  );
                })()}

                <div className="flex flex-col sm:flex-row justify-between text-[10px] text-[var(--text-secondary)] mt-1 sm:mt-1.5 font-medium gap-0.5 sm:gap-0">
                  <span>Net Ledger Surplus: {fmt(summary.totalMoneyIn - summary.totalMoneyOut)}</span>
                  <span>Ratio In vs Out</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Summaries & Expense Categories (col-span-4) */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-8">
          
          {/* Top Expense Categories */}
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mb-3 sm:mb-4">Expense Category Summary</h3>
            
            <div className="space-y-3 sm:space-y-4">
              {categories.slice(0, 5).map((cat) => (
                <div key={cat.id} className="space-y-1 sm:space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-primary)] truncate mr-2">{cat.name}</span>
                    <span className="text-[var(--primary)] font-bold shrink-0">{fmt(cat.totalAmount)}</span>
                  </div>
                  
                  {/* Category Progress Fill */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, cat.percentage || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-[var(--text-secondary)] font-medium">
                    <span>{cat.count} claims submitted</span>
                    <span>{Math.round(cat.percentage || 0)}% of expenses</span>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-4 sm:py-6 text-xs text-[var(--text-secondary)] font-medium">
                  No expense category entries recorded.
                </div>
              )}
            </div>
          </div>

          {/* Monthly Finance Summary Box */}
          <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[var(--card-border)] shadow-sm flex flex-col justify-between min-h-auto sm:min-h-[220px]">
            <div>
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">Monthly Cash Flow Status</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                The unified ledger tracks transactions dynamically. Real-time bank settlements and automated voucher audit compliance logs are active.
              </p>
              
              {cashFlow && (
                <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-[var(--card-border)]">
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-primary)]">
                    <span>Net Monthly Flow:</span>
                    <span className={cashFlow.netFlow >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                      {cashFlow.netFlow >= 0 ? '+' : ''}{fmt(cashFlow.netFlow)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[var(--border)] text-center">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--primary-light)] px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-inner">
                Active & Audited
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
