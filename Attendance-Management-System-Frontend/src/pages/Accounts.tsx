import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { Plus, Landmark, Wallet, RefreshCw, AlertCircle, X, PiggyBank, Edit2, Trash2 } from 'lucide-react';
import { ResponsiveSelect } from '../components/ResponsiveSelect';

const accountTypeOptions = [
  { value: 'BANK', label: 'Bank Account' },
  { value: 'CASH', label: 'Cash Box' },
  { value: 'UPI', label: 'UPI Channel' },
  { value: 'CARD', label: 'Credit/Debit Card' },
  { value: 'OTHER', label: 'Other Wallet' },
];

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

interface Account {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  openingBalance: number;
  currentBalance: number;
  status: string;
}

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('BANK');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit states
  const [showEditForm, setShowEditForm] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editBalance, setEditBalance] = useState('0');

  // Determine if user is super admin
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSuperAdmin = currentUser?.permissions?.includes('*') || currentUser?.role === 'SUPER_ADMIN';

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve accounts.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => { fetchAccounts(); }, []);

  // Auto-refresh accounts every 30s
  useAutoRefresh(fetchAccounts, 30000);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      await api.post('/accounts', {
        name,
        type,
        bankName: type === 'BANK' ? bankName : undefined,
        accountNumber: type === 'BANK' ? accountNumber : undefined,
        ifsc: type === 'BANK' ? ifsc : undefined,
        openingBalance: parseFloat(openingBalance) || 0,
      });

      setShowAddForm(false);
      // Reset form
      setName('');
      setType('BANK');
      setBankName('');
      setAccountNumber('');
      setIfsc('');
      setOpeningBalance('0');

      fetchAccounts();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEdit = (account: Account) => {
    setEditAccountId(account.id);
    setEditName(account.name);
    setEditStatus(account.status);
    setEditBalance(account.currentBalance.toString());
    setShowEditForm(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await api.patch(`/accounts/${editAccountId}`, {
        name: editName,
        status: editStatus,
        currentBalance: parseFloat(editBalance) || 0,
      });
      setShowEditForm(false);
      fetchAccounts();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update account.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account? It will be marked as inactive and removed.')) return;
    try {
      await api.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete account.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-[var(--card-border)] shadow-sm">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Financial Accounts
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 text-xs sm:text-sm">
            Manage your company's cash boxes, bank accounts, and digital wallet channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Account Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-semibold text-white text-xs sm:text-sm shadow-lg shadow-[var(--primary)]/15 active:scale-98 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs sm:text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-650" />
          <span>{error}</span>
        </div>
      )}

      {/* Accounts Grid */}
      {loading && accounts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 sm:h-48 rounded-xl sm:rounded-2xl animate-pulse bg-white border border-slate-200"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group relative rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-white border border-slate-200 hover:border-[var(--primary)]/30 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 overflow-hidden flex flex-col justify-between"
            >
              {/* Card background glows */}
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-[40px] opacity-5 transition-opacity group-hover:opacity-10 pointer-events-none z-0 bg-[var(--primary)]`}></div>

              <div>
                <div className="relative z-10 flex justify-between items-start mb-4 sm:mb-6">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border bg-[var(--primary-light)] border-[var(--primary-light)] text-[var(--primary)] shrink-0">
                      {account.type === 'BANK' ? <Landmark className="w-4 h-4 sm:w-5 sm:h-5" /> : <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] text-sm sm:text-base leading-tight">
                        {account.name}
                      </h3>
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold block mt-0.5 sm:mt-1">
                        {account.type} ACCOUNT
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      account.status === 'ACTIVE'
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                        : 'bg-red-55 border-red-250 text-red-750'
                    }`}>
                      {account.status}
                    </span>
                    
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1 ml-1 sm:ml-2">
                        <button onClick={() => handleOpenEdit(account)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Edit Account">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteAccount(account.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-650 transition-colors" title="Delete Account">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Numbers details if BANK */}
                {account.type === 'BANK' ? (
                  <div className="space-y-1 mb-4 sm:mb-6 text-xs text-slate-600 font-mono">
                    <p className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 shrink-0">Bank:</span>
                      <span className="truncate">{account.bankName}</span>
                    </p>
                    <p className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 shrink-0">A/C No:</span>
                      <span className="truncate max-w-[180px] sm:max-w-[220px] text-right" title={account.accountNumber || ''}>
                        {account.accountNumber}
                      </span>
                    </p>
                    <p className="flex justify-between items-center gap-2">
                      <span className="text-slate-400 shrink-0">IFSC:</span>
                      <span className="truncate">{account.ifsc}</span>
                    </p>
                  </div>
                ) : (
                  <div className="h-[44px] mb-4 sm:mb-6 flex items-center justify-center text-xs text-slate-450 italic">
                    Physical Cash Box / Drawer
                  </div>
                )}
              </div>

              {/* Balances */}
              <div className="pt-3 sm:pt-4 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                  Current Balance
                </span>
                <span className="text-lg sm:text-xl font-black text-[var(--text-primary)] font-mono">
                  ₹{account.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal Overlay - Full Screen on Mobile */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl border-0 sm:border border-slate-200 bg-white overflow-hidden shadow-2xl flex flex-col animate-zoom-in">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg shrink-0">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Create New Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAccount} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-750">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {/* Account Name */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Account Display Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none"
                      placeholder="e.g. Office Vault Cash"
                      required
                    />
                  </div>

                  {/* Account Type - Uses ResponsiveSelect with Bottom Sheet on mobile */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Account Type
                    </label>
                    <ResponsiveSelect
                      label="Select Account Type"
                      value={type}
                      options={accountTypeOptions}
                      onChange={(val) => setType(val)}
                    />
                  </div>

                  {/* Opening Balance */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Opening Balance (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Conditional Bank Fields */}
                {type === 'BANK' && (
                  <div className="space-y-3.5 sm:space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none"
                        placeholder="e.g. ICICI Bank"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none font-mono"
                          placeholder="12-16 digit code"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value)}
                          className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none font-mono"
                          placeholder="IFSC Alpha-Numeric"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 sm:gap-3 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
                >
                  {formLoading ? 'Creating...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal Overlay - Full Screen on Mobile */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl border-0 sm:border border-slate-200 bg-white overflow-hidden shadow-2xl flex flex-col animate-zoom-in">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg shrink-0">
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Edit Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateAccount} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-750">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                    Account Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                    Account Status
                  </label>
                  <ResponsiveSelect
                    label="Select Account Status"
                    value={editStatus}
                    options={statusOptions}
                    onChange={(val) => setEditStatus(val)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                    Current Balance
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-500 text-xs sm:text-sm font-semibold">₹</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="block w-full pl-8 pr-3.5 sm:pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-xs sm:text-sm outline-none font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 sm:gap-3 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 sm:flex-none justify-center px-6 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
                >
                  {formLoading ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
