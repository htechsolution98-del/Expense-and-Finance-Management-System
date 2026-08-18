import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Plus,
  Landmark,
  Wallet,
  RefreshCw,
  AlertCircle,
  X,
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  CheckCircle2,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';

interface Loan {
  id: string;
  loanNo: string;
  lender: string;
  principal: number;
  interestRate: number;
  receivedDate: string;
  purpose: string;
  receivingAccountId: string;
  status: 'ACTIVE' | 'SETTLED';
  createdAt: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface Transaction {
  id: string;
  transactionNo: string;
  type: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'REVERSAL';
  category: string;
  date: string;
  amount: number;
  purpose: string;
  paymentMode: string;
  referenceNo: string | null;
  runningBalance: number;
}

export const Loans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Loan Detail States
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanTransactions, setLoanTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // New Loan Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [loanNo, setLoanNo] = useState('');
  const [lender, setLender] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('0');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('');
  const [receivingAccountId, setReceivingAccountId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Repayment / Utilization Modals
  const [showActionModal, setShowActionModal] = useState<'REPAY' | 'UTILIZE' | null>(null);
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionPurpose, setActionPurpose] = useState('');
  const [actionAccountId, setActionAccountId] = useState('');
  const [actionPaymentMode, setActionPaymentMode] = useState('BANK_TRANSFER');
  const [actionReferenceNo, setActionReferenceNo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Determine user role details
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = currentUser?.permissions?.includes('*') || currentUser?.role === 'SUPER_ADMIN';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loanRes, accRes] = await Promise.all([
        api.get('/masters/loans'),
        api.get('/accounts')
      ]);
      setLoans(loanRes.data.data);
      setAccounts(accRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve loans data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useAutoRefresh(fetchData, 30000);

  // Calculates financial aggregates dynamically
  // To avoid duplicate transactions double counting, we'll fetch transaction aggregates per loan
  const [loanBalances, setLoanBalances] = useState<Record<string, { repaid: number; utilized: number }>>({});

  useEffect(() => {
    const fetchBalances = async () => {
      const balances: Record<string, { repaid: number; utilized: number }> = {};
      try {
        for (const l of loans) {
          const res = await api.get('/ledger', { params: { loanId: l.id, limit: 1000 } });
          const txs: Transaction[] = res.data.data || [];
          const repaid = txs
            .filter((t) => t.category === 'LOAN_REPAYMENT' && t.type === 'PAYMENT_OUT')
            .reduce((sum, t) => sum + t.amount, 0);
          const utilized = txs
            .filter((t) => t.category === 'LOAN_UTILIZATION' && t.type === 'PAYMENT_OUT')
            .reduce((sum, t) => sum + t.amount, 0);
          balances[l.id] = { repaid, utilized };
        }
        setLoanBalances(balances);
      } catch (err) {
        console.error('Failed to compute loan ledger balances', err);
      }
    };
    if (loans.length > 0) {
      fetchBalances();
    }
  }, [loans]);

  const computeOutstanding = (loan: Loan) => {
    const balance = loanBalances[loan.id] || { repaid: 0, utilized: 0 };
    if (loan.status === 'SETTLED') return 0;
    const interestAccrued = loan.principal * (loan.interestRate / 100);
    return loan.principal + interestAccrued - balance.repaid;
  };

  const totalBorrowed = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalRepaid = Object.values(loanBalances).reduce((sum, b) => sum + b.repaid, 0);
  const totalUtilized = Object.values(loanBalances).reduce((sum, b) => sum + b.utilized, 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + computeOutstanding(l), 0);

  // View loan transactions ledger
  const handleViewHistory = async (loan: Loan) => {
    setSelectedLoan(loan);
    setLoadingTx(true);
    setShowHistoryModal(true);
    try {
      const res = await api.get('/ledger', { params: { loanId: loan.id, limit: 1000 } });
      setLoanTransactions(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTx(false);
    }
  };

  // Toggle settled status
  const handleToggleStatus = async (loan: Loan) => {
    const targetStatus = loan.status === 'ACTIVE' ? 'SETTLED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to mark this loan as ${targetStatus}?`)) return;

    try {
      await api.patch(`/masters/loans/${loan.id}/status`, { status: targetStatus });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update loan status.');
    }
  };

  // Register borrowing / Loan creation
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      await api.post('/masters/loans', {
        loanNo,
        lender,
        principal: parseFloat(principal),
        interestRate: parseFloat(interestRate),
        receivedDate,
        purpose,
        receivingAccountId
      });

      setShowAddModal(false);
      // Reset
      setLoanNo('');
      setLender('');
      setPrincipal('');
      setInterestRate('0');
      setPurpose('');
      setReceivingAccountId('');
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to register loan.');
    } finally {
      setFormLoading(false);
    }
  };

