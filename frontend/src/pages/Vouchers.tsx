import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api } from '../services/api';
import { 
  Receipt, Plus, Search, Loader2, CheckCircle, AlertCircle, X,
  Printer, Trash2, Edit, Eye, Clock
} from 'lucide-react';

interface Account {
  id: string;
  name: string;
  currentBalance: number;
}

interface VoucherTransaction {
  id: string;
  voucherNo: string;
  transactionNo?: string;
  type: string;
  category: string;
  date: string; // from transaction or voucher createdAt
  amount: number;
  accountName: string;
  purpose: string;
  paymentMode: string;
  referenceNo?: string;
  partyName?: string;
  transferGroupId?: string;
  reversalOfId?: string;
  createdBy: string;
  filePath?: string;
  status: string;
}

interface CompanyInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo?: string | null;
  gstin?: string | null;
}

export const Vouchers: React.FC = () => {
  const [vouchers, setVouchers] = useState<VoucherTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [purpose, setPurpose] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  const [billFile, setBillFile] = useState<File | null>(null);
  
  const [viewBillUrl, setViewBillUrl] = useState<string | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserRole = currentUser.role || '';

  const handleApprove = async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this voucher?')) return;
    try {
      await api.post(`/payments/out/${id}/approve`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve voucher');
    }
  };

  const handleDisburse = async (id: string) => {
    if (!window.confirm('Are you sure you want to disburse this voucher?')) return;
    try {
      await api.post(`/payments/out/${id}/disburse`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disburse voucher');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [vouchersRes, accRes, companyRes] = await Promise.all([
        api.get('/payments/vouchers').catch(() => ({ data: { data: [] } })),
        api.get('/accounts').catch(() => ({ data: { data: [] } })),
        api.get('/company').catch(() => ({ data: { data: null } })),
      ]);
      
      const allVouchers = vouchersRes.data.data || [];
      const mapped = allVouchers.map((v: any) => ({
        id: v.id,
        voucherNo: v.voucherNo,
        transactionNo: v.transaction?.transactionNo,
        type: 'PAYMENT_OUT',
        category: v.category || v.transaction?.category || 'OTHER',
        date: v.transaction?.date || v.createdAt,
        amount: v.amount || v.transaction?.amount || 0,
        accountName: v.account?.name || v.transaction?.account?.name || 'Unknown',
        purpose: v.purpose || v.transaction?.purpose || '',
        paymentMode: v.paymentMode || v.transaction?.paymentMode || 'CASH',
        referenceNo: v.referenceNo || v.transaction?.referenceNo,
        createdBy: v.createdBy || v.transaction?.createdBy,
        filePath: v.filePath,
        status: v.status,
      }));
      setVouchers(mapped);
      
      setAccounts(accRes.data.data || []);
      if (companyRes.data.data) {
        setCompanyInfo(companyRes.data.data);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load vouchers.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => { loadData(); }, []);

  // Auto-refresh voucher data every 30s
  useAutoRefresh(loadData, 30000);


  const resetForm = () => {
    setAccountId('');
    setAmount('');
    setCategory('');
    setPurpose('');
    setPayeeName('');
    setPaymentMode('CASH');
    setReferenceNo('');
    setBillFile(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !amount || !purpose || !payeeName) {
      alert('Please fill all required fields');
      return;
    }

    setSubmitLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const fullPurpose = `${payeeName} - ${purpose}`;
      
      const formData = new FormData();
      formData.append('accountId', accountId);
      formData.append('amount', amount);
      formData.append('category', 'OTHER');
      formData.append('purpose', fullPurpose);
      formData.append('paymentMode', paymentMode);
      if (referenceNo) formData.append('referenceNo', referenceNo);
      if (billFile) formData.append('bill', billFile);

      await api.post('/payments/out', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMsg('Voucher recorded successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
        loadData();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create voucher.');
      setSubmitLoading(false);
    }
  };

  const handlePrint = (v: VoucherTransaction) => {
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return;
    
    const companyLogoUrl = companyInfo?.logo ? `http://localhost:5000/${companyInfo.logo}` : '';
    const companyNameStr = companyInfo?.name || 'COMPANY NAME';
    const companyAddressStr = companyInfo?.address || '';
    const companyPhoneStr = companyInfo?.phone ? `Ph: ${companyInfo.phone}` : '';
    const companyEmailStr = companyInfo?.email ? `Email: ${companyInfo.email}` : '';
    const companyGstinStr = companyInfo?.gstin ? `GSTIN: ${companyInfo.gstin}` : '';

    const voucherHTML = (title: string) => `
      <div class="voucher-wrapper">
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; gap: 15px; align-items: center;">
              ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />` : ''}
              <div>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #111;">${companyNameStr}</h2>
                ${companyAddressStr ? `<p style="margin: 2px 0 0; font-size: 11px; color: #555;">${companyAddressStr}</p>` : ''}
                <div style="font-size: 11px; color: #555; margin-top: 2px;">
                  ${[companyPhoneStr, companyEmailStr, companyGstinStr].filter(Boolean).join(' | ')}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <h1 class="title">PAYMENT VOUCHER</h1>
              <p style="margin: 3px 0 0; color: #666; font-size: 12px; font-family: monospace;">${v.voucherNo || v.transactionNo}</p>
              <span class="copy-badge">${title}</span>
            </div>
          </div>
        </div>
        <div class="grid">
          <div>
            <div class="label">Date</div>
            <div class="value">${new Date(v.date).toLocaleDateString()}</div>
          </div>
          <div>
            <div class="label">Category</div>
            <div class="value">${v.category.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div class="label">Payment Mode</div>
            <div class="value">${v.paymentMode.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div class="label">Source Account</div>
            <div class="value">${v.accountName}</div>
          </div>
        </div>
        <div>
          <div class="label">Purpose / Description</div>
          <div class="value" style="padding: 10px 15px; background: #f9f9f9; border-radius: 8px; margin-top: 8px; border: 1px solid #eee;">
            ${v.purpose}
          </div>
        </div>
        <div class="amount">
          ₹${v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div class="footer">
          <div class="sign">Authorized Signatory</div>
          <div class="sign">Receiver's Signature</div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Voucher - ${v.voucherNo || v.transactionNo}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; margin: 0; }
            .voucher-wrapper { padding: 20px; box-sizing: border-box; position: relative; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 15px; position: relative; }
            .title { font-size: 20px; font-weight: bold; margin: 0; }
            .copy-badge { position: absolute; top: 0; right: 0; padding: 4px 12px; background: #eee; border-radius: 12px; font-size: 12px; font-weight: bold; color: #555; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
            .value { font-size: 14px; font-weight: 500; margin-top: 4px; }
            .amount { font-size: 24px; font-weight: bold; margin-top: 15px; }
            .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; }
            .sign { width: 180px; border-top: 1px dashed #999; text-align: center; margin-top: 40px; padding-top: 8px; font-size: 12px; color: #555; }
            .cut-line { 
              border-top: 1px dashed #ccc; 
              margin: 15px 0; 
              position: relative; 
              text-align: center;
            }
            .cut-line::after {
              content: '✂-------------------------------------------------------';
              color: #999;
              font-size: 12px;
              position: absolute;
              top: -8px;
              background: white;
              padding: 0 10px;
            }
            @media print {
              body { padding: 0; }
              .voucher-wrapper { height: 48vh; padding: 10px 20px; }
            }
          </style>
        </head>
        <body>
          ${voucherHTML('Original - Office Copy')}
          <div class="cut-line"></div>
          ${voucherHTML('Duplicate - Receiver Copy')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete (reverse) this voucher?')) return;
    try {
      await api.post(`/ledger/${id}/reverse`, { purpose: 'Voucher Cancelled by User' });
      alert('Voucher deleted successfully');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete voucher. Note: Only Admins can reverse ledger entries.');
    }
  };

  const handleEdit = () => {
    alert('For accounting integrity, posted ledger vouchers cannot be edited directly. Please delete (reverse) this voucher and create a new one with correct details.');
  };

  const filteredVouchers = vouchers.filter(v => 
    v.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Receipt className="w-8 h-8 text-indigo-400" />
            Voucher System
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Manage ad-hoc company expenses, vendor payouts, and direct office costs.
          </p>
        </div>
        
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Voucher
        </button>
      </div>

      {/* Tools */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by voucher no, purpose, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-card-dark/40 border border-white/5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-gray-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-xl bg-card-dark/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Voucher No</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Purpose</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                    Loading vouchers...
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No vouchers found. Click "Create Voucher" to log one.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-white/5 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <span className="font-mono text-indigo-300 font-medium">
                        {v.voucherNo || v.transactionNo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {new Date(v.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-white/10 text-gray-300 rounded text-xs font-medium border border-white/5">
                        {v.category?.replace(/_/g, ' ') || 'OTHER'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-200 truncate max-w-xs" title={v.purpose}>{v.purpose}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Paid via {v.paymentMode?.replace(/_/g, ' ') || 'CASH'} from {v.accountName}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      ₹{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                      <td className="px-6 py-4 text-center">
                        {v.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        )}
                        {v.status === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            Pending Admin
                          </span>
                        )}
                        {v.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approved
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {v.status === 'PENDING_APPROVAL' && (currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(v.id); }}
                              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-xs font-medium transition"
                            >
                              Approve
                            </button>
                          )}
                          {v.status === 'APPROVED' && (currentUserRole === 'ACCOUNTS' || currentUserRole === 'ACCOUNT_I' || currentUserRole === 'ACCOUNT_II') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDisburse(v.id); }}
                              className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded text-xs font-medium transition"
                            >
                              Disburse
                            </button>
                          )}

                          {(v.status === 'COMPLETED' || currentUserRole === 'ADMIN' || currentUserRole === 'SUPER_ADMIN') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!v.filePath) {
                                  alert('No bill attached to this voucher');
                                  return;
                                }
                                const fileUrl = `http://localhost:5000/${v.filePath.includes('uploads') ? `uploads/${v.filePath.split(/[\\/]/).pop()}` : v.filePath}`;
                                setViewBillUrl(fileUrl);
                              }}
                              title={v.filePath ? "View Attached Bill" : "No Bill Attached"}
                              className={`p-1.5 rounded transition ${
                                v.filePath 
                                  ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' 
                                  : 'text-gray-600 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {v.status === 'COMPLETED' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handlePrint(v); }}
                              title="Print Voucher"
                              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {(v.status === 'COMPLETED' || v.status === 'PENDING_APPROVAL') && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                              title="Delete (Reverse) Voucher"
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121826] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-400" />
                  Record New Voucher
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {successMsg ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center animate-zoom-in">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 border border-emerald-500/30">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Voucher Generated</h3>
                  <p className="text-emerald-400">{successMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400 animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Source Account
                      </label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                        required
                      >
                        <option value="">-- Choose Account --</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Bal: ₹{a.currentBalance.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                        placeholder="e.g. 5000"
                        required
                      />
                    </div>



                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                      >
                        <option value="CASH">Cash</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Reference No. (Optional)
                      </label>
                      <input
                        type="text"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                        placeholder="Cheque / UPI / UTR No."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Payee Name
                          </label>
                          <input
                            type="text"
                            value={payeeName}
                            onChange={(e) => setPayeeName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                            placeholder="e.g. John Doe / Vendor Name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                            Purpose / Description
                          </label>
                          <input
                            type="text"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none"
                            placeholder="e.g. Computer repair charge by engineering team"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Attach Bill / Receipt (Optional)
                      </label>
                      <div className="relative group">
                        <input
                          type="file"
                          onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all"
                          accept="image/*,.pdf"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="px-6 py-2.5 rounded-xl font-medium bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-indigo-500/25 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Generate Voucher
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {viewBillUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setViewBillUrl(null)}>
          <div className="bg-[#0e1420] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-white/10 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Attached Bill / Receipt</h2>
              </div>
              <button 
                onClick={() => setViewBillUrl(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 bg-black/20 flex items-center justify-center overflow-auto min-h-[500px]">
              {viewBillUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={viewBillUrl} 
                  className="w-full h-[70vh] rounded-xl border border-white/10 bg-white"
                  title="Bill PDF"
                />
              ) : (
                <img 
                  src={viewBillUrl} 
                  alt="Attached Bill" 
                  className="max-w-full max-h-[70vh] object-contain rounded-xl border border-white/10"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
