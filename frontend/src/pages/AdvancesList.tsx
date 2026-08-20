import { useState, useEffect, useCallback } from 'react';
import { api, getBackendUrl } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { Download, Printer, Search } from 'lucide-react';
import '../styles/advances.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
}

interface ApprovalStep {
  id: string;
  stepNumber: number;
  roleName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  actionAt: string | null;
  comments: string | null;
}

interface ApprovalRequest {
  id: string;
  status: string;
  currentStep: number;
  approvalSteps: ApprovalStep[];
}

interface SettlementItem {
  id: string;
  amount: number;
  description: string;
  category: { name: string };
}

interface Transaction {
  id: string;
  transactionNo?: string;
  amount: number;
  date: string;
  category: string;
  account?: { name: string };
  vouchers?: { voucherNo: string }[];
}

interface Advance {
  id: string;
  advanceNo: string;
  employeeId: string;
  employee: Employee;
  amount: number;
  purpose: string;
  dateNeeded: string;
  status: string;
  outstandingAmount: number;
  disburseAccount: { name: string } | null;
  disbursedAt: string | null;
  createdAt: string;
  settlements: SettlementItem[];
  transactions?: Transaction[];
  approvalRequest: ApprovalRequest | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  type: string;
}

// ─── Status colour map ────────────────────────────────────────────────────────

