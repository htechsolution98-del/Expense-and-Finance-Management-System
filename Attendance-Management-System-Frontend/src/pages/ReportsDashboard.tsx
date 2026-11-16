import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Download,
  RefreshCw,
  TrendingUp,
  Landmark,
  Clock,
  PieChart,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardSummary {
  totalMoneyIn: number;
  totalMoneyOut: number;
  netLiquidity: number;
  pendingApprovalsCount: number;
  pendingBreakdown: { expenses: number; advances: number; bankAccounts: number };
  accounts: { id: string; name: string; type: string; currentBalance: number }[];
}

interface CashFlowData {
  totalIn: number;
  totalOut: number;
  netFlow: number;
  byMode: Record<string, { moneyIn: number; moneyOut: number }>;
  transactions: any[];
}

interface CategoryExpense {
  id: string;
  name: string;
  totalAmount: number;
  count: number;
  percentage: number;
}

interface EmployeeExpense {
  id: string;
  name: string;
  code: string;
  department: string;
  approvedAmount: number;
  pendingAmount: number;
  count: number;
}

interface SalarySummary {
  id: string;
  payrollNo: string;
  month: number;
  year: number;
  status: string;
  employeeCount: number;
  paidItemsCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  statutory: { pf: number; tds: number; professionalTax: number };
}

