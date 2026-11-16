import React, { useState, useEffect } from 'react';
import { api, getBackendUrl } from '../services/api';
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
  ExternalLink,
  Download,
  Printer,
  Search
} from 'lucide-react';
import { ResponsiveSelect, type ResponsiveSelectOption } from '../components/ResponsiveSelect';

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
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination & Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredLoans = loans.filter(l => {
    // 1. Text Search Filter
    const matchesSearch =
      l.loanNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.lender?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.purpose?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date range filter
    const loanDate = new Date(l.receivedDate);
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      if (loanDate < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (loanDate > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredLoans.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLoans = filteredLoans.slice(indexOfFirstItem, indexOfLastItem);

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
      const [loanRes, accRes, companyRes] = await Promise.all([
        api.get('/masters/loans'),
        api.get('/accounts'),
        api.get('/company').catch(() => ({ data: { data: null } }))
      ]);
      setLoans(loanRes.data.data);
      setAccounts(accRes.data.data);
      if (companyRes?.data?.data) {
        setCompanyInfo(companyRes.data.data);
      }
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

  const handleExportCSV = () => {
    if (filteredLoans.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Loan No',
      'Lender',
      'Borrow Date',
      'Principal (INR)',
      'Interest Rate',
      'Repaid (INR)',
      'Outstanding (INR)',
      'Status',
      'Purpose'
    ];

    const rows = filteredLoans.map((l) => {
      const balance = loanBalances[l.id] || { repaid: 0, utilized: 0 };
      const outstanding = computeOutstanding(l);
      return [
        l.loanNo || '',
        l.lender || '',
        new Date(l.receivedDate).toLocaleDateString(),
        l.principal.toString(),
        `${l.interestRate}% p.a.`,
        balance.repaid.toString(),
        outstanding.toString(),
        l.status || '',
        l.purpose || ''
      ];
    });

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
    link.setAttribute('download', `loans_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredLoans.length === 0) {
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

    const tableRows = filteredLoans
      .map((l) => {
        const balance = loanBalances[l.id] || { repaid: 0, utilized: 0 };
        const outstanding = computeOutstanding(l);
        return `
          <tr>
            <td style="font-family: monospace; font-weight: bold; color: #111;">${l.loanNo || ''}</td>
            <td>${l.lender || ''}</td>
            <td>${new Date(l.receivedDate).toLocaleDateString()}</td>
            <td style="text-align: right; font-weight: 600;">₹${l.principal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">${l.interestRate}% p.a.</td>
            <td style="text-align: right; color: #10b981; font-weight: 600;">₹${balance.repaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; color: #d97706; font-weight: 600;">₹${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: center; font-weight: bold; font-size: 10px;">${l.status || ''}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Loans Report - ${new Date().toLocaleDateString()}</title>
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
              <div class="title">Loans & Udhaar Ledger Report</div>
              <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
              <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Loan No</th>
                <th>Lender</th>
                <th>Borrow Date</th>
                <th style="text-align: right;">Principal</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Repaid</th>
                <th style="text-align: right;">Outstanding</th>
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

  const accountOptions: ResponsiveSelectOption[] = accounts.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.type}) - Bal: ${fmt(a.currentBalance)}`,
  }));

  const paymentModeOptions: ResponsiveSelectOption[] = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI / Net Banking' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'OTHER', label: 'Other' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 sm:pb-0">
      {/* KPI Section - 2x2 pair on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Card 1: Total Borrowed */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Borrowed
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Landmark className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-slate-900 block truncate">
              {fmt(totalBorrowed)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Lifetime borrowings</span>
          </div>
        </div>

        {/* Card 2: Total Repaid */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Repaid
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-emerald-600 block truncate">
              {fmt(totalRepaid)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Principal settled</span>
          </div>
        </div>

        {/* Card 3: Outstanding Principal */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-amber-600 block truncate">
              {fmt(totalOutstanding)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Pending liability</span>
          </div>
        </div>

        {/* Card 4: Total Utilized */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Utilized
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-slate-900 block truncate">
              {fmt(totalUtilized)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Deployed funds</span>
          </div>
        </div>
      </div>

      {/* Error & Controls */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header & Main Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            Business Borrowings & Udhaar
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage company loans, track repayments, and monitor fund utilization
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh Loans"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setFormError('');
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-sm transition-all cursor-pointer text-xs sm:text-sm active:scale-98"
            style={{ color: '#ffffff' }}
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-white-force">Record Borrowing (Udhaar)</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Find/Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search loan no, lender, purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {/* Date range filters */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 text-slate-800 text-xs outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 text-slate-800 text-xs outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div>
            {(searchTerm || fromDate || toDate) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFromDate('');
                  setToDate('');
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
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
        </div>
      </div>

      {/* Desktop Loans Table (>= 640px) */}
      <div className="hidden sm:block rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-bold uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && loans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
                    Loading business borrowings...
                  </td>
                </tr>
              ) : filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium italic">
                    {loans.length === 0
                      ? "No active business borrowings registered."
                      : "No business borrowings found for the selected date range."}
                  </td>
                </tr>
              ) : (
                currentLoans.map((l) => {
                  const balance = loanBalances[l.id] || { repaid: 0, utilized: 0 };
                  const outstanding = computeOutstanding(l);

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            l.status === 'SETTLED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            LN
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{l.lender}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 block">Loan No: {l.loanNo}</span>
                            <span className="text-[10px] text-slate-500 block max-w-xs truncate">{l.purpose}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                        {new Date(l.receivedDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        {fmt(l.principal)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 font-medium">
                        {l.interestRate}% <span className="text-[10px] text-slate-400">p.a.</span>
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
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-indigo-600 text-xs font-semibold cursor-pointer transition-all"
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
                                className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold cursor-pointer transition-all"
                              >
                                Repay
                              </button>
                              <button
                                onClick={() => {
                                  setActionError('');
                                  setActionLoan(l);
                                  setShowActionModal('UTILIZE');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold cursor-pointer transition-all"
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
                                  ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700'
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

        {/* Desktop Pagination Controls */}
        {filteredLoans.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(indexOfLastItem, filteredLoans.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredLoans.length}</span> loans
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                  const isFirstOrLast = pageNumber === 1 || pageNumber === totalPages;
                  const isNearCurrent = Math.abs(pageNumber - currentPage) <= 1;

                  if (isFirstOrLast || isNearCurrent) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNumber
                            ? 'bg-emerald-600 text-white shadow-sm border-none'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100 bg-white'
                        }`}
                        style={currentPage === pageNumber ? { color: '#ffffff' } : undefined}
                      >
                        {pageNumber}
                      </button>
                    );
                  }

                  if (
                    (pageNumber === 2 && currentPage > 3) ||
                    (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <span key={pageNumber} className="px-1 text-slate-400 text-xs font-semibold">
                        ...
                      </span>
                    );
                  }

                  return null;
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Loans Card View (< 640px) */}
      <div className="sm:hidden space-y-3">
        {loading && loans.length === 0 ? (
          [1, 2].map((n) => (
            <div key={n} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : filteredLoans.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
            <p className="text-slate-500 text-sm font-medium italic">
              {loans.length === 0
                ? "No active business borrowings registered."
                : "No business borrowings found for the selected date range."}
            </p>
          </div>
        ) : (
          currentLoans.map((l) => {
            const balance = loanBalances[l.id] || { repaid: 0, utilized: 0 };
            const outstanding = computeOutstanding(l);

            return (
              <div key={l.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                {/* Header row: Lender, Loan No, Status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{l.lender}</h4>
                    <span className="text-[10px] font-mono font-bold text-slate-500 block">
                      Loan No: {l.loanNo}
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    l.status === 'SETTLED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {l.status === 'SETTLED' ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Settled</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-2.5 h-2.5" />
                        <span>Active</span>
                      </>
                    )}
                  </span>
                </div>

                {l.purpose && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {l.purpose}
                  </p>
                )}

                {/* 2x2 Financial Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Principal</span>
                    <span className="font-black text-slate-900 text-sm mt-0.5 block">{fmt(l.principal)}</span>
                    <span className="text-[10px] text-slate-500">{l.interestRate}% p.a.</span>
                  </div>

                  <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <span className="text-[10px] uppercase font-bold text-amber-600 block">Outstanding</span>
                    <span className="font-black text-amber-600 text-sm mt-0.5 block">{fmt(outstanding)}</span>
                    <span className="text-[10px] text-amber-700/70">Remaining</span>
                  </div>

                  <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block">Repaid</span>
                    <span className="font-black text-emerald-600 text-sm mt-0.5 block">{fmt(balance.repaid)}</span>
                    <span className="text-[10px] text-emerald-700/70">Cleared</span>
                  </div>

                  <div className="bg-violet-50/50 p-2.5 rounded-xl border border-violet-100">
                    <span className="text-[10px] uppercase font-bold text-violet-600 block">Utilized</span>
                    <span className="font-black text-violet-600 text-sm mt-0.5 block">{fmt(balance.utilized)}</span>
                    <span className="text-[10px] text-violet-700/70">Spent</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                  <span>Borrow Date:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(l.receivedDate).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                {/* Actions Row */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => handleViewHistory(l)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-indigo-600 text-xs font-bold cursor-pointer transition-all"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Logs</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {l.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => {
                            setActionError('');
                            setActionLoan(l);
                            setShowActionModal('REPAY');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold cursor-pointer transition-all"
                        >
                          Repay
                        </button>
                        <button
                          onClick={() => {
                            setActionError('');
                            setActionLoan(l);
                            setShowActionModal('UTILIZE');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold cursor-pointer transition-all"
                        >
                          Utilize
                        </button>
                      </>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleToggleStatus(l)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                          l.status === 'ACTIVE'
                            ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700'
                        }`}
                      >
                        {l.status === 'ACTIVE' ? 'Settle' : 'Reopen'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-sm">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: Record Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 w-full sm:max-w-md shadow-2xl overflow-hidden text-left max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                Record Borrowing (Udhaar Receipt)
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Loan / Udhaar No *
                  </label>
                  <input
                    type="text"
                    required
                    value={loanNo}
                    onChange={(e) => setLoanNo(e.target.value.toUpperCase())}
                    className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                    placeholder="e.g. LN-102"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Lender Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                    placeholder="Lender / Friend Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Principal Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                    placeholder="₹ Received"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Receiving Bank/Cash Account *
                </label>
                <ResponsiveSelect
                  label="Receiving Account"
                  value={receivingAccountId}
                  options={accountOptions}
                  onChange={(val) => setReceivingAccountId(val)}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Received Date *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Purpose / Notes *
                </label>
                <textarea
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none h-20 resize-none transition-all"
                  placeholder="e.g. Funding for short-term working capital needs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 active:scale-98 transition-all cursor-pointer text-center"
                  style={{ color: '#ffffff' }}
                >
                  <span className="text-white-force">{formLoading ? 'Recording...' : 'Deposit Principal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Repayment / Utilization */}
      {showActionModal && actionLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 w-full sm:max-w-md shadow-2xl overflow-hidden text-left max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                {showActionModal === 'REPAY' ? (
                  <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-violet-600" />
                )}
                {showActionModal === 'REPAY' ? 'Record Repayment' : 'Record Utilization'}
              </h3>
              <button
                onClick={() => {
                  setShowActionModal(null);
                  setActionLoan(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                  {actionError}
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="text-slate-500">Lender: <strong className="text-slate-900">{actionLoan.lender} ({actionLoan.loanNo})</strong></div>
                <div className="text-slate-500">Principal: <strong className="text-slate-900">{fmt(actionLoan.principal)}</strong></div>
                <div className="text-slate-500">Outstanding Balance: <strong className="text-amber-600">{fmt(computeOutstanding(actionLoan))}</strong></div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                  placeholder="₹ Value"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Source Bank/Cash Account *
                </label>
                <ResponsiveSelect
                  label="Source Account"
                  value={actionAccountId}
                  options={accountOptions}
                  onChange={(val) => setActionAccountId(val)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Payment Mode
                  </label>
                  <ResponsiveSelect
                    label="Payment Mode"
                    value={actionPaymentMode}
                    options={paymentModeOptions}
                    onChange={(val) => setActionPaymentMode(val)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Reference / Tx No
                  </label>
                  <input
                    type="text"
                    value={actionReferenceNo}
                    onChange={(e) => setActionReferenceNo(e.target.value)}
                    className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none transition-all"
                    placeholder="e.g. UTR / UPI Ref"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Transaction Purpose *
                </label>
                <textarea
                  required
                  value={actionPurpose}
                  onChange={(e) => setActionPurpose(e.target.value)}
                  className="block w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 text-xs sm:text-sm outline-none h-16 resize-none transition-all"
                  placeholder={showActionModal === 'REPAY' ? 'e.g. 1st installment repayment' : 'e.g. Purchased office laptops'}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowActionModal(null);
                    setActionLoan(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 active:scale-98 transition-all cursor-pointer text-center ${
                    showActionModal === 'REPAY'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-violet-600 hover:bg-violet-700'
                  }`}
                  style={{ color: '#ffffff' }}
                >
                  <span className="text-white-force">
                    {actionLoading ? 'Recording...' : `Record ${showActionModal === 'REPAY' ? 'Repayment' : 'Utilization'}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Loan Ledger History Log */}
      {showHistoryModal && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 w-full max-w-2xl shadow-2xl overflow-hidden text-left flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Ledger History: {selectedLoan.lender}
                </h3>
                <span className="text-[10px] text-slate-500 block font-mono mt-0.5">Loan Reference Number: {selectedLoan.loanNo}</span>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedLoan(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
              {loadingTx ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading transactions ledger...
                </div>
              ) : loanTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-medium italic">
                  No transaction recorded for this loan.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {loanTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.category === 'LOAN_RECEIVED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : tx.category === 'LOAN_REPAYMENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-violet-50 text-violet-700 border border-violet-200'
                          }`}>
                            {tx.category.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">#{tx.transactionNo}</span>
                        </div>
                        <div className="text-xs text-slate-800 font-medium">{tx.purpose}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(tx.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })} via <strong className="text-slate-700">{tx.paymentMode}</strong>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`text-sm font-bold ${tx.type === 'PAYMENT_IN' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {tx.type === 'PAYMENT_IN' ? '+' : '-'}{fmt(tx.amount)}
                        </div>
                        {tx.referenceNo && (
                          <div className="text-[10px] text-slate-400 font-mono">Ref: {tx.referenceNo}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedLoan(null);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                style={{ color: '#ffffff' }}
              >
                <span className="text-white-force">Close Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
