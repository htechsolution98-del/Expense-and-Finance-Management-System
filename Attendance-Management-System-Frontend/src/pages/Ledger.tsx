import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api, getBackendUrl } from '../services/api';
import { RefreshCw, Filter, ShieldAlert, Ban, X, AlertCircle, Download, Printer } from 'lucide-react';
import { ResponsiveSelect, type ResponsiveSelectOption } from '../components/ResponsiveSelect';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoriesList, setCategoriesList] = useState<{ id: string, name: string }[]>([]);
  const [accountsList, setAccountsList] = useState<{ id: string, name: string }[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

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
        limit: 10,
        ...(typeFilter && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(accountFilter && { accountId: accountFilter }),
        ...(fromDate && { startDate: fromDate }),
        ...(toDate && { endDate: toDate }),
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

  const handleExportCSV = async () => {
    try {
      const params = {
        limit: 100000,
        ...(typeFilter && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(accountFilter && { accountId: accountFilter }),
        ...(fromDate && { startDate: fromDate }),
        ...(toDate && { endDate: toDate }),
      };

      const response = await api.get('/ledger', { params });
      const records = response.data.data || [];

      if (records.length === 0) {
        alert('No data to export.');
        return;
      }

      const headers = [
        'Transaction No',
        'Voucher No',
        'Date',
        'Account',
        'Details & Target',
        'Type',
        'Category',
        'Payment Mode',
        'Amount (INR)',
        'Reference No'
      ];

      const rows = records.map((t: any) => [
        t.transactionNo || '',
        t.voucherNo || '',
        new Date(t.date).toLocaleString(),
        t.accountName || '',
        `${t.purpose || ''} (Party: ${t.partyName || ''})`,
        t.type || '',
        t.category || '',
        t.paymentMode || '',
        t.amount.toString(),
        t.referenceNo || '',
      ]);

      const csvContent = "\uFEFF" + [
        headers.join(','),
        ...rows.map((row: string[]) =>
          row
            .map((value: string) => {
              const escaped = String(value).replace(/"/g, '""');
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
      link.setAttribute('download', `ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export ledger data.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const params = {
        limit: 100000,
        ...(typeFilter && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(accountFilter && { accountId: accountFilter }),
        ...(fromDate && { startDate: fromDate }),
        ...(toDate && { endDate: toDate }),
      };

      const response = await api.get('/ledger', { params });
      const records = response.data.data || [];

      if (records.length === 0) {
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

      const tableRows = records
        .map((t: any) => `
          <tr>
            <td style="font-family: monospace; font-weight: bold; color: #111;">${t.transactionNo || ''}</td>
            <td>${new Date(t.date).toLocaleDateString()}</td>
            <td>${t.accountName || ''}</td>
            <td>
              <div style="font-weight: 600; color: #111;">${t.purpose || ''}</div>
              <div style="font-size: 10px; color: #666; margin-top: 2px;">Party: ${t.partyName || ''} | Category: ${t.category || ''}</div>
            </td>
            <td>${t.paymentMode || ''}</td>
            <td style="text-align: right; font-weight: bold; color: ${t.type === 'PAYMENT_IN' ? '#10b981' : '#ef4444'}">
              ${t.type === 'PAYMENT_IN' ? `+₹${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `-₹${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </td>
          </tr>
        `)
        .join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Ledger Statement - ${new Date().toLocaleDateString()}</title>
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
                <div class="title">Ledger Statement</div>
                <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
                <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Txn No</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Details</th>
                  <th>Mode</th>
                  <th style="text-align: right;">Amount</th>
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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to export ledger PDF.');
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter, categoryFilter, accountFilter, fromDate, toDate]);

  // Auto-refresh transactions every 30s
  useAutoRefresh(fetchTransactions, 30000, [page, typeFilter, categoryFilter, accountFilter, fromDate, toDate]);


  useEffect(() => {
    api.get('/company').then(res => setCompanyInfo(res.data.data)).catch(console.error);
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

  const accountOptions: ResponsiveSelectOption[] = [
    { value: '', label: 'All Accounts' },
    ...accountsList.map((a) => ({ value: a.id, label: a.name })),
  ];

  const typeOptions: ResponsiveSelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'PAYMENT_IN', label: 'Payment In (Credit)' },
    { value: 'PAYMENT_OUT', label: 'Payment Out (Debit)' },
    { value: 'TRANSFER_OUT', label: 'Transfer Out' },
    { value: 'TRANSFER_IN', label: 'Transfer In' },
    { value: 'REVERSAL', label: 'Reversals' },
  ];

  const categoryOptions: ResponsiveSelectOption[] = [
    { value: '', label: 'All Categories' },
    ...categoriesList.map((c) => ({ value: c.name, label: c.name })),
    { value: 'CLIENT_PAYMENT', label: 'Client Payments (System)' },
    { value: 'VENDOR_PAYMENT', label: 'Vendor Payments (System)' },
    { value: 'OFFICE_EXPENSE', label: 'Office Overhead (System)' },
    { value: 'INTERNAL_TRANSFER', label: 'Internal Transfers (System)' },
    { value: 'LOAN_RECEIVED', label: 'Loan Principal (System)' },
    { value: 'LOAN_REPAYMENT', label: 'Loan Payments (System)' },
    { value: 'STAFF_REIMBURSEMENT', label: 'Staff Reimbursements (System)' },
    { value: 'STAFF_ADVANCE', label: 'Staff Advances (System)' },
    { value: 'SALARY_PAYMENT', label: 'Salaries (System)' },
    { value: 'OTHER', label: 'Other Categories (System)' },
  ];

  const hasActiveFilters = Boolean(typeFilter || categoryFilter || accountFilter || fromDate || toDate);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 sm:pb-0">
      {/* Header section */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Unified Transaction Ledger
          </h1>
          <p className="text-slate-500 mt-1 sm:mt-1.5 text-xs sm:text-sm">
            Access the immutable single-entry ledger registry. Tracks all deposits, outflows, and corrections.
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-600">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filters</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setAccountFilter('');
                setTypeFilter('');
                setCategoryFilter('');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* 3 Dropdown Filters using ResponsiveSelect */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Account
            </label>
            <ResponsiveSelect
              label="Account"
              value={accountFilter}
              options={accountOptions}
              onChange={(val) => {
                setAccountFilter(val);
                setPage(1);
              }}
              className="!py-2 !text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Type
            </label>
            <ResponsiveSelect
              label="Type"
              value={typeFilter}
              options={typeOptions}
              onChange={(val) => {
                setTypeFilter(val);
                setPage(1);
              }}
              className="!py-2 !text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <ResponsiveSelect
              label="Category"
              value={categoryFilter}
              options={categoryOptions}
              onChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
              className="!py-2 !text-xs"
            />
          </div>
        </div>

        {/* Date Filter & Export Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-slate-800 text-xs outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-slate-800 text-xs outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-98"
                style={{ color: '#ffffff' }}
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span className="text-white-force">Export CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-98"
                style={{ color: '#ffffff' }}
              >
                <Printer className="w-3.5 h-3.5 text-white" />
                <span className="text-white-force">Print PDF</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold font-mono text-center sm:text-right">
              Page {page} of {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Ledger Table (>= 640px) */}
      <div className="hidden sm:block rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50/80">
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
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && transactions.length === 0 ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td colSpan={8} className="h-16 bg-slate-50/50"></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium italic">
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
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Code and Voucher */}
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-bold text-slate-900 font-mono block">
                          {trx.transactionNo}
                        </span>
                        {trx.voucherNo && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-600 font-mono">
                            {trx.voucherNo}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-slate-600 font-mono">
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
                        <span className="text-slate-800 font-semibold block">
                          {trx.accountName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {trx.paymentMode} {trx.referenceNo ? `(${trx.referenceNo})` : ''}
                        </span>
                      </td>

                      {/* Details & Target */}
                      <td className="px-6 py-4 space-y-1 max-w-xs">
                        <p className="text-slate-800 font-medium line-clamp-2">
                          {trx.purpose}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase">
                            {trx.category.replace('_', ' ')}
                          </span>
                          {trx.partyName && (
                            <span className="text-[10px] text-slate-500">
                              Party: <span className="text-slate-700 font-semibold">{trx.partyName}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Debit (DR) */}
                      <td className="px-6 py-4 text-right font-bold font-mono text-sm">
                        {!isCredit ? (
                          <span className={isReversal ? "text-amber-600" : "text-rose-600"}>
                            {isReversal ? '↺ ' : ''}₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Credit (CR) */}
                      <td className="px-6 py-4 text-right font-bold font-mono text-sm">
                        {isCredit ? (
                          <span className="text-emerald-600">
                            +₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Account Balance */}
                      <td className="px-6 py-4 text-right font-bold font-mono text-sm text-slate-600">
                        ₹{(trx.accountBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Reversals Actions */}
                      <td className="px-6 py-4 text-center">
                        {isReversal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Correction</span>
                          </span>
                        ) : trx.reversalOfId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Reversed</span>
                          </span>
                        ) : canReverse ? (
                          <button
                            onClick={() => handleReverseClick(trx.id)}
                            className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-600 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                          >
                            Reverse
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">Locked</span>
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
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer shadow-sm"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer shadow-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Mobile Card View (< 640px) */}
      <div className="sm:hidden space-y-3">
        {loading && transactions.length === 0 ? (
          [1, 2, 3].map((n) => (
            <div key={n} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : transactions.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-sm font-medium italic">
              No transactions registered matching this criteria.
            </p>
          </div>
        ) : (
          transactions.map((trx) => {
            const isCredit = trx.type === 'PAYMENT_IN' || trx.type === 'TRANSFER_IN';
            const isReversal = trx.type === 'REVERSAL';

            return (
              <div
                key={trx.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                {/* Header row: Transaction No, Voucher, Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 font-mono text-xs block">
                      {trx.transactionNo}
                    </span>
                    {trx.voucherNo && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-600 font-mono">
                        {trx.voucherNo}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <div className={`font-black font-mono text-base ${
                      isCredit
                        ? 'text-emerald-600'
                        : isReversal
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}>
                      {isCredit ? '+' : isReversal ? '↺ ' : '-'}₹{trx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase mt-0.5 ${
                      isCredit
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isReversal
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isCredit ? 'Credit / In' : isReversal ? 'Correction' : 'Debit / Out'}
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Date:</span>
                    <span className="font-mono text-slate-700">
                      {new Date(trx.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-500">
                    <span>Account:</span>
                    <span className="font-bold text-slate-800 text-right">
                      {trx.accountName}
                      <span className="font-normal text-slate-500 block text-[10px]">
                        {trx.paymentMode} {trx.referenceNo ? `(${trx.referenceNo})` : ''}
                      </span>
                    </span>
                  </div>

                  {trx.purpose && (
                    <div className="pt-1">
                      <div className="text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {trx.purpose}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                    <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">
                      {trx.category.replace('_', ' ')}
                    </span>
                    {trx.partyName && (
                      <span className="text-[11px] text-slate-500">
                        Party: <span className="font-semibold text-slate-700">{trx.partyName}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-slate-500 pt-1">
                    <span className="text-[11px] font-medium">Balance After Txn:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ₹{(trx.accountBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Reversal / Adjustments Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    {isReversal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                        <Ban className="w-2.5 h-2.5" />
                        <span>Correction Entry</span>
                      </span>
                    ) : trx.reversalOfId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                        <Ban className="w-2.5 h-2.5" />
                        <span>Reversed</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Regular Entry</span>
                    )}
                  </div>

                  {!isReversal && !trx.reversalOfId && canReverse && (
                    <button
                      onClick={() => handleReverseClick(trx.id)}
                      className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                    >
                      Reverse
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Reversal Reason Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-zoom-in max-h-[90vh] flex flex-col">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reverse Transaction</h3>
              </div>
              <button
                onClick={() => setShowReverseModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              {revError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{revError}</span>
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Reversing this transaction will post a matching counter-balance entry in the ledger registry and restore the original account balance. This action cannot be undone.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Reversal Reason *
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-slate-900 text-xs outline-none h-24 resize-none transition-all"
                  placeholder="e.g. Accidental amount double entry, invoice amount correction."
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={revLoading}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer text-center"
                  style={{ color: '#ffffff' }}
                >
                  <span className="text-white-force">{revLoading ? 'Reversing...' : 'Execute Reversal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
