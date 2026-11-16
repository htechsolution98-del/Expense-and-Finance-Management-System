import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { Wallet, ArrowDownLeft, ArrowUpRight, Repeat, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ResponsiveSelect, type ResponsiveSelectOption } from '../components/ResponsiveSelect';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

const paymentModeOptions: ResponsiveSelectOption[] = [
  { value: 'BANK_TRANSFER', label: 'Bank NetBanking Transfer' },
  { value: 'CASH', label: 'Physical Cash' },
  { value: 'UPI', label: 'UPI Payment Channels' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'CHEQUE', label: 'Physical Cheque' },
  { value: 'OTHER', label: 'Other Channel' },
];

export const Payments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'in' | 'out' | 'transfer'>('in');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: string, name: string, type: string }[]>([]);

  const [loadingLists, setLoadingLists] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [purpose, setPurpose] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [referenceNo, setReferenceNo] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Target Parties select
  const [partyType] = useState<'NONE' | 'CLIENT' | 'VENDOR' | 'EMPLOYEE' | 'LOAN'>('NONE');
  const [selectedPartyId] = useState('');

  // Transfer states
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const loadMasterData = async () => {
    setLoadingLists(true);
    try {
      const [accRes, catRes] = await Promise.all([
        api.get('/accounts').catch(() => ({ data: { data: [] } })),
        api.get('/payment-categories').catch(() => ({ data: { data: [] } })),
      ]);

      setAccounts(accRes.data.data || []);
      setCategoriesList(catRes.data.data || []);
    } catch (err: any) {
      setErrorMsg('Failed to load accounts or payment categories.');
    } finally {
      setLoadingLists(false);
    }
  };

  // Initial load
  useEffect(() => { loadMasterData(); }, []);

  // Auto-refresh master data every 30s
  useAutoRefresh(loadMasterData, 30000);

  const resetForm = () => {
    setAmount('');
    setPurpose('');
    setReferenceNo('');
    setCategory('');
    setSelectedFile(null);
  };

  // Prepare select options
  const accountOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Account --' },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name} (Bal: ₹${a.currentBalance.toLocaleString('en-IN')})`,
    })),
  ];

  const fromAccountOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Source Account --' },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name} (Bal: ₹${a.currentBalance.toLocaleString('en-IN')})`,
    })),
  ];

  const toAccountOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Destination Account --' },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.name} (Bal: ₹${a.currentBalance.toLocaleString('en-IN')})`,
    })),
  ];

  const categoryInOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Category --' },
    ...categoriesList
      .filter((c) => c.type === 'PAYMENT_IN' || c.type === 'BOTH')
      .map((c) => ({
        value: c.name,
        label: c.name,
      })),
  ];

  const categoryOutOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Category --' },
    ...categoriesList
      .filter((c) => c.type === 'PAYMENT_OUT' || c.type === 'BOTH')
      .map((c) => ({
        value: c.name,
        label: c.name,
      })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    // Pre-validations
    if (activeTab !== 'transfer') {
      if (!accountId) {
        setErrorMsg('Please select an account.');
        return;
      }
      if (!category) {
        setErrorMsg('Please select a payment category.');
        return;
      }
    } else {
      if (!fromAccountId) {
        setErrorMsg('Please select a source account.');
        return;
      }
      if (!toAccountId) {
        setErrorMsg('Please select a destination account.');
        return;
      }
      if (fromAccountId === toAccountId) {
        setErrorMsg('Source and Destination accounts cannot be the same.');
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }

    if (!purpose || purpose.trim().length < 3) {
      setErrorMsg('Transaction purpose must be at least 3 characters.');
      return;
    }

    setSubmitLoading(true);

    const buildFormData = () => {
      const formData = new FormData();
      formData.append('accountId', accountId);
      formData.append('amount', amount);
      formData.append('category', category || 'OTHER');
      formData.append('purpose', purpose.trim());
      formData.append('paymentMode', paymentMode);
      if (referenceNo) formData.append('referenceNo', referenceNo.trim());
      if (partyType === 'CLIENT' && selectedPartyId) formData.append('clientId', selectedPartyId);
      if (partyType === 'VENDOR' && selectedPartyId) formData.append('vendorId', selectedPartyId);
      if (partyType === 'EMPLOYEE' && selectedPartyId) formData.append('employeeId', selectedPartyId);
      if (partyType === 'LOAN' && selectedPartyId) formData.append('loanId', selectedPartyId);
      if (selectedFile) {
        formData.append('bill', selectedFile);
      }
      return formData;
    };

    try {
      if (activeTab === 'in') {
        await api.post('/payments/in', buildFormData());
        setSuccessMsg('Incoming payment successfully logged and ledger updated.');
      } else if (activeTab === 'out') {
        await api.post('/payments/out', buildFormData());
        setSuccessMsg('Outgoing payment successfully logged and ledger updated.');
      } else {
        await api.post('/transfers', {
          fromAccountId,
          toAccountId,
          amount: parseFloat(amount),
          purpose: purpose.trim(),
          referenceNo: referenceNo.trim() || undefined,
        });
        setSuccessMsg('Internal transfer successfully completed.');
      }

      resetForm();
      loadMasterData();
    } catch (err: any) {
      const serverMessage =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        err.message ||
        'Transaction submission failed.';
      setErrorMsg(serverMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in px-1 sm:px-0">
      {/* Header section */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Record Financial Transaction
        </h1>
        <p className="text-[var(--text-secondary)] mt-1 sm:mt-1.5 text-xs sm:text-sm">
          Log cash/bank deposits, payouts, and transfers with atomic database safeguards.
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs sm:text-sm text-emerald-700 animate-fade-in">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs sm:text-sm text-red-700 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => { setActiveTab('in'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          style={activeTab === 'in' ? { color: '#ffffff', backgroundColor: 'var(--primary)' } : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1 sm:px-3 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'in' ? 'bg-[var(--primary)] text-white shadow-md text-white-force' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={activeTab === 'in' ? { color: '#ffffff' } : undefined} />
          <span className="text-[11px] sm:text-sm leading-tight text-center" style={activeTab === 'in' ? { color: '#ffffff' } : undefined}>
            <span className="sm:hidden">Payment In</span>
            <span className="hidden sm:inline">Payment In (Deposit)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('out'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          style={activeTab === 'out' ? { color: '#ffffff', backgroundColor: 'var(--primary)' } : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1 sm:px-3 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'out' ? 'bg-[var(--primary)] text-white shadow-md text-white-force' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={activeTab === 'out' ? { color: '#ffffff' } : undefined} />
          <span className="text-[11px] sm:text-sm leading-tight text-center" style={activeTab === 'out' ? { color: '#ffffff' } : undefined}>
            <span className="sm:hidden">Payment Out</span>
            <span className="hidden sm:inline">Payment Out (Payout)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('transfer'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          style={activeTab === 'transfer' ? { color: '#ffffff', backgroundColor: 'var(--primary)' } : undefined}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 px-1 sm:px-3 rounded-lg font-bold transition-all cursor-pointer ${
            activeTab === 'transfer' ? 'bg-[var(--primary)] text-white shadow-md text-white-force' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={activeTab === 'transfer' ? { color: '#ffffff' } : undefined} />
          <span className="text-[11px] sm:text-sm leading-tight text-center" style={activeTab === 'transfer' ? { color: '#ffffff' } : undefined}>
            <span className="sm:hidden">Transfer</span>
            <span className="hidden sm:inline">Account Transfer</span>
          </span>
        </button>
      </div>

      {/* Form Container */}
      <div className="rounded-2xl p-4 sm:p-8 bg-white border border-slate-200 shadow-sm">
        {loadingLists ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
            <span className="text-sm text-slate-500">Loading master accounts...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Account selection for In / Out */}
              {activeTab !== 'transfer' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                    Account
                  </label>
                  <ResponsiveSelect
                    label="Account"
                    value={accountId}
                    options={accountOptions}
                    onChange={(val) => setAccountId(val)}
                  />
                </div>
              )}

              {/* Accounts selections for Transfers */}
              {activeTab === 'transfer' && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                      From Account (Source)
                    </label>
                    <ResponsiveSelect
                      label="From Account"
                      value={fromAccountId}
                      options={fromAccountOptions}
                      onChange={(val) => setFromAccountId(val)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                      To Account (Destination)
                    </label>
                    <ResponsiveSelect
                      label="To Account"
                      value={toAccountId}
                      options={toAccountOptions}
                      onChange={(val) => setToAccountId(val)}
                    />
                  </div>
                </>
              )}

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none font-mono"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Category for Payment In */}
              {activeTab === 'in' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                    Payment Category
                  </label>
                  <ResponsiveSelect
                    label="Payment Category"
                    value={category}
                    options={categoryInOptions}
                    onChange={(val) => setCategory(val)}
                  />
                </div>
              )}

              {/* Category for Payment Out */}
              {activeTab === 'out' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                    Payment Category
                  </label>
                  <ResponsiveSelect
                    label="Payment Category"
                    value={category}
                    options={categoryOutOptions}
                    onChange={(val) => setCategory(val)}
                  />
                </div>
              )}

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                  Payment Mode
                </label>
                <ResponsiveSelect
                  label="Payment Mode"
                  value={paymentMode}
                  options={paymentModeOptions}
                  onChange={(val) => setPaymentMode(val)}
                />
              </div>

              {/* Reference Number */}
              {paymentMode !== 'CASH' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                    {paymentMode === 'CHEQUE' ? 'Cheque Number' : 'Reference / UTR Number'}
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    placeholder={paymentMode === 'CHEQUE' ? "e.g. 123456" : "e.g. UTR1234567890"}
                  />
                </div>
              )}

              {/* Upload Box for UPI or Cheque */}
              {(paymentMode === 'CHEQUE' || paymentMode === 'UPI') && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 sm:mb-2">
                    {paymentMode === 'CHEQUE' ? 'Upload Cheque Image' : 'Upload Transaction Screenshot'}
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full px-3 sm:px-4 py-[7px] rounded-xl bg-white border border-slate-200 text-slate-500 text-xs sm:text-sm outline-none file:mr-3 sm:file:mr-4 file:py-1.5 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-light)] file:text-[var(--primary)] hover:file:bg-[var(--primary-light)]/85 cursor-pointer"
                  />
                </div>
              )}

              {/* Purpose Input */}
              <div className="col-span-1 sm:col-span-2">
                <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Transaction Purpose / Description
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Min 3 chars</span>
                </div>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  minLength={3}
                  className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                  placeholder="e.g. Server hosting renewal invoice #1123"
                  required
                />
              </div>
            </div>

            {/* Submit Button - Centered and full-width on mobile */}
            <div className="pt-4 sm:pt-6 border-t border-slate-100 flex items-center justify-center">
              <button
                type="submit"
                disabled={submitLoading}
                style={{ color: '#ffffff' }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-bold text-white text-white-force text-sm sm:text-base shadow-lg shadow-[var(--primary)]/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" style={{ color: '#ffffff' }} />
                    <span style={{ color: '#ffffff' }}>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#ffffff' }} />
                    <span style={{ color: '#ffffff' }}>Submit Ledger Record</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
