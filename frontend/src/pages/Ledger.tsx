import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api } from '../services/api';
import { RefreshCw, Filter, ShieldAlert, Ban, X, AlertCircle } from 'lucide-react';

interface Transaction {
  id: string;
  transactionNo: string;
  type: string;
  category: string;
  date: string;
  amount: number;
  accountId: string;
  accountName: string;
  purpose: string;
  paymentMode: string;
  referenceNo: string | null;
  transferGroupId: string | null;
  reversalOfId: string | null;
  createdBy: string;
  voucherNo: string | null;
  partyName: string | null;
  accountBalance?: number;
}

export const Ledger: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoriesList, setCategoriesList] = useState<{ id: string, name: string }[]>([]);
  const [accountsList, setAccountsList] = useState<{ id: string, name: string }[]>([]);

  // Reversal States
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [targetTrxId, setTargetTrxId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState('');

  // Fetch current user details from localStorage to check roles
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { role: 'STAFF' };
  const canReverse = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: 15,
        ...(typeFilter && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(accountFilter && { accountId: accountFilter }),
      };

      const response = await api.get('/ledger', { params });
      setTransactions(response.data.data);
      setTotalPages(response.data.pagination.pages || 1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter, categoryFilter, accountFilter]);

  // Auto-refresh transactions every 30s
  useAutoRefresh(fetchTransactions, 30000, [page, typeFilter, categoryFilter, accountFilter]);


  useEffect(() => {
    api.get('/payment-categories').then(res => setCategoriesList(res.data.data || [])).catch(console.error);
    api.get('/accounts').then(res => setAccountsList(res.data.data || [])).catch(console.error);
  }, []);

  const handleReverseClick = (trxId: string) => {
    setTargetTrxId(trxId);
    setReversalReason('');
    setRevError('');
    setShowReverseModal(true);
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevError('');
    setRevLoading(true);

    try {
      await api.post(`/ledger/${targetTrxId}/reverse`, {
        purpose: reversalReason,
      });

      setShowReverseModal(false);
      fetchTransactions();
    } catch (err: any) {
      setRevError(err.response?.data?.message || 'Failed to reverse transaction.');
    } finally {
      setRevLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Unified Transaction Ledger
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Access the immutable single-entry ledger registry. Tracks all deposits, outflows, and corrections.
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl glass-panel bg-card-dark/20 border border-white/5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest font-bold">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span>Filters:</span>
          </div>

          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-xs outline-none max-w-[150px] truncate"
          >
            <option value="">All Accounts</option>
            {accountsList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-xs outline-none"
          >
            <option value="">All Types</option>
            <option value="PAYMENT_IN">Payment In (Credit)</option>
            <option value="PAYMENT_OUT">Payment Out (Debit)</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="REVERSAL">Reversals</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-xs outline-none"
          >
            <option value="">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value="CLIENT_PAYMENT">Client Payments (System)</option>
            <option value="VENDOR_PAYMENT">Vendor Payments (System)</option>
            <option value="OFFICE_EXPENSE">Office Overhead (System)</option>
            <option value="INTERNAL_TRANSFER">Internal Transfers (System)</option>
            <option value="LOAN_RECEIVED">Loan Principal (System)</option>
            <option value="LOAN_REPAYMENT">Loan Payments (System)</option>
            <option value="STAFF_REIMBURSEMENT">Staff Reimbursements (System)</option>
            <option value="STAFF_ADVANCE">Staff Advances (System)</option>
            <option value="SALARY_PAYMENT">Salaries (System)</option>
            <option value="OTHER">Other Categories (System)</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 font-semibold font-mono">
          Page {page} of {totalPages}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl glass-panel bg-card-dark/20 border border-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#0c101a]/40">
                <th className="px-6 py-4">Transaction / Voucher</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Account / Mode</th>
                <th className="px-6 py-4">Details & Target</th>
                <th className="px-6 py-4 text-right">Debit (DR)</th>
                <th className="px-6 py-4 text-right">Credit (CR)</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4 text-center">Adjustments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {loading && transactions.length === 0 ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td colSpan={8} className="h-16 bg-white/2"></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-semibold italic">
                    No transactions registered matching this criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => {
                  const isCredit = trx.type === 'PAYMENT_IN' || trx.type === 'TRANSFER_IN';
                  const isReversal = trx.type === 'REVERSAL';

                  return (
                    <tr
                      key={trx.id}
                      className="hover:bg-white/2 transition-colors group"
                    >
                      {/* Code and Voucher */}
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-bold text-white font-mono block">
                          {trx.transactionNo}
                        </span>
                        {trx.voucherNo && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] text-gray-400 font-mono">
                            {trx.voucherNo}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-gray-400 font-mono">
                        {new Date(trx.date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Account details */}
                      <td className="px-6 py-4 space-y-1">
                        <span className="text-gray-300 font-semibold block">
                          {trx.accountName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {trx.paymentMode} {trx.referenceNo ? `(${trx.referenceNo})` : ''}
                        </span>
                      </td>

                      {/* Details & Target */}
                      <td className="px-6 py-4 space-y-1 max-w-xs">
                        <p className="text-gray-300 truncate font-medium">
                          {trx.purpose}
                        </p>
                        <div className="flex gap-2">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/10 text-[9px] font-bold text-indigo-400 uppercase">
                            {trx.category.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            Party: <span className="text-gray-400 font-semibold">{trx.partyName}</span>
                          </span>
                        </div>
                      </td>

                      {/* Debit (DR) */}
                      <td className={`px-6 py-4 text-right font-bold font-mono text-sm`}>
                        {!isCredit ? (
                          <span className={isReversal ? "text-orange-400" : "text-red-400"}>
                            {isReversal ? '↺ ' : ''}₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-gray-700/50">-</span>
                        )}
                      </td>

                      {/* Credit (CR) */}
                      <td className={`px-6 py-4 text-right font-bold font-mono text-sm`}>
                        {isCredit ? (
                          <span className="text-emerald-400">
                            ₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-gray-700/50">-</span>
                        )}
                      </td>

                      {/* Account Balance */}
                      <td className={`px-6 py-4 text-right font-bold font-mono text-sm text-gray-400`}>
                        ₹{(trx.accountBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Reversals Actions */}
                      <td className="px-6 py-4 text-center">
                        {isReversal ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-[9px] font-bold text-orange-400">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Correction</span>
                          </span>
                        ) : trx.reversalOfId ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[9px] font-bold text-red-400">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Reversed</span>
                          </span>
                        ) : canReverse ? (
                          <button
                            onClick={() => handleReverseClick(trx.id)}
                            className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                          >
                            Reverse
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-600 font-semibold italic">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-[#0c101a]/40">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:text-white transition-all disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs hover:text-white transition-all disabled:opacity-30 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Reversal Reason Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-bold text-white">Reverse Transaction</h3>
              </div>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="p-6 space-y-4">
              {revError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {revError}
                </div>
              )}

              <p className="text-xs text-gray-400 leading-relaxed">
                Reversing this transaction will post a matching counter-balance entry in the ledger registry and restore the original account balance. This action cannot be undone.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Reversal Reason
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-white text-xs outline-none h-24 resize-none"
                  placeholder="e.g. Accidental amount double entry, invoice amount correction."
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={revLoading}
                  className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-650 text-white text-xs font-semibold shadow-lg shadow-red-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {revLoading ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