interface AdvanceLoanData {
  advances: {
    totalIssued: number;
    totalOutstanding: number;
    activeCount: number;
    list: any[];
  };
  loans: {
    loanMetrics: {
      id: string;
      loanNo: string;
      lender: string;
      principal: number;
      totalUtilized: number;
      unallocated: number;
      principalOutstanding: number;
      status: string;
    }[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'expenses' | 'salaries' | 'advances'>('cashflow');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [categories, setCategories] = useState<CategoryExpense[]>([]);
  const [empExpenses, setEmpExpenses] = useState<EmployeeExpense[]>([]);
  const [salaries, setSalaries] = useState<SalarySummary[]>([]);
  const [advLoans, setAdvLoans] = useState<AdvanceLoanData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReportsData = useCallback(async () => {
    try {
      setLoading(true);
      const [sumRes, cfRes, catRes, empRes, salRes, advRes] = await Promise.all([
        api.get('/reports/dashboard-summary'),
        api.get('/reports/cash-flow'),
        api.get('/reports/expenses-by-category'),
        api.get('/reports/expenses-by-employee'),
        api.get('/reports/salary-register'),
        api.get('/reports/advances-and-loans'),
      ]);

      setSummary(sumRes.data.data);
      setCashFlow(cfRes.data.data);
      setCategories(catRes.data.data.categories || []);
      setEmpExpenses(empRes.data.data.employees || []);
      setSalaries(salRes.data.data.monthlySummaries || []);
      setAdvLoans(advRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReportsData(); }, [loadReportsData]);

  // Auto-refresh reports every 30s
  useAutoRefresh(loadReportsData, 30000);

  // CSV Export Trigger — uses authenticated fetch + blob
  const handleExportCSV = async (type: string) => {
    try {
      const response = await api.get(`/reports/export?type=${type}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed. Please try again.');
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Loading Financial Analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 sm:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Executive Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time financial visibility derived directly from single-source transaction ledgers
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadReportsData}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
            <button
              onClick={() => handleExportCSV('ledger')}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
              title="Export Ledger CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Ledger CSV</span>
            </button>
            <button
              onClick={() => handleExportCSV('expenses')}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
              title="Export Expenses CSV"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Expenses CSV</span>
            </button>
            <button
              onClick={() => handleExportCSV('salaries')}
              className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-98"
              title="Export Salary CSV"
            >
              <Download className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">Salary CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Executive KPI Cards (2 of 2 pair on mobile) ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Card 1: Total Money Received */}
        <div
          onClick={() => setActiveTab('cashflow')}
          className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all border-l-4 border-l-emerald-500"
          title="View Cash Flow & Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Inflow
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-emerald-600 block truncate">
              {fmt(summary?.totalMoneyIn || 0)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Clients, loans & income</span>
          </div>
        </div>

        {/* Card 2: Total Payments Out */}
        <div
          onClick={() => setActiveTab('cashflow')}
          className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all border-l-4 border-l-indigo-500"
          title="View Cash Flow & Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Payments Out
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-indigo-600 block truncate">
              {fmt(summary?.totalMoneyOut || 0)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Expenses, payroll & vendor</span>
          </div>
        </div>

        {/* Card 3: Company Net Liquidity */}
        <div
          onClick={() => window.location.href = '/accounts'}
          className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition-all border-l-4 border-l-amber-500"
          title="View Accounts"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Net Liquidity
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-slate-900 block truncate">
              {fmt(summary?.netLiquidity || 0)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Across {summary?.accounts.length || 0} accounts</span>
          </div>
        </div>

        {/* Card 4: Pending Approvals Queue */}
        <div
          onClick={() => setActiveTab('expenses')}
          className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between cursor-pointer hover:border-rose-300 hover:shadow-md transition-all border-l-4 border-l-rose-500"
          title="View Pending Approvals"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Approvals Queue
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-rose-600 block truncate">
              {summary?.pendingApprovalsCount || 0}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
              Exp: {summary?.pendingBreakdown?.expenses || 0} · Adv: {summary?.pendingBreakdown?.advances || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
        <button
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'cashflow'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
          style={activeTab === 'cashflow' ? { color: '#ffffff' } : undefined}
          onClick={() => setActiveTab('cashflow')}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className={activeTab === 'cashflow' ? 'text-white-force' : ''}>Cash Flow & Ledger</span>
        </button>

        <button
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'expenses'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
          style={activeTab === 'expenses' ? { color: '#ffffff' } : undefined}
          onClick={() => setActiveTab('expenses')}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span className={activeTab === 'expenses' ? 'text-white-force' : ''}>
            Expense Analytics ({categories.length})
          </span>
        </button>

        <button
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'salaries'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
          style={activeTab === 'salaries' ? { color: '#ffffff' } : undefined}
          onClick={() => setActiveTab('salaries')}
        >
          <Banknote className="w-3.5 h-3.5" />
          <span className={activeTab === 'salaries' ? 'text-white-force' : ''}>
            Salary Register ({salaries.length})
          </span>
        </button>

        <button
          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'advances'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
          style={activeTab === 'advances' ? { color: '#ffffff' } : undefined}
          onClick={() => setActiveTab('advances')}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className={activeTab === 'advances' ? 'text-white-force' : ''}>
            Advances & Loans
          </span>
        </button>
      </div>

      {/* ── TAB 1: CASH FLOW & LEDGER ────────────────────────────────────────── */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Account Balances Card */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" />
                Company Bank & Cash Accounts
              </h3>
              <div className="divide-y divide-slate-100">
                {summary?.accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">{acc.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{acc.type} ACCOUNT</div>
                    </div>
                    <div className="font-black text-emerald-600 text-sm sm:text-base">{fmt(acc.currentBalance)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Mode Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Inflow / Outflow by Payment Mode
              </h3>
              <div className="divide-y divide-slate-100">
                {cashFlow?.byMode && Object.keys(cashFlow.byMode).length > 0 ? (
                  Object.entries(cashFlow.byMode).map(([mode, val]) => (
                    <div key={mode} className="flex items-center justify-between py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                        {mode}
                      </span>
                      <div className="flex items-center gap-3 text-xs sm:text-sm font-bold">
                        <span className="text-emerald-600">+ {fmt(val.moneyIn)}</span>
                        <span className="text-rose-600">- {fmt(val.moneyOut)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    No payment mode breakdown recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Ledger Audit Log */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Recent Financial Transactions Ledger
            </h3>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Tx No</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashFlow?.transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{t.transactionNo}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'PAYMENT_IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{t.category?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {new Date(t.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{t.account?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{t.purpose}</td>
                      <td className={`px-4 py-3 text-right font-black font-mono text-sm ${
                        t.type === 'PAYMENT_IN' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {t.type === 'PAYMENT_IN' ? '+' : '-'} {fmt(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< 640px) */}
            <div className="sm:hidden space-y-2.5">
              {cashFlow?.transactions?.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">No transactions found.</div>
              ) : (
                cashFlow?.transactions.map((t: any) => {
                  const isCredit = t.type === 'PAYMENT_IN';
                  return (
                    <div key={t.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900 text-xs block">{t.transactionNo}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`font-black font-mono text-sm ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isCredit ? '+' : '-'} {fmt(t.amount)}
                          </span>
                          <span className={`block text-[9px] font-bold uppercase mt-0.5 px-1.5 py-0.5 rounded-full ${
                            isCredit ? 'bg-emerald-100/70 text-emerald-700' : 'bg-rose-100/70 text-rose-700'
                          }`}>
                            {t.type}
                          </span>
                        </div>
                      </div>

                      {t.purpose && (
                        <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                          {t.purpose}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Account: <strong className="text-slate-700">{t.account?.name || '—'}</strong></span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold uppercase text-[9px]">
                          {t.category?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EXPENSE ANALYTICS ─────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Category Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-4">
                Spending by Expense Category
              </h3>
              <div className="space-y-3.5">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">
                    No approved expenses to display.
                  </div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{cat.name} ({cat.count} claims)</span>
                        <span className="font-bold text-emerald-600">{fmt(cat.totalAmount)} ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Employee Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Spending by Employee & Department
              </h3>

              {/* Desktop Table (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3 text-right">Approved Spent</th>
                      <th className="px-4 py-3 text-right">Pending Claims</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {empExpenses.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-6 text-slate-400 italic">No employee expenses found.</td></tr>
                    ) : (
                      empExpenses.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">{emp.name} ({emp.code})</td>
                          <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-bold">{fmt(emp.approvedAmount)}</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-semibold">{emp.pendingAmount > 0 ? fmt(emp.pendingAmount) : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (< 640px) */}
              <div className="sm:hidden space-y-2.5">
                {empExpenses.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic">No employee expenses found.</div>
                ) : (
                  empExpenses.map((emp) => (
                    <div key={emp.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{emp.name}</div>
                          <div className="text-[10px] text-slate-500">{emp.code} · {emp.department}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-600 text-xs block">{fmt(emp.approvedAmount)}</span>
                          <span className="text-[10px] text-slate-400">Approved</span>
                        </div>
                      </div>
                      {emp.pendingAmount > 0 && (
                        <div className="flex justify-between items-center text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                          <span>Pending Claims:</span>
                          <span className="font-bold">{fmt(emp.pendingAmount)}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SALARY REGISTER ──────────────────────────────────────────── */}
      {activeTab === 'salaries' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Monthly Payroll & Statutory Deduction Register
          </h3>

          {/* Desktop Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Batch No</th>
                  <th className="px-4 py-3">Month / Year</th>
                  <th className="px-4 py-3">Employees</th>
                  <th className="px-4 py-3 text-right">Gross Earnings</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3 text-right">PF</th>
                  <th className="px-4 py-3 text-right">TDS</th>
                  <th className="px-4 py-3 text-right">PT</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaries.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-slate-400 italic">No salary payroll runs generated yet.</td></tr>
                ) : (
                  salaries.map((sal) => (
                    <tr key={sal.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{sal.payrollNo}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{monthNames[sal.month]} {sal.year}</td>
                      <td className="px-4 py-3 text-slate-600">{sal.paidItemsCount} / {sal.employeeCount} Paid</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(sal.totalGross)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{fmt(sal.totalNet)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(sal.statutory.pf)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(sal.statutory.tds)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(sal.statutory.professionalTax)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {sal.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< 640px) */}
          <div className="sm:hidden space-y-3">
            {salaries.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No salary payroll runs generated yet.</div>
            ) : (
              salaries.map((sal) => (
                <div key={sal.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-xs block">{sal.payrollNo}</span>
                      <span className="font-bold text-slate-700 text-sm">{monthNames[sal.month]} {sal.year}</span>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      {sal.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross Earnings</span>
                      <span className="font-bold text-slate-800 text-xs mt-0.5 block">{fmt(sal.totalGross)}</span>
                    </div>
                    <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold block">Net Payable</span>
                      <span className="font-black text-emerald-700 text-xs mt-0.5 block">{fmt(sal.totalNet)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-200/50">
                    <span>Disbursed: <strong className="text-slate-700">{sal.paidItemsCount}/{sal.employeeCount}</strong></span>
                    <span>Deductions: PF {fmt(sal.statutory.pf)} · TDS {fmt(sal.statutory.tds)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: ADVANCES & LOANS ─────────────────────────────────────────── */}
      {activeTab === 'advances' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Advances Summary */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Staff Advances Summary
              </h3>
              <div className="space-y-2.5 divide-y divide-slate-100">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-600 font-medium">Total Advances Issued</span>
                  <span className="font-bold text-slate-900 text-sm">{fmt(advLoans?.advances.totalIssued || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-600 font-medium">Surplus Outstanding (To Return)</span>
                  <span className="font-bold text-amber-600 text-sm">{fmt(advLoans?.advances.totalOutstanding || 0)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-600 font-medium">Active Unsettled Requests</span>
                  <span className="font-bold text-slate-900 text-sm">{advLoans?.advances.activeCount || 0} staff</span>
                </div>
              </div>
            </div>

            {/* Loans Summary */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                Business Borrowed Loans & Utilization
              </h3>
              {advLoans?.loans.loanMetrics && advLoans.loans.loanMetrics.length > 0 ? (
                <div className="space-y-3">
                  {advLoans.loans.loanMetrics.map((l) => (
                    <div key={l.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex justify-between items-center">
                        <strong className="text-xs text-slate-900 font-bold">{l.lender} ({l.loanNo})</strong>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {l.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <label className="text-[10px] text-slate-400 font-bold block">Principal</label>
                          <span className="font-bold text-slate-800">{fmt(l.principal)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <label className="text-[10px] text-slate-400 font-bold block">Utilized</label>
                          <span className="font-bold text-slate-800">{fmt(l.totalUtilized)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <label className="text-[10px] text-slate-400 font-bold block">Unallocated</label>
                          <span className="font-bold text-emerald-600">{fmt(l.unallocated)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                          <label className="text-[10px] text-slate-400 font-bold block">Outstanding</label>
                          <span className="font-bold text-amber-600">{fmt(l.principalOutstanding)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No active business loans recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