  // Repayment / Utilization Submissions
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionLoading(true);

    if (!actionLoan) return;

    const isRepay = showActionModal === 'REPAY';
    const endpoint = isRepay ? '/payments/out' : '/payments/out';
    const payload = {
      accountId: actionAccountId,
      amount: parseFloat(actionAmount),
      category: isRepay ? 'LOAN_REPAYMENT' : 'LOAN_UTILIZATION',
      purpose: actionPurpose,
      paymentMode: actionPaymentMode,
      referenceNo: actionReferenceNo,
      loanId: actionLoan.id
    };

    try {
      await api.post(endpoint, payload);
      setShowActionModal(null);
      setActionLoan(null);
      // Reset form
      setActionAmount('');
      setActionPurpose('');
      setActionAccountId('');
      setActionPaymentMode('BANK_TRANSFER');
      setActionReferenceNo('');
      fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.message || `Failed to record loan ${isRepay ? 'repayment' : 'utilization'}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8">
      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Total Borrowed</span>
            <span className="text-2xl font-black text-white mt-1 block">{fmt(totalBorrowed)}</span>
          </div>
        </div>

        <div className="glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Total Repaid</span>
            <span className="text-2xl font-black text-white mt-1 block">{fmt(totalRepaid)}</span>
          </div>
        </div>

        <div className="glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Outstanding Principal</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{fmt(totalOutstanding)}</span>
          </div>
        </div>

        <div className="glass-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Total Utilized</span>
            <span className="text-2xl font-black text-white mt-1 block">{fmt(totalUtilized)}</span>
          </div>
        </div>
      </div>

      {/* Error & Controls */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Business Borrowings & Udhaar</h2>
          <p className="text-xs text-gray-400 mt-1">Manage company loans, track repayments, and monitor fund utilization</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setFormError('');
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" />
            Record Borrowing (Udhaar)
          </button>
        </div>
      </div>

      {/* Loans Table */}
      <div className="glass-panel border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-[#0e1420]/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Loan/Lender Info</th>
                <th className="px-6 py-4">Borrow Date</th>
                <th className="px-6 py-4 text-right">Principal</th>
                <th className="px-6 py-4 text-right">Interest Rate</th>
                <th className="px-6 py-4 text-right">Repaid</th>
                <th className="px-6 py-4 text-right">Outstanding</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading && loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
                    Loading business borrowings...
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No active business borrowings registered.
                  </td>
                </tr>
              ) : (
                loans.map((l) => {
                  const balance = loanBalances[l.id] || { repaid: 0, utilized: 0 };
                  const outstanding = computeOutstanding(l);

                  return (
                    <tr key={l.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            l.status === 'SETTLED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            LN
                          </div>
                          <div>
                            <span className="font-semibold text-[var(--text-primary)] block">{l.lender}</span>
                            <span className="text-[10px] font-mono font-bold text-gray-500 block">Loan No: {l.loanNo}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] block max-w-xs truncate">{l.purpose}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-primary)]">
                        {new Date(l.receivedDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-[var(--text-primary)]">
                        {fmt(l.principal)}
                      </td>
                      <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-medium">
                        {l.interestRate}% <span className="text-[10px] text-gray-500">p.a.</span>
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-semibold">
                        {fmt(balance.repaid)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-amber-600">
                        {fmt(outstanding)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          l.status === 'SETTLED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {l.status === 'SETTLED' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Settled</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Active</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewHistory(l)}
                            className="px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/10 text-indigo-400 text-xs font-semibold cursor-pointer transition-all"
                            title="View Loan ledger logs"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {l.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => {
                                  setActionError('');
                                  setActionLoan(l);
                                  setShowActionModal('REPAY');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 text-xs font-semibold cursor-pointer transition-all"
                              >
                                Repay
                              </button>
                              <button
                                onClick={() => {
                                  setActionError('');
                                  setActionLoan(l);
                                  setShowActionModal('UTILIZE');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/15 text-violet-400 hover:text-violet-300 text-xs font-semibold cursor-pointer transition-all"
                              >
                                Utilize
                              </button>
                            </>
                          )}
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleToggleStatus(l)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                l.status === 'ACTIVE'
                                  ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400'
                                  : 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {l.status === 'ACTIVE' ? 'Settle' : 'Reopen'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Record Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f18] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl overflow-hidden text-left">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                Record Borrowing (Udhaar Receipt)
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Loan / Udhaar No
                  </label>
                  <input
                    type="text"
                    required
                    value={loanNo}
                    onChange={(e) => setLoanNo(e.target.value.toUpperCase())}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                    placeholder="e.g. LN-102"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Lender Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                    placeholder="Lender / Friend Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Principal Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                    placeholder="₹ Received"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Receiving Bank/Cash Account
                </label>
                <select
                  required
                  value={receivingAccountId}
                  onChange={(e) => setReceivingAccountId(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                >
                  <option value="">Select Company Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) - Balance: {fmt(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Received Date
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Purpose / Notes
                </label>
                <textarea
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none h-20 resize-none"
                  placeholder="e.g. Funding for short-term working capital needs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-650 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {formLoading ? 'Recording...' : 'Deposit Principal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Repayment / Utilization */}
      {showActionModal && actionLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f18] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl overflow-hidden text-left">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {showActionModal === 'REPAY' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-violet-400" />
                )}
                {showActionModal === 'REPAY' ? 'Record Repayment' : 'Record Utilization'}
              </h3>
              <button
                onClick={() => {
                  setShowActionModal(null);
                  setActionLoan(null);
                }}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                  {actionError}
                </div>
              )}

              <div className="p-3 bg-white/5 rounded-xl text-xs space-y-1">
                <div className="text-gray-400">Lender: <strong className="text-white">{actionLoan.lender} ({actionLoan.loanNo})</strong></div>
                <div className="text-gray-400">Principal: <strong className="text-white">{fmt(actionLoan.principal)}</strong></div>
                <div className="text-gray-400">Outstanding Balance: <strong className="text-amber-400">{fmt(computeOutstanding(actionLoan))}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                  placeholder="₹ Value"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Source Bank/Cash Account
                </label>
                <select
                  required
                  value={actionAccountId}
                  onChange={(e) => setActionAccountId(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                >
                  <option value="">Select Source Account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) - Balance: {fmt(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={actionPaymentMode}
                    onChange={(e) => setActionPaymentMode(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / Net Banking</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Reference / Tx No
                  </label>
                  <input
                    type="text"
                    value={actionReferenceNo}
                    onChange={(e) => setActionReferenceNo(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none"
                    placeholder="e.g. UTR / UPI Ref"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Transaction Purpose
                </label>
                <textarea
                  required
                  value={actionPurpose}
                  onChange={(e) => setActionPurpose(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white text-sm outline-none h-16 resize-none"
                  placeholder={showActionModal === 'REPAY' ? 'e.g. 1st installment repayment' : 'e.g. Purchased office laptops'}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setShowActionModal(null);
                    setActionLoan(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-6 py-2 rounded-xl text-white text-sm font-semibold shadow-lg disabled:opacity-50 active:scale-98 transition-all cursor-pointer ${
                    showActionModal === 'REPAY'
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                      : 'bg-violet-500 hover:bg-violet-600 shadow-violet-500/20'
                  }`}
                >
                  {actionLoading ? 'Recording...' : `Record ${showActionModal === 'REPAY' ? 'Repayment' : 'Utilization'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Loan Ledger History Log */}
      {showHistoryModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0f18] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  Ledger History: {selectedLoan.lender}
                </h3>
                <span className="text-[10px] text-gray-400 block font-mono mt-0.5">Loan Reference Number: {selectedLoan.loanNo}</span>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedLoan(null);
                }}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingTx ? (
                <div className="py-12 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading transactions ledger...
                </div>
              ) : loanTransactions.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  No transaction recorded for this loan.
                </div>
              ) : (
                <div className="space-y-3">
                  {loanTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.category === 'LOAN_RECEIVED'
                              ? 'bg-blue-500/10 text-blue-400'
                              : tx.category === 'LOAN_REPAYMENT'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-violet-500/10 text-violet-400'
                          }`}>
                            {tx.category}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500">#{tx.transactionNo}</span>
                        </div>
                        <div className="text-xs text-white font-medium">{tx.purpose}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(tx.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })} via <strong className="text-gray-400">{tx.paymentMode}</strong>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`text-sm font-bold ${tx.type === 'PAYMENT_IN' ? 'text-blue-400' : 'text-amber-400'}`}>
                          {tx.type === 'PAYMENT_IN' ? '+' : '-'}{fmt(tx.amount)}
                        </div>
                        {tx.referenceNo && (
                          <div className="text-[10px] text-gray-500 font-mono">Ref: {tx.referenceNo}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedLoan(null);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
