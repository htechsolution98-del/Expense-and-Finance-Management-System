import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api, getBackendUrl } from '../services/api';
import { 
  Receipt, Plus, Search, Loader2, CheckCircle, AlertCircle, X,
  Printer, Trash2, Edit, Eye, Clock, Download
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
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
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
    
    const companyLogoUrl = companyInfo?.logo ? `${getBackendUrl()}/${companyInfo.logo}` : '';
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

  const handleExportCSV = () => {
    if (filteredVouchers.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Voucher No', 'Date', 'Category', 'Purpose', 'Amount (INR)', 'Payment Mode', 'Source Account', 'Status'];
    
    const rows = filteredVouchers.map((v) => [
      v.voucherNo || v.transactionNo || '',
      new Date(v.date).toLocaleDateString(),
      v.category || 'OTHER',
      v.purpose || '',
      v.amount.toString(),
      v.paymentMode || 'CASH',
      v.accountName || '',
      v.status || '',
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')
              ? `"${escaped}"`
              : escaped;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vouchers_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredVouchers.length === 0) {
      alert('No data to export.');
      return;
    }

    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) return;

    const companyLogoUrl = companyInfo?.logo ? `${getBackendUrl()}/${companyInfo.logo}` : '';
    const companyNameStr = companyInfo?.name || 'COMPANY NAME';
    const companyAddressStr = companyInfo?.address || '';
    const companyPhoneStr = companyInfo?.phone ? `Ph: ${companyInfo.phone}` : '';
    const companyEmailStr = companyInfo?.email ? `Email: ${companyInfo.email}` : '';
    const companyGstinStr = companyInfo?.gstin ? `GSTIN: ${companyInfo.gstin}` : '';

    const tableRows = filteredVouchers
      .map((v) => `
        <tr>
          <td style="font-family: monospace; font-weight: bold; color: #111;">${v.voucherNo || v.transactionNo || ''}</td>
          <td>${new Date(v.date).toLocaleDateString()}</td>
          <td>
            <div style="font-weight: 600; color: #111;">${v.category || 'OTHER'}</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">Account: ${v.accountName || ''}</div>
          </td>
          <td>${v.purpose || ''}</td>
          <td>${v.paymentMode || 'CASH'}</td>
          <td style="text-align: right; font-weight: bold; color: #111;">
            ₹${v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: 10px;">
            ${v.status || ''}
          </td>
        </tr>
      `)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Vouchers Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 30px; color: #333; margin: 0; }
            .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; color: #111; }
            .meta { font-size: 11px; color: #555; font-family: monospace; margin-top: 4px; }
            .company-info h2 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .company-info p { margin: 2px 0; font-size: 11px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f4f5f7; font-weight: bold; color: #444; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            tr:hover { background: #f9fafb; }
            @media print {
              body { padding: 0; }
              th { background: #f4f5f7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 50px; margin-bottom: 8px;" />` : ''}
              <h2>${companyNameStr}</h2>
              ${companyAddressStr ? `<p>${companyAddressStr}</p>` : ''}
              <p>${[companyPhoneStr, companyEmailStr, companyGstinStr].filter(Boolean).join(' | ')}</p>
            </div>
            <div style="text-align: right;">
              <div class="title">Vouchers Report</div>
              <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
              <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Date</th>
                <th>Category</th>
                <th>Purpose</th>
                <th>Mode</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const filteredVouchers = vouchers.filter(v => {
    // 1. Text Search Filter
    const matchesSearch = 
      v.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.category?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date range filter
    const voucherDate = new Date(v.date);
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      if (voucherDate < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (voucherDate > end) return false;
    }

    return true;
  });

  // Pagination logic
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredVouchers.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredVouchers.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentVouchers = filteredVouchers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
            <Receipt className="w-8 h-8 text-[var(--primary)]" />
            Voucher System
          </h1>
          <p className="text-[var(--text-secondary)] mt-1.5 text-sm">
            Manage ad-hoc company expenses, vendor payouts, and direct office costs.
          </p>
        </div>
        
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl shadow-lg shadow-[var(--primary)]/15 transition-all flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Voucher
        </button>
      </div>

      {/* Tools */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by voucher no, purpose, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 text-slate-900 placeholder-slate-400 outline-none transition-all"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-[var(--primary)] outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-[var(--primary)] outline-none transition-all"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-3 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            title="Export data to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            title="Print data to PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[var(--text-secondary)] border-b border-slate-200">
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
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--primary)]" />
                    Loading vouchers...
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No vouchers found. Click "Create Voucher" to log one.
                  </td>
                </tr>
              ) : (
                currentVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <span className="font-mono text-[var(--primary)] font-medium">
                        {v.voucherNo || v.transactionNo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      {new Date(v.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">
                        {v.category?.replace(/_/g, ' ') || 'OTHER'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[var(--text-primary)] truncate max-w-xs" title={v.purpose}>{v.purpose}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Paid via {v.paymentMode?.replace(/_/g, ' ') || 'CASH'} from {v.accountName}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--text-primary)]">
                      ₹{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                      <td className="px-6 py-4 text-center">
                        {v.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        )}
                        {v.status === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            Pending Admin
                          </span>
                        )}
                        {v.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
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
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium border border-emerald-200 transition"
                            >
                              Approve
                            </button>
                          )}
                          {v.status === 'APPROVED' && (currentUserRole === 'ACCOUNTS' || currentUserRole === 'ACCOUNT_I' || currentUserRole === 'ACCOUNT_II') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDisburse(v.id); }}
                              className="px-3 py-1.5 bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary-light)]/80 rounded text-xs font-medium transition"
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
                                const fileUrl = `${getBackendUrl()}/${v.filePath.includes('uploads') ? `uploads/${v.filePath.split(/[\\/]/).pop()}` : v.filePath}`;
                                setViewBillUrl(fileUrl);
                              }}
                              title={v.filePath ? "View Attached Bill" : "No Bill Attached"}
                              className={`p-1.5 rounded transition ${
                                v.filePath 
                                  ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50' 
                                  : 'text-slate-300 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {v.status === 'COMPLETED' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handlePrint(v); }}
                              title="Print Voucher"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {(v.status === 'COMPLETED' || v.status === 'PENDING_APPROVAL') && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                              title="Delete (Reverse) Voucher"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
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

          {/* Pagination Controls */}
          {filteredVouchers.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <div className="text-xs text-[var(--text-secondary)] font-medium">
                Showing <span className="font-bold text-[var(--text-primary)]">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-bold text-[var(--text-primary)]">
                  {Math.min(indexOfLastItem, filteredVouchers.length)}
                </span>{' '}
                of <span className="font-bold text-[var(--text-primary)]">{filteredVouchers.length}</span> vouchers
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                  >
                    Previous
                  </button>

                  {/* Render page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                    // Show first, last, current, and pages around current
                    const isFirstOrLast = pageNumber === 1 || pageNumber === totalPages;
                    const isNearCurrent = Math.abs(pageNumber - currentPage) <= 1;

                    if (isFirstOrLast || isNearCurrent) {
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === pageNumber
                              ? 'bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/15 border-none'
                              : 'border border-slate-200 text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] bg-white'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    }

                    // Show ellipses for gaps
                    if (
                      (pageNumber === 2 && currentPage > 3) ||
                      (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                    ) {
                      return (
                        <span key={pageNumber} className="px-1 text-[var(--text-muted)] text-xs font-semibold">
                          ...
                        </span>
                      );
                    }

                    return null;
                  })}

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[var(--primary)]" />
                  Record New Voucher
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {successMsg ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center animate-zoom-in">
                  <div className="w-16 h-16 bg-[var(--primary-light)] rounded-full flex items-center justify-center mb-4 border border-emerald-200">
                    <CheckCircle className="w-8 h-8 text-[var(--primary)]" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Voucher Generated</h3>
                  <p className="text-[var(--primary)]">{successMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {errorMsg && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-700 animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Source Account
                      </label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
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
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
                        placeholder="e.g. 5000"
                        required
                      />
                    </div>



                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
                      >
                        <option value="CASH">Cash</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Reference No. (Optional)
                      </label>
                      <input
                        type="text"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
                        placeholder="Cheque / UPI / UTR No."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                            Payee Name
                          </label>
                          <input
                            type="text"
                            value={payeeName}
                            onChange={(e) => setPayeeName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
                            placeholder="e.g. John Doe / Vendor Name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                            Purpose / Description
                          </label>
                          <input
                            type="text"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 outline-none"
                            placeholder="e.g. Computer repair charge by engineering team"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Attach Bill / Receipt (Optional)
                      </label>
                      <div className="relative group">
                        <input
                          type="file"
                          onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] text-slate-500 outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-light)] file:text-[var(--primary)] hover:file:bg-[var(--primary-light)]/85 transition-all"
                          accept="image/*,.pdf"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="px-6 py-2.5 rounded-xl font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-lg shadow-[var(--primary)]/15 transition disabled:opacity-50 flex items-center gap-2"
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
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-[var(--primary)]" />
                <h2 className="text-lg font-bold text-slate-900">Attached Bill / Receipt</h2>
              </div>
              <button 
                onClick={() => setViewBillUrl(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 bg-slate-50 flex items-center justify-center overflow-auto min-h-[500px]">
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
