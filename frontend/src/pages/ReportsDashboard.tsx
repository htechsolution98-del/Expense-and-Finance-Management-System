import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import '../styles/reports.css';

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
  const [activeTab, setActiveTab]   = useState<'cashflow' | 'expenses' | 'salaries' | 'advances'>('cashflow');
  const [summary, setSummary]       = useState<DashboardSummary | null>(null);
  const [cashFlow, setCashFlow]     = useState<CashFlowData | null>(null);
  const [categories, setCategories] = useState<CategoryExpense[]>([]);
  const [empExpenses, setEmpExpenses] = useState<EmployeeExpense[]>([]);
  const [salaries, setSalaries]     = useState<SalarySummary[]>([]);
  const [advLoans, setAdvLoans]     = useState<AdvanceLoanData | null>(null);
  const [loading, setLoading]       = useState(true);

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

  // CSV Export Trigger — uses authenticated fetch + blob since window.open can't send auth headers
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

  if (loading) return <div className="rep-loading"><div className="rep-spinner" /></div>;

  return (
    <div className="rep-root">
      {/* Header */}
      <div className="rep-header">
        <div>
          <h1 className="rep-title">Executive Reports & Analytics</h1>
          <p className="rep-subtitle">Real-time financial visibility derived directly from single-source transaction ledgers</p>
        </div>
        <div className="rep-export-btns">
          <button className="rep-btn-export" onClick={() => handleExportCSV('ledger')}>📥 Export Ledger CSV</button>
          <button className="rep-btn-export" onClick={() => handleExportCSV('expenses')}>📥 Export Expenses CSV</button>
          <button className="rep-btn-export" onClick={() => handleExportCSV('salaries')}>📥 Export Salary CSV</button>
        </div>
      </div>

      {/* ── Executive KPI Cards ──────────────────────────────────────────────── */}
      <div className="rep-kpi-grid">
        <div className="rep-kpi-card rep-kpi-green" onClick={() => setActiveTab('cashflow')} style={{cursor:'pointer'}} title="View Cash Flow & Ledger">
          <div className="rep-kpi-label">TOTAL MONEY RECEIVED</div>
          <div className="rep-kpi-val">{fmt(summary?.totalMoneyIn || 0)}</div>
          <div className="rep-kpi-sub">Confirmed Inflow (Clients, Loans, Income)</div>
        </div>

        <div className="rep-kpi-card rep-kpi-purple" onClick={() => setActiveTab('cashflow')} style={{cursor:'pointer'}} title="View Cash Flow & Ledger">
          <div className="rep-kpi-label">TOTAL PAYMENTS OUT</div>
          <div className="rep-kpi-val">{fmt(summary?.totalMoneyOut || 0)}</div>
          <div className="rep-kpi-sub">Expenses, Vendor Payouts, Payroll &amp; Advances</div>
        </div>

        <div className="rep-kpi-card rep-kpi-amber" onClick={() => window.location.href = '/accounts'} style={{cursor:'pointer'}} title="View Accounts">
          <div className="rep-kpi-label">COMPANY NET LIQUIDITY</div>
          <div className="rep-kpi-val">{fmt(summary?.netLiquidity || 0)}</div>
          <div className="rep-kpi-sub">Current balance across {summary?.accounts.length || 0} Cash &amp; Bank accounts</div>
        </div>

        <div className="rep-kpi-card rep-kpi-pink" onClick={() => setActiveTab('expenses')} style={{cursor:'pointer'}} title="View Pending Approvals">
          <div className="rep-kpi-label">PENDING APPROVALS QUEUE</div>
          <div className="rep-kpi-val">{summary?.pendingApprovalsCount || 0}</div>
          <div className="rep-kpi-sub">
            Expenses: {summary?.pendingBreakdown.expenses} · Advances: {summary?.pendingBreakdown.advances} · Banks: {summary?.pendingBreakdown.bankAccounts}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="rep-tabs">
        <button className={`rep-tab ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')}>
          📈 Cash Flow & Ledger
        </button>
        <button className={`rep-tab ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
          📊 Expense Analytics ({categories.length} Categories)
        </button>
        <button className={`rep-tab ${activeTab === 'salaries' ? 'active' : ''}`} onClick={() => setActiveTab('salaries')}>
          💵 Monthly Salary Register ({salaries.length} Batches)
        </button>
        <button className={`rep-tab ${activeTab === 'advances' ? 'active' : ''}`} onClick={() => setActiveTab('advances')}>
          💼 Advances & Loan Metrics
        </button>
      </div>

      {/* ── TAB 1: CASH FLOW & LEDGER ────────────────────────────────────────── */}
      {activeTab === 'cashflow' && (
        <div className="rep-tab-content">
          <div className="rep-card-grid">
            {/* Account Balances Card */}
            <div className="rep-card">
              <h3>Company Bank & Cash Accounts</h3>
              <div className="rep-account-list">
                {summary?.accounts.map((acc) => (
                  <div key={acc.id} className="rep-acc-row">
                    <div>
                      <div className="rep-acc-name">{acc.name}</div>
                      <div className="rep-acc-type">{acc.type} ACCOUNT</div>
                    </div>
                    <div className="rep-acc-bal">{fmt(acc.currentBalance)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Mode Breakdown */}
            <div className="rep-card">
              <h3>Inflow / Outflow by Payment Mode</h3>
              <div className="rep-mode-list">
                {cashFlow?.byMode && Object.keys(cashFlow.byMode).length > 0 ? (
                  Object.entries(cashFlow.byMode).map(([mode, val]) => (
                    <div key={mode} className="rep-mode-row">
                      <span className="rep-mode-pill">{mode}</span>
                      <div className="rep-mode-vals">
                        <span className="text-green">+ {fmt(val.moneyIn)}</span>
                        <span className="text-purple">- {fmt(val.moneyOut)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rep-empty">No payment mode breakdown recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Ledger Audit Log */}
          <div className="rep-card mt-6">
            <h3>Recent Financial Transactions Ledger</h3>
            <div className="rep-table-wrapper">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Tx No</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Purpose</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow?.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td className="rep-tx-no">{t.transactionNo}</td>
                      <td>
                        <span className={`rep-type-pill ${t.type === 'PAYMENT_IN' ? 'in' : 'out'}`}>{t.type}</span>
                      </td>
                      <td className="rep-cat-name">{t.category}</td>
                      <td>{new Date(t.date).toLocaleDateString('en-IN')}</td>
                      <td>{t.account?.name}</td>
                      <td className="rep-purpose">{t.purpose}</td>
                      <td className={`rep-amount ${t.type === 'PAYMENT_IN' ? 'text-green' : 'text-purple'}`}>
                        {t.type === 'PAYMENT_IN' ? '+' : '-'} {fmt(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: EXPENSE ANALYTICS ─────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="rep-tab-content">
          <div className="rep-card-grid">
            {/* Category Breakdown */}
            <div className="rep-card">
              <h3>Spending by Expense Category</h3>
              <div className="rep-cat-list">
                {categories.length === 0 ? (
                  <div className="rep-empty">No approved expenses to display.</div>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className="rep-cat-row">
                      <div className="rep-cat-header">
                        <span className="rep-cat-title">{cat.name} ({cat.count} claims)</span>
                        <span className="rep-cat-amt">{fmt(cat.totalAmount)} ({cat.percentage}%)</span>
                      </div>
                      <div className="rep-progress-bar">
                        <div className="rep-progress-fill" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Employee Breakdown */}
            <div className="rep-card">
              <h3>Spending by Employee & Department</h3>
              <div className="rep-table-wrapper">
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Approved Spent</th>
                      <th>Pending Claims</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empExpenses.length === 0 ? (
                      <tr><td colSpan={4} className="text-center">No employee expenses found.</td></tr>
                    ) : (
                      empExpenses.map((emp) => (
                        <tr key={emp.id}>
                          <td><strong>{emp.name}</strong> ({emp.code})</td>
                          <td>{emp.department}</td>
                          <td className="text-green font-bold">{fmt(emp.approvedAmount)}</td>
                          <td className="text-amber">{emp.pendingAmount > 0 ? fmt(emp.pendingAmount) : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SALARY REGISTER ──────────────────────────────────────────── */}
      {activeTab === 'salaries' && (
        <div className="rep-tab-content">
          <div className="rep-card">
            <h3>Monthly Payroll & Statutory Deduction Register</h3>
            <div className="rep-table-wrapper">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Batch No</th>
                    <th>Month / Year</th>
                    <th>Employees</th>
                    <th>Gross Earnings</th>
                    <th>Net Payable</th>
                    <th>PF Deducted</th>
                    <th>TDS Deducted</th>
                    <th>PT Deducted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.length === 0 ? (
                    <tr><td colSpan={9} className="text-center">No salary payroll runs generated yet.</td></tr>
                  ) : (
                    salaries.map((sal) => (
                      <tr key={sal.id}>
                        <td className="rep-tx-no">{sal.payrollNo}</td>
                        <td><strong>{monthNames[sal.month]} {sal.year}</strong></td>
                        <td>{sal.paidItemsCount} / {sal.employeeCount} Paid</td>
                        <td>{fmt(sal.totalGross)}</td>
                        <td className="text-green font-bold">{fmt(sal.totalNet)}</td>
                        <td>{fmt(sal.statutory.pf)}</td>
                        <td>{fmt(sal.statutory.tds)}</td>
                        <td>{fmt(sal.statutory.professionalTax)}</td>
                        <td><span className="rep-type-pill in">{sal.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: ADVANCES & LOANS ─────────────────────────────────────────── */}
      {activeTab === 'advances' && (
        <div className="rep-tab-content">
          <div className="rep-card-grid">
            {/* Advances Summary */}
            <div className="rep-card">
              <h3>Staff Advances Summary</h3>
              <div className="rep-metric-row">
                <label>Total Advances Issued</label>
                <span>{fmt(advLoans?.advances.totalIssued || 0)}</span>
              </div>
              <div className="rep-metric-row">
                <label>Total Surplus Outstanding (To Return)</label>
                <span className="text-amber">{fmt(advLoans?.advances.totalOutstanding || 0)}</span>
              </div>
              <div className="rep-metric-row">
                <label>Active Unsettled Advances</label>
                <span>{advLoans?.advances.activeCount || 0} staff requests</span>
              </div>
            </div>

            {/* Loans Summary */}
            <div className="rep-card">
              <h3>Business Borrowed Loans & Utilization</h3>
              {advLoans?.loans.loanMetrics && advLoans.loans.loanMetrics.length > 0 ? (
                advLoans.loans.loanMetrics.map((l) => (
                  <div key={l.id} className="rep-loan-card">
                    <div className="rep-loan-header">
                      <strong>{l.lender} ({l.loanNo})</strong>
                      <span className="rep-type-pill in">{l.status}</span>
                    </div>
                    <div className="rep-loan-grid">
                      <div><label>Principal</label><span>{fmt(l.principal)}</span></div>
                      <div><label>Utilized</label><span>{fmt(l.totalUtilized)}</span></div>
                      <div><label>Unallocated</label><span className="text-green">{fmt(l.unallocated)}</span></div>
                      <div><label>Outstanding</label><span className="text-amber">{fmt(l.principalOutstanding)}</span></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rep-empty">No active business loans recorded.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
