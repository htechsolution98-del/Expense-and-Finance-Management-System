import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { Wallet, ArrowDownLeft, ArrowUpRight, Repeat, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}



export const Payments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'in' | 'out' | 'transfer'>('in');
  const [accounts, setAccounts] = useState<Account[]>([]);
  // removed unused states
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
  const [partyType, setPartyType] = useState<'NONE' | 'CLIENT' | 'VENDOR' | 'EMPLOYEE' | 'LOAN'>('NONE');
  const [selectedPartyId, setSelectedPartyId] = useState('');

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
      setErrorMsg('Failed to load accounts or party details.');
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
    setSelectedPartyId('');
    setCategory('');
    setPartyType('NONE');
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setSubmitLoading(true);

    const buildFormData = () => {
      const formData = new FormData();
      formData.append('accountId', accountId);
      formData.append('amount', amount);
      formData.append('category', category || 'OTHER');
      formData.append('purpose', purpose);
      formData.append('paymentMode', paymentMode);
      if (referenceNo) formData.append('referenceNo', referenceNo);
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
          purpose,
          referenceNo: referenceNo || undefined,
        });
        setSuccessMsg('Internal transfer successfully completed.');
      }

      resetForm();
      loadMasterData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Transaction submission failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Record Financial Transaction
        </h1>
        <p className="text-gray-400 mt-1.5 text-sm">
          Log cash/bank deposits, payouts, and transfers with atomic database safeguards.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-sm text-emerald-400">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 rounded-xl bg-white/5 border border-white/5 gap-1">
        <button
          onClick={() => { setActiveTab('in'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'in' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Payment In (Deposit)</span>
        </button>

        <button
          onClick={() => { setActiveTab('out'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'out' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Payment Out (Payout)</span>
        </button>

        <button
          onClick={() => { setActiveTab('transfer'); resetForm(); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'transfer' ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Account Transfer</span>
        </button>
      </div>

      {/* Form Container */}
      <div className="glass-panel rounded-2xl p-8 bg-card-dark/40 border border-white/5 shadow-xl">
        {loadingLists ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-sm text-gray-500">Loading master accounts...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Account selection for In / Out */}
              {activeTab !== 'transfer' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Account
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                    required
                  >
                    <option value="">-- Choose Account --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Bal: ₹{a.currentBalance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Accounts selections for Transfers */}
              {activeTab === 'transfer' && (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      From Account (Source)
                    </label>
                    <select
                      value={fromAccountId}
                      onChange={(e) => setFromAccountId(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                      required
                    >
                      <option value="">-- Choose Source --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (Bal: ₹{a.currentBalance.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      To Account (Destination)
                    </label>
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                      required
                    >
                      <option value="">-- Choose Destination --</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (Bal: ₹{a.currentBalance.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Amount */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none font-mono"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Category for Payment In */}
              {activeTab === 'in' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Payment Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    {categoriesList
                      .filter((c) => c.type === 'PAYMENT_IN' || c.type === 'BOTH')
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Category for Payment Out */}
              {activeTab === 'out' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Payment Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    {categoriesList
                      .filter((c) => c.type === 'PAYMENT_OUT' || c.type === 'BOTH')
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Payment Mode */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                >
                  <option value="BANK_TRANSFER">Bank NetBanking Transfer</option>
                  <option value="CASH">Physical Cash</option>
                  <option value="UPI">UPI Payment Channels</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="CHEQUE">Physical Cheque</option>
                  <option value="OTHER">Other Channel</option>
                </select>
              </div>

              {/* Reference Number */}
              {paymentMode !== 'CASH' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    {paymentMode === 'CHEQUE' ? 'Cheque Number' : 'Reference / UTR Number'}
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                    placeholder={paymentMode === 'CHEQUE' ? "e.g. 123456" : "e.g. UTR1234567890"}
                  />
                </div>
              )}

              {/* Upload Box for UPI or Cheque */}
              {(paymentMode === 'CHEQUE' || paymentMode === 'UPI') && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    {paymentMode === 'CHEQUE' ? 'Upload Cheque Image' : 'Upload Transaction Screenshot'}
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full px-4 py-[7px] rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30 cursor-pointer"
                  />
                </div>
              )}



              {/* Purpose Input */}
              <div className="col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Transaction Purpose / Description
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                  placeholder="e.g. Server hosting renewal invoice #1123"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                type="submit"
                disabled={submitLoading}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 font-bold text-white text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Transaction...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>Submit Ledger Record</span>
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