const statusMeta: Record<string, { label: string; colour: string }> = {
  DRAFT:                   { label: 'Draft',             colour: '#6b7280' },
  SUBMITTED:               { label: 'Submitted',         colour: '#3b82f6' },
  UNDER_REVIEW:            { label: 'Under Review',      colour: '#f59e0b' },
  RETURNED_FOR_CORRECTION: { label: 'Returned',          colour: '#f97316' },
  APPROVED:                { label: 'Approved',          colour: '#10b981' },
  REJECTED:                { label: 'Rejected',          colour: '#ef4444' },
  DISBURSED:               { label: 'Disbursed',         colour: '#8b5cf6' },
  SETTLEMENT_PENDING:      { label: 'Settlement Pending',colour: '#0ea5e9' },
  SETTLED:                 { label: 'Settled ✓',          colour: '#22c55e' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdvancesList() {
  const [advances, setAdvances]         = useState<Advance[]>([]);
  const [employees, setEmployees]        = useState<Employee[]>([]);
  const [accounts, setAccounts]          = useState<Account[]>([]);
  const [categories, setCategories]      = useState<ExpenseCategory[]>([]);
  const [companyInfo, setCompanyInfo]    = useState<any>(null);
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState('');
  const [selected, setSelected]          = useState<Advance | null>(null);

  // Pagination & Filter States
  const [currentPage, setCurrentPage]    = useState(1);
  const itemsPerPage                     = 10;
  const [searchTerm, setSearchTerm]      = useState('');
  const [fromDate, setFromDate]          = useState('');
  const [toDate, setToDate]              = useState('');

  const filteredAdvances = advances.filter(a => {
    // 1. Text Search Filter (checks employee name, employee code, advanceNo, purpose, status)
    const matchesSearch =
      a.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.employee?.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.advanceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.status?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date range filter (checks dateNeeded)
    const dateNeededObj = new Date(a.dateNeeded);
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      if (dateNeededObj < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (dateNeededObj > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredAdvances.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredAdvances.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAdvances = filteredAdvances.slice(indexOfFirstItem, indexOfLastItem);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'ACCOUNTS' || currentUser.role?.startsWith('ADMIN') || currentUser.role?.startsWith('ACCOUNT');
  const isStaff = !isAdmin;
  const canDisburse = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ACCOUNTS' || currentUser.role?.startsWith('ACCOUNT');

  const isUserActiveApprover = (adv: Advance) => {
    if (!adv.approvalRequest) return false;
    const req = adv.approvalRequest;
    if (req.status !== 'PENDING') return false;
    
    const activeStep = req.approvalSteps.find((s: any) => s.stepNumber === req.currentStep);
    if (!activeStep || activeStep.status !== 'PENDING') return false;

    const isMatched = currentUser.role === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && currentUser.role?.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && currentUser.role?.startsWith('ADMIN')) ||
      currentUser.role === 'SUPER_ADMIN';

    return isMatched;
  };

  // Create/Edit advance modal state
  const [showCreate, setShowCreate]      = useState(false);
  const [editId, setEditId]              = useState('');
  const [newForm, setNewForm]            = useState({ employeeId: '', amount: '', purpose: '', dateNeeded: '' });
  const [creating, setCreating]          = useState(false);

  // Disburse modal state
  const [showDisburse, setShowDisburse]  = useState(false);
  const [disburseAccId, setDisburseAccId] = useState('');

  // Settle modal state
  const [showSettle, setShowSettle]      = useState(false);
  const [settleItems, setSettleItems]    = useState([{ categoryId: '', amount: '', description: '' }]);
  const [returnNow, setReturnNow]        = useState(false);
  const [returnAccIdInSettle, setReturnAccIdInSettle] = useState('');
  const [returnAmtInSettle, setReturnAmtInSettle] = useState('');

  // Return cash modal state
  const [showReturn, setShowReturn]      = useState(false);
  const [returnAccId, setReturnAccId]    = useState('');
  const [returnAmt, setReturnAmt]        = useState('');

  // Action modal state
  const [actionType, setActionType]      = useState<'approve' | 'reject' | 'return' | ''>('');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [advRes, empRes, accRes, catRes, companyRes] = await Promise.all([
        api.get('/advances'),
        api.get('/masters/employees').catch(() => ({ data: { data: [] } })),
        api.get('/accounts').catch(() => ({ data: { data: [] } })),
        api.get('/expenses/categories').catch(() => ({ data: { data: [] } })),
        api.get('/company').catch(() => ({ data: { data: null } })),
      ]);
      setAdvances(advRes.data.data || []);
      setEmployees(empRes.data.data || []);
      setAccounts(accRes.data.data || []);
      setCategories(catRes.data.data || []);
      if (companyRes?.data?.data) {
        setCompanyInfo(companyRes.data.data);
      }
    } catch {
      setError('Failed to load advances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh advances every 30s
  useAutoRefresh(loadAll, 30000);

  // ── Create/Edit Advance ─────────────────────────────────────────────────────
  const handleOpenEdit = (adv: Advance) => {
    setEditId(adv.id);
    setNewForm({
      employeeId: adv.employeeId,
      amount: adv.amount.toString(),
      purpose: adv.purpose,
      dateNeeded: adv.dateNeeded.split('T')[0],
    });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!newForm.employeeId || !newForm.amount || !newForm.purpose || !newForm.dateNeeded) return;
    setCreating(true);
    try {
      const payload = {
        employeeId: newForm.employeeId,
        amount: parseFloat(newForm.amount),
        purpose: newForm.purpose,
        dateNeeded: new Date(newForm.dateNeeded).toISOString(),
        submitDirectly: true,
      };

      if (editId) {
        await api.patch(`/advances/${editId}`, payload);
        await api.post(`/advances/${editId}/submit`);
      } else {
        await api.post('/advances', payload);
      }

      setShowCreate(false);
      setEditId('');
      setNewForm({ employeeId: '', amount: '', purpose: '', dateNeeded: '' });
      await loadAll();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error saving advance.');
    } finally {
      setCreating(false);
    }
  };

  // ── Workflow Action ─────────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!selected || !actionType) return;
    setActionLoading(true);
    try {
      await api.post(`/advances/${selected.id}/${actionType}`, { comments: actionComment });
      setActionType('');
      setActionComment('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || `Error: ${actionType}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Disburse ────────────────────────────────────────────────────────────────
  const handleDisburse = async () => {
    if (!selected || !disburseAccId) return;
    try {
      await api.post(`/advances/${selected.id}/disburse`, { accountId: disburseAccId });
      setShowDisburse(false);
      setDisburseAccId('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Disburse error.');
    }
  };

  // ── Settle ──────────────────────────────────────────────────────────────────
  const handleSettle = async () => {
    if (!selected) return;
    const items = settleItems.map((i) => ({
      categoryId: i.categoryId,
      amount: parseFloat(i.amount),
      description: i.description,
    }));
    try {
      const res = await api.post(`/advances/${selected.id}/settle`, { items });
      let messages: string[] = [];
      messages.push(res.data.message);

      // If user opted to return surplus immediately, call return-cash
      if (returnNow) {
        const amt = parseFloat(returnAmtInSettle || '0');
        if (!returnAccIdInSettle || !amt || amt <= 0) {
          alert('Return account or amount missing. Settlement recorded.');
        } else {
          try {
            const ret = await api.post(`/advances/${selected.id}/return-cash`, {
              accountId: returnAccIdInSettle,
              amount: amt,
            });
            messages.push(ret.data.message);
          } catch (err: any) {
            messages.push(err.response?.data?.message || 'Return cash failed.');
          }
        }
      }

      alert(messages.join('\n'));
      setShowSettle(false);
      setSettleItems([{ categoryId: '', amount: '', description: '' }]);
      setReturnNow(false);
      setReturnAccIdInSettle('');
      setReturnAmtInSettle('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      const resp = e.response?.data;
      if (resp?.errors && Array.isArray(resp.errors) && resp.errors.length) {
        const msgs = resp.errors.map((er: any) => `${er.field ? er.field + ': ' : ''}${er.message}`).join('\n');
        alert((resp.message || 'Validation failed') + '\n' + msgs);
      } else {
        alert(resp?.message || 'Settlement error.');
      }
    }
  };

  // ── Return Cash ─────────────────────────────────────────────────────────────
  const handleReturnCash = async () => {
    if (!selected || !returnAccId || !returnAmt) return;
    try {
      const res = await api.post(`/advances/${selected.id}/return-cash`, {
        accountId: returnAccId,
        amount: parseFloat(returnAmt),
      });
      alert(res.data.message);
      setShowReturn(false);
      setReturnAccId('');
      setReturnAmt('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Return cash error.');
    }
  };

  const handleExportCSV = () => {
    if (filteredAdvances.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Advance No',
      'Employee Code',
      'Employee Name',
      'Amount (INR)',
      'Purpose',
      'Date Needed',
      'Status',
      'Outstanding (INR)'
    ];

    const rows = filteredAdvances.map((a) => {
      return [
        a.advanceNo || '',
        a.employee?.employeeCode || '',
        a.employee?.name || '',
        a.amount.toString(),
        a.purpose || '',
        new Date(a.dateNeeded).toLocaleDateString(),
        a.status || '',
        a.outstandingAmount.toString()
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
    link.setAttribute('download', `staff_advances_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredAdvances.length === 0) {
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

    const tableRows = filteredAdvances
      .map((a) => {
        return `
          <tr>
            <td style="font-family: monospace; font-weight: bold; color: #111;">${a.advanceNo || ''}</td>
            <td>${a.employee?.name || ''}</td>
            <td style="font-family: monospace; font-size: 11px;">${a.employee?.employeeCode || ''}</td>
            <td style="text-align: right; font-weight: 600;">₹${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${a.purpose || ''}</td>
            <td>${new Date(a.dateNeeded).toLocaleDateString()}</td>
            <td style="text-align: center; font-weight: bold; font-size: 10px;">${a.status || ''}</td>
            <td style="text-align: right; color: #ef4444; font-weight: 600;">₹${a.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Staff Advances Statement - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 30px; color: #333; margin: 0; }
            .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; color: #111; }
            .meta { font-size: 11px; color: #555; font-family: monospace; margin-top: 4px; }
            .company-info h2 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .company-info p { margin: 2px 0; font-size: 11px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f4f5f7; font-weight: bold; color: #444; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
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
              <div class="title">Staff Advances Statement</div>
              <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
              <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Advance No</th>
                <th>Employee Name</th>
                <th>Code</th>
                <th style="text-align: right;">Amount</th>
                <th>Purpose</th>
                <th>Date Needed</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Outstanding</th>
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="adv-loading"><div className="adv-spinner" /></div>;
  if (error) return <div className="adv-error">{error}</div>;

  return (
    <div className="adv-root">
      {/* Header */}
      <div className="adv-header">
        <div>
          <h1 className="adv-title">Staff Advances</h1>
          <p className="adv-subtitle">Manage employee advance requests, disbursements and settlements</p>
        </div>
        <button className="adv-btn-primary" onClick={() => { setEditId(''); setNewForm({ employeeId: '', amount: '', purpose: '', dateNeeded: '' }); setShowCreate(true); }}>+ New Advance</button>
      </div>

      {/* Stats bar */}
      <div className="adv-stats">
        {Object.entries(statusMeta).map(([key, meta]) => {
          const count = advances.filter((a) => a.status === key).length;
          if (!count) return null;
          return (
            <div className="adv-stat-pill" key={key} style={{ borderColor: meta.colour }}>
              <span className="adv-stat-label">{meta.label}</span>
              <span className="adv-stat-count" style={{ color: meta.colour }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Date Filters & Exports Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap gap-4 items-center justify-between shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
          {/* Find/Search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, code, purpose, advance no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            title="Export filtered advances to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            title="Print filtered advances to PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="adv-table-wrapper">
        {filteredAdvances.length === 0 ? (
          <div className="adv-empty">
            {advances.length === 0
              ? 'No advance requests yet. Click "+ New Advance" to get started.'
              : 'No advance requests found matching filters.'}
          </div>
        ) : (
          <table className="adv-table">
            <thead>
              <tr>
                <th>Advance No</th>
                <th>Employee</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Date Needed</th>
                <th>Status</th>
                <th>Outstanding</th>
                {!isStaff && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentAdvances.map((adv) => {
                const sm = statusMeta[adv.status] || { label: adv.status, colour: '#6b7280' };
                return (
                  <tr key={adv.id} className="adv-row" onClick={() => setSelected(adv)}>
                    <td className="adv-cell adv-no">{adv.advanceNo}</td>
                    <td className="adv-cell">{adv.employee?.name}</td>
                    <td className="adv-cell adv-amount">{fmt(adv.amount)}</td>
                    <td className="adv-cell adv-purpose">{adv.purpose}</td>
                    <td className="adv-cell">{fmtDate(adv.dateNeeded)}</td>
                    <td className="adv-cell">
                      <span className="adv-badge" style={{ background: `${sm.colour}22`, color: sm.colour, border: `1px solid ${sm.colour}55` }}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="adv-cell adv-outstanding">{adv.outstandingAmount > 0 ? fmt(adv.outstandingAmount) : '—'}</td>
                    {!isStaff && (
                      <td className="adv-cell adv-actions" onClick={(e) => e.stopPropagation()}>
                        {(adv.status === 'RETURNED_FOR_CORRECTION' || adv.status === 'DRAFT' || adv.status === 'REJECTED') && (
                          <button className="adv-act-btn adv-approve" onClick={() => handleOpenEdit(adv)}>Edit</button>
                        )}
                        {adv.status === 'UNDER_REVIEW' && isUserActiveApprover(adv) && (
                          <>
                            <button className="adv-act-btn adv-approve" onClick={() => { setSelected(adv); setActionType('approve'); }}>Approve</button>
                            <button className="adv-act-btn adv-reject" onClick={() => { setSelected(adv); setActionType('reject'); }}>Reject</button>
                            <button className="adv-act-btn adv-return" onClick={() => { setSelected(adv); setActionType('return'); }}>Return</button>
                          </>
                        )}
                        {adv.status === 'APPROVED' && canDisburse && (
                          <button className="adv-act-btn adv-disburse" onClick={() => { setSelected(adv); setShowDisburse(true); }}>Disburse</button>
                        )}
                        {adv.status === 'SETTLEMENT_PENDING' && canDisburse && (
                          <>
                            <button className="adv-act-btn adv-settle" onClick={() => { setSelected(adv); setShowSettle(true); }}>Settle</button>
                            {adv.outstandingAmount > 0 && (
                              <button className="adv-act-btn adv-returncash" onClick={() => { setSelected(adv); setShowReturn(true); }}>Return Cash</button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination Controls */}
        {filteredAdvances.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(indexOfLastItem, filteredAdvances.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredAdvances.length}</span> advances
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
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
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 border-none'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-white'
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
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      {selected && !showDisburse && !showSettle && !showReturn && !actionType && (
        <div className="adv-overlay" onClick={() => setSelected(null)}>
          <div className="adv-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adv-drawer-header">
              <h2>{selected.advanceNo}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(selected.status === 'RETURNED_FOR_CORRECTION' || selected.status === 'DRAFT' || selected.status === 'REJECTED') && (
                  <button className="adv-act-btn adv-approve" onClick={() => handleOpenEdit(selected)}>Edit</button>
                )}
                <button className="adv-close" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>
            <div className="adv-drawer-body">
              <div className="adv-info-grid">
                <div><label>Employee</label><span>{selected.employee?.name} ({selected.employee?.employeeCode})</span></div>
                <div><label>Amount</label><span>{fmt(selected.amount)}</span></div>
                <div><label>Outstanding</label><span style={{ color: selected.outstandingAmount > 0 ? '#f59e0b' : '#22c55e' }}>{selected.outstandingAmount > 0 ? fmt(selected.outstandingAmount) : '₹0 (Cleared)'}</span></div>
                <div><label>Date Needed</label><span>{fmtDate(selected.dateNeeded)}</span></div>
                <div className="adv-info-full"><label>Purpose</label><span>{selected.purpose}</span></div>
                {selected.disburseAccount && (
                  <div><label>Disbursed From</label><span>{selected.disburseAccount.name}</span></div>
                )}
              </div>

              {/* Approval steps timeline */}
              {selected.approvalRequest && (
                <div className="adv-steps">
                  <h3>Approval Timeline</h3>
                  {selected.approvalRequest.approvalSteps.map((step) => (
                    <div key={step.id} className={`adv-step adv-step-${step.status.toLowerCase()}`}>
                      <div className="adv-step-dot" />
                      <div className="adv-step-content">
                        <span className="adv-step-role">{step.roleName}</span>
                        <span className="adv-step-status">{step.status}</span>
                        {step.comments && <p className="adv-step-comment">"{step.comments}"</p>}
                        {step.actionAt && <small>{fmtDate(step.actionAt)}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Settlement items and Returned Cash */}
              {( (selected.settlements && selected.settlements.length > 0) || (selected.transactions && selected.transactions.some((t: any) => t.category === 'ADVANCE_RETURN')) ) && (
                <div className="adv-settlements">
                  <h3>Settlement Items</h3>
                  
                  {selected.settlements && selected.settlements.map((s) => (
                    <div key={s.id} className="adv-settle-row">
                      <span className="adv-settle-cat">{s.category.name}</span>
                      <span className="adv-settle-desc">{s.description}</span>
                      <span className="adv-settle-amt">{fmt(s.amount)}</span>
                    </div>
                  ))}
                  
                  {selected.transactions && selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').map((t: any) => (
                    <div key={t.id} className="adv-settle-row" style={{ color: '#22c55e' }}>
                      <span className="adv-settle-cat">Cash Returned</span>
                      <span className="adv-settle-desc">Ref: {t.vouchers && t.vouchers[0] ? t.vouchers[0].voucherNo : (t.account?.name || '—')}</span>
                      <span className="adv-settle-amt">{fmt(t.amount)}</span>
                    </div>
                  ))}

                  <div className="adv-settle-total" style={{ borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Total Used:</span>
                      <span>{fmt((selected.settlements || []).reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                    {selected.transactions && selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#22c55e' }}>
                        <span>Total Returned:</span>
                        <span>{fmt(selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #334155', paddingTop: 8, marginTop: 4 }}>
                      <span>Total Accounted:</span>
                      <span>{fmt(
                        (selected.settlements || []).reduce((s, i) => s + i.amount, 0) + 
                        (selected.transactions ? selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').reduce((s, i) => s + i.amount, 0) : 0)
                      )}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Return Surplus form inside detail drawer */}
              {selected.outstandingAmount > 0 && selected.status === 'SETTLEMENT_PENDING' && (
                <div className="adv-inline-return" style={{ marginTop: 18 }}>
                  <h3>Return Surplus Cash</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label>Receive Into Account</label>
                      <select value={returnAccId} onChange={(e) => setReturnAccId(e.target.value)}>
                        <option value="">— Select Account —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Return Amount (₹)</label>
                      <input type="number" min="1" max={selected.outstandingAmount} value={returnAmt} onChange={(e) => setReturnAmt(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="adv-btn-primary" onClick={handleReturnCash} disabled={!returnAccId || !returnAmt}>
                      Confirm Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Advance Modal ──────────────────────────────────────── */}
      {showCreate && (
        <div className="adv-overlay" onClick={() => setShowCreate(false)}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>{editId ? 'Edit Advance Request' : 'New Advance Request'}</h2>
              <button className="adv-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <label>Employee</label>
              <select value={newForm.employeeId} onChange={(e) => setNewForm({ ...newForm, employeeId: e.target.value })}>
                <option value="">— Select Employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                ))}
              </select>

              <label>Amount (₹)</label>
              <input type="number" min="1" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })} placeholder="e.g. 10000" />

              <label>Purpose</label>
              <input type="text" value={newForm.purpose} onChange={(e) => setNewForm({ ...newForm, purpose: e.target.value })} placeholder="e.g. Site visit expenses" />

              <label>Date Needed By</label>
              <input type="date" value={newForm.dateNeeded} onChange={(e) => setNewForm({ ...newForm, dateNeeded: e.target.value })} />

              <button className="adv-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workflow Action Modal ──────────────────────────────────────────── */}
      {actionType && selected && (
        <div className="adv-overlay" onClick={() => { setActionType(''); setActionComment(''); }}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>{actionType === 'approve' ? '✅ Approve' : actionType === 'reject' ? '❌ Reject' : '↩ Return'} — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => { setActionType(''); setActionComment(''); }}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Amount: <strong>{fmt(selected.amount)}</strong> · Employee: <strong>{selected.employee?.name}</strong></p>
              <label>Comments (optional)</label>
              <textarea rows={3} value={actionComment} onChange={(e) => setActionComment(e.target.value)} placeholder="Add remarks…" />
              <button
                className={`adv-btn-action ${actionType === 'approve' ? 'adv-btn-green' : actionType === 'reject' ? 'adv-btn-red' : 'adv-btn-orange'}`}
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing…' : actionType.charAt(0).toUpperCase() + actionType.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disburse Modal ─────────────────────────────────────────────────── */}
      {showDisburse && selected && (
        <div className="adv-overlay" onClick={() => { setShowDisburse(false); setDisburseAccId(''); }}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>💸 Disburse — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => { setShowDisburse(false); setDisburseAccId(''); }}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Disbursing <strong>{fmt(selected.amount)}</strong> to <strong>{selected.employee?.name}</strong></p>
              <label>Source Account</label>
              <select value={disburseAccId} onChange={(e) => setDisburseAccId(e.target.value)}>
                <option value="">— Select Account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>
                ))}
              </select>
              <button className="adv-btn-primary" onClick={handleDisburse} disabled={!disburseAccId}>
                Confirm Disbursement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Modal ───────────────────────────────────────────────────── */}
      {showSettle && selected && (
        <div className="adv-overlay" onClick={() => { setShowSettle(false); }}>
          <div className="adv-modal adv-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>📋 Settle Advance — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => setShowSettle(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Advance: <strong>{fmt(selected.amount)}</strong> · Outstanding: <strong>{fmt(selected.outstandingAmount)}</strong></p>
              <label>Expense Items (how the advance was used)</label>
              {settleItems.map((item, idx) => (
                <div className="adv-settle-item" key={idx}>
                  <select value={item.categoryId} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].categoryId = e.target.value;
                    setSettleItems(updated);
                  }}>
                    <option value="">— Category —</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].description = e.target.value;
                    setSettleItems(updated);
                  }} />
                  <input type="number" placeholder="₹ Amount" value={item.amount} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].amount = e.target.value;
                    setSettleItems(updated);
                  }} />
                  {settleItems.length > 1 && (
                    <button className="adv-act-btn adv-reject" onClick={() => setSettleItems(settleItems.filter((_, i) => i !== idx))}>✕</button>
                  )}
                </div>
              ))}
              <button className="adv-btn-secondary" onClick={() => setSettleItems([...settleItems, { categoryId: '', amount: '', description: '' }])}>
                + Add Item
              </button>
              <div className="adv-settle-preview">
                Total used: <strong>{fmt(settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</strong>
                &nbsp;|&nbsp; Surplus: <strong style={{ color: '#f59e0b' }}>
                  {fmt(selected.outstandingAmount - settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                </strong>
              </div>
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={returnNow} onChange={(e) => {
                    setReturnNow(e.target.checked);
                    if (e.target.checked) {
                      const used = settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                      const surplus = Math.max(0, selected.outstandingAmount - used);
                      setReturnAmtInSettle(String(surplus || ''));
                    } else {
                      setReturnAccIdInSettle('');
                      setReturnAmtInSettle('');
                    }
                  }} />
                  <span style={{ fontSize: 14 }}>Return surplus now</span>
                </label>

                {returnNow && (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
                    <div>
                      <label>Receive Into Account</label>
                      <select value={returnAccIdInSettle} onChange={(e) => setReturnAccIdInSettle(e.target.value)}>
                        <option value="">— Select Account —</option>
                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Return Amount (₹)</label>
                      <input type="number" min="0" max={selected.outstandingAmount} value={returnAmtInSettle} onChange={(e) => setReturnAmtInSettle(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
                    </div>
                  </div>
                )}
              </div>

              <button className="adv-btn-primary" onClick={handleSettle}>Submit Settlement</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Cash Modal ──────────────────────────────────────────────── */}
      {showReturn && selected && (
        <div className="adv-overlay" onClick={() => setShowReturn(false)}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>🔄 Return Surplus Cash — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => setShowReturn(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Outstanding: <strong style={{ color: '#f59e0b' }}>{fmt(selected.outstandingAmount)}</strong></p>
              <label>Receive Into Account</label>
              <select value={returnAccId} onChange={(e) => setReturnAccId(e.target.value)}>
                <option value="">— Select Account —</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              <label>Return Amount (₹)</label>
              <input type="number" min="1" max={selected.outstandingAmount} value={returnAmt} onChange={(e) => setReturnAmt(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
              <button className="adv-btn-primary" onClick={handleReturnCash} disabled={!returnAccId || !returnAmt}>
                Confirm Cash Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
