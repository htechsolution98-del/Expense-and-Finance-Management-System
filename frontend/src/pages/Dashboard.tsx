import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Wallet,
  Clock,
  TrendingUp,
  Activity,
  HeartPulse,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState('');

  // Dashboard state variables
  const [summary, setSummary] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [staffExpenses, setStaffExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Read current user
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { email: 'user@company.com', role: 'STAFF', permissions: [] };
  const hasReportView = user.permissions?.includes('REPORT_VIEW') 
    || user.permissions?.includes('*') 
    || user.role === 'ADMIN' 
    || user.role === 'SUPER_ADMIN';

  const testApiConnection = async () => {
    setLoadingHealth(true);
    setHealthError('');
    setHealthData(null);
    try {
      const response = await api.get('/health');
      setHealthData(response.data);
    } catch (err: any) {
      setHealthError(err.message || 'Failed to connect to the backend server.');
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadDashboardData = useCallback(async () => {
    setError('');
    try {
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
      <div className="space-y-8">
        {/* Welcome */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--card-border)] shadow-sm">
          <div>
            <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Welcome back, {user.email.split('@')[0]}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">This is your employee self-service control panel.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/expenses')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <PlusCircle className="w-4 h-4" />
              Submit Expense
            </button>
            <button
              onClick={() => navigate('/advances')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Request Advance
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Staff KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div
            className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--primary)] transition-all"
            onClick={() => navigate('/expenses')}
            title="View all expense claims"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--text-secondary)] font-semibold">Total Claims Filed</span>
              <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{fmt(totalClaimed)}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-2">All-time submitted expenses</div>
          </div>

          <div
            className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--warning)] transition-all"
            onClick={() => navigate('/expenses')}
            title="View pending approvals"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--text-secondary)] font-semibold">Pending Approvals</span>
              <div className="p-2 rounded-xl bg-[#FFF7ED] text-[#EA580C]">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{pendingClaims.length} Claims</div>
            <div className="text-xs text-[var(--text-secondary)] mt-2">Awaiting Finance/Admin review</div>
          </div>

          <div
            className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--success)] transition-all"
            onClick={() => navigate('/expenses')}
            title="View reimbursed claims"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--text-secondary)] font-semibold">Total Reimbursed</span>
              <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#16A34A]">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {fmt(reimbursedClaims.reduce((sum, item) => sum + item.amount, 0))}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-2">Successfully settled &amp; paid</div>
          </div>
        </div>

        {/* Staff Recent Claims */}
        <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[var(--primary)]" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Your Recent Expense Requests</h3>
            </div>
            <button onClick={() => navigate('/expenses')} className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1">
              <span>View All Claims</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-secondary)] uppercase">
                  <th className="pb-3">Expense Code</th>
                  <th className="pb-3">Purpose</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {staffExpenses.slice(0, 5).map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-mono font-bold text-[var(--text-primary)]">{exp.expenseNo}</td>
                    <td className="py-4 text-[var(--text-primary)] font-medium">{exp.purpose}</td>
                    <td className="py-4 text-[var(--text-secondary)]">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        exp.status === 'APPROVED' ? 'bg-emerald-50 text-[var(--success)]' :
                        exp.status === 'REIMBURSED' ? 'bg-blue-50 text-[var(--primary)]' :
                        exp.status === 'REJECTED' ? 'bg-red-50 text-[var(--danger)]' : 'bg-amber-50 text-[var(--warning)]'
                      }`}>
                        {exp.status}
                      </span>
                    </td>
                    <td className="py-4 text-right font-extrabold text-[var(--text-primary)]">{fmt(exp.amount)}</td>
                  </tr>
                ))}
                {staffExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)] font-medium">
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
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--card-border)] shadow-sm">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Welcome back, {user.email.split('@')[0]}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Here is a real-time overview of the portal's financial metrics.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={testApiConnection}
            disabled={loadingHealth}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all cursor-pointer"
          >
            <HeartPulse className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
            <span>{loadingHealth ? 'Testing...' : 'Test Backend Connection'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Backend API Test Result Container */}
      {(healthData || healthError) && (
        <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--primary)]">
              API Connection Logs
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${healthError ? 'bg-red-50 text-[var(--danger)]' : 'bg-emerald-50 text-[var(--success)]'}`}>
              {healthError ? 'ERROR' : 'SUCCESS'}
            </span>
          </div>
          {healthError && (
            <p className="text-sm text-[var(--danger)]">{healthError}</p>
          )}
          {healthData && (
            <pre className="text-xs font-mono text-emerald-700 bg-emerald-50/50 p-4 rounded-xl overflow-x-auto border border-emerald-100">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Balance */}
        <div
          className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--primary)] transition-all cursor-pointer"
          onClick={() => navigate('/accounts')}
          title="View Bank & Cash Accounts"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)] font-semibold">Net Company Liquidity</span>
            <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {fmt(summary?.netLiquidity || 0)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-2">Active Bank &amp; Cash Account Balances</div>
        </div>

        {/* Card 2: Total Income */}
        <div
          className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--success)] transition-all cursor-pointer"
          onClick={() => navigate('/reports')}
          title="View Cash Flow Reports"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)] font-semibold">Total Money In</span>
            <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#16A34A]">
              <ArrowUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {fmt(summary?.totalMoneyIn || 0)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-2">Total Confirmed Cash Inflow</div>
        </div>

        {/* Card 3: Total Expenses */}
        <div
          className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--danger)] transition-all cursor-pointer"
          onClick={() => navigate('/reports')}
          title="View Cash Flow & Expense Reports"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)] font-semibold">Total Money Out</span>
            <div className="p-2 rounded-xl bg-[#FEF2F2] text-[#DC2626]">
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {fmt(summary?.totalMoneyOut || 0)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-2">Expenses, Payroll &amp; Payouts</div>
        </div>

        {/* Card 4: Pending / Outstanding */}
        <div
          className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm hover:shadow-md hover:border-[var(--warning)] transition-all cursor-pointer"
          onClick={() => navigate('/expenses')}
          title="View Pending Expense Claims & Approvals"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[var(--text-secondary)] font-semibold">Pending Approvals</span>
            <div className="p-2 rounded-xl bg-[#FFF7ED] text-[#EA580C]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {summary?.pendingApprovalsCount || 0} requests
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] mt-2">
            Claims: {summary?.pendingBreakdown?.expenses || 0} · Advances: {summary?.pendingBreakdown?.advances || 0}
          </div>
        </div>
      </div>

      {/* Main Dashboard section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Section: Ledger Entries (col-span-8) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Recent transactions */}
          <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Recent Ledger Entries</h3>
              </div>
              <button onClick={() => navigate('/ledger')} className="text-xs text-[var(--primary)] hover:underline font-bold flex items-center gap-1">
                <span>View Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--text-secondary)] uppercase">
                    <th className="pb-3">Voucher No</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Payment Mode</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recentTxns.slice(0, 5).map((txn: any) => (
                    <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-mono font-bold text-[var(--text-primary)]">{txn.transactionNo || 'TXN-NEW'}</td>
                      <td className="py-4">
                        <span className="text-[var(--text-primary)] font-semibold">{txn.category}</span>
                        <span className={`block text-[9px] font-bold mt-0.5 ${
                          txn.type === 'PAYMENT_IN' ? 'text-[var(--success)]' :
                          txn.type === 'REVERSAL' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'
                        }`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-4 text-xs text-[var(--text-secondary)] font-medium">{txn.paymentMode}</td>
                      <td className="py-4 text-xs text-[var(--text-secondary)]">{new Date(txn.date).toLocaleDateString()}</td>
                      <td className={`py-4 text-right font-extrabold ${
                        txn.type === 'PAYMENT_IN' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                      }`}>
                        {txn.type === 'PAYMENT_IN' ? '+' : '-'}{fmt(txn.amount)}
                      </td>
                    </tr>
                  ))}
                  {recentTxns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)] font-medium">
                        No transactions registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Income vs Expense comparison bar */}
          <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">Cash Flow Balance Chart</h3>
            
            {/* Custom visual ratio */}
            {summary && (
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--success)] font-bold">Total Inflow: {fmt(summary.totalMoneyIn)}</span>
                  <span className="text-[var(--danger)] font-bold">Total Outflow: {fmt(summary.totalMoneyOut)}</span>
                </div>
                
                {/* Horizontal comparative progress bar */}
                {(() => {
                  const total = summary.totalMoneyIn + summary.totalMoneyOut;
                  const incomePct = total > 0 ? (summary.totalMoneyIn / total) * 100 : 50;
                  const expensePct = total > 0 ? (summary.totalMoneyOut / total) * 100 : 50;

                  return (
                    <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100">
                      <div style={{ width: `${incomePct}%` }} className="bg-[var(--success)] h-full" title={`Income: ${incomePct.toFixed(1)}%`} />
                      <div style={{ width: `${expensePct}%` }} className="bg-[var(--danger)] h-full" title={`Expense: ${expensePct.toFixed(1)}%`} />
                    </div>
                  );
                })()}

                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">
                  <span>Net Ledger Surplus: {fmt(summary.totalMoneyIn - summary.totalMoneyOut)}</span>
                  <span>Ratio In vs Out</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Summaries & Expense Categories (col-span-4) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Top Expense Categories */}
          <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">Expense Category Summary</h3>
            
            <div className="space-y-4">
              {categories.slice(0, 5).map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-primary)]">{cat.name}</span>
                    <span className="text-[var(--primary)] font-bold">{fmt(cat.totalAmount)}</span>
                  </div>
                  
                  {/* Category Progress Fill */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] h-full rounded-full"
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
                <div className="text-center py-6 text-xs text-[var(--text-secondary)] font-medium">
                  No expense category entries recorded.
                </div>
              )}
            </div>
          </div>

          {/* Monthly Finance Summary Box */}
          <div className="p-6 rounded-2xl bg-white border border-[var(--card-border)] shadow-sm flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Monthly Cash Flow Status</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                The unified ledger tracks transactions dynamically. Real-time bank settlements and automated voucher audit compliance logs are active.
              </p>
              
              {cashFlow && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-[var(--card-border)]">
                  <div className="flex justify-between text-xs font-semibold text-[var(--text-primary)]">
                    <span>Net Monthly Flow:</span>
                    <span className={cashFlow.netFlow >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                      {cashFlow.netFlow >= 0 ? '+' : ''}{fmt(cashFlow.netFlow)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border)] text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--primary-light)] px-3 py-1 rounded-full shadow-inner">
                Active & Audited
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
