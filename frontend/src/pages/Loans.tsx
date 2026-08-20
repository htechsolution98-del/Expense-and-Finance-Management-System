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

      {/* Date Filters & Exports Toolbar */}
      <div className="p-4 rounded-2xl glass-panel bg-[#0e1420]/30 border border-white/5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
          {/* Find/Search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by loan no, lender, purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 rounded-xl bg-[#0e1420]/80 border border-white/5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-xs outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-xs outline-none"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-rose-600/10"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
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
              ) : filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
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

        {/* Pagination Controls */}
        {filteredLoans.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0c101a]/40">
            <div className="text-xs text-gray-400 font-medium">
              Showing <span className="font-bold text-white">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-bold text-white">
                {Math.min(indexOfLastItem, filteredLoans.length)}
              </span>{' '}
              of <span className="font-bold text-white">{filteredLoans.length}</span> loans
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-white/5 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-[#0e1420]/80"
                >
                  Previous
                </button>

                {/* Render page numbers */}
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
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15 border-none'
                            : 'border border-white/5 text-gray-400 hover:bg-white/5 hover:text-white bg-[#0e1420]/80'
                        }`}
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
                      <span key={pageNumber} className="px-1 text-gray-500 text-xs font-semibold">
                        ...
                      </span>
                    );
                  }

                  return null;
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-white/5 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-[#0e1420]/80"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
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
