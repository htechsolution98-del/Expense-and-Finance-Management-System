import React, { useState, useEffect } from 'react';
import { api, getBackendUrl } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { 
  Plus, Receipt, RefreshCw, Wallet, AlertCircle, X, Shield, Clock, Trash2, Edit, Download, Search, Printer
} from 'lucide-react';
import { ResponsiveSelect, type ResponsiveSelectOption } from '../components/ResponsiveSelect';

interface Expense {
  id: string;
  expenseNo: string;
  employeeId: string;
  categoryId: string;
  amount: number;
  date: string;
  purpose: string;
  paymentMode: string;
  status: string;
  createdBy: string;
  receiptUrl?: string;
  paymentReference?: string;
  paymentProofUrl?: string;
  employee: { id: string; name: string };
  category: { id: string; name: string };
  approvalRequest: {
    id: string;
    status: string;
    currentStep: number;
    approvalSteps: {
      id: string;
      stepNumber: number;
      roleName: string;
      status: string;
      comments: string | null;
      actionAt: string | null;
      actor: { id: string; email: string } | null;
    }[];
  } | null;
}

interface Category { id: string; name: string }
interface Employee { id: string; name: string }
interface Account { id: string; name: string; currentBalance: number }

export const ExpensesList: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination & Filter states & logic
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const filteredExpenses = expenses.filter(exp => {
    // 1. Text Search Filter
    const matchesSearch = 
      exp.expenseNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.purpose?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date range filter
    const expenseDate = new Date(exp.date);
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      if (expenseDate < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (expenseDate > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredExpenses.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);

  // Modals and selections
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editExpenseId, setEditExpenseId] = useState('');

  // Fetch current user details for role checks
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { role: 'STAFF', permissions: [], employeeId: null };
  const canPay = user.role === 'ACCOUNTS' || user.role.startsWith('ACCOUNT') || user.role === 'SUPER_ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const hasPermission = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.some((p) => user.permissions?.includes(p));
  };
  const canCreateCategory = isSuperAdmin || user.role === 'ACCOUNTS' || user.role.startsWith('ACCOUNT');
  const canEditOrDeleteCategory = isSuperAdmin;

  // Form states (Add Expense)
  const [employeeId, setEmployeeId] = useState(user.employeeId || '');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [submitDirectly, setSubmitDirectly] = useState(true);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states (Workflow Action)
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form states (Payout settlement)
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');



  const fetchExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/expenses');
      setExpenses(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      api.get('/company').then(res => setCompanyInfo(res.data.data)).catch(console.error);
      const [catRes, empRes] = await Promise.all([
        api.get('/expenses/categories').catch(() => ({ data: { data: [] } })),
        api.get('/masters/employees').catch(() => ({ data: { data: [] } })),
      ]);
      setCategories(catRes.data.data || []);
      
      // Only show the logged-in user's employee record
      const allEmps = empRes.data.data || [];
      const userEmp = allEmps.find((emp: any) => emp.id === user.employeeId);
      const filteredEmps = userEmp ? [userEmp] : [];
      setEmployees(filteredEmps);

      if (filteredEmps.length === 1 && !employeeId) {
        setEmployeeId(filteredEmps[0].id);
      }
      
      if (canPay) {
        const accRes = await api.get('/accounts').catch(() => ({ data: { data: [] } }));
        setAccounts(accRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load categories or employees list', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Auto-refresh expenses every 30s
  useAutoRefresh(fetchExpenses, 30000);


  const handleCreateCategory = async () => {
    const name = window.prompt('Enter new Expense Category name:');
    if (!name || !name.trim()) return;
    try {
      const res = await api.post('/expenses/categories', { name: name.trim() });
      setCategories(prev => [...prev, res.data.data]);
      setCategoryId(res.data.data.id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create category.');
    }
  };

  const handleEditCategory = async () => {
    if (!categoryId) {
      alert('Please select a category to edit first.');
      return;
    }
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    const newName = window.prompt('Edit Expense Category name:', cat.name);
    if (!newName || !newName.trim() || newName.trim() === cat.name) return;
    
    try {
      const res = await api.put(`/expenses/categories/${categoryId}`, { name: newName.trim() });
      setCategories(prev => prev.map(c => c.id === categoryId ? res.data.data : c));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to edit category.');
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryId) {
      alert('Please select a category to delete first.');
      return;
    }
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    
    if (!window.confirm(`Are you sure you want to delete the category "${cat.name}"?`)) return;
    
    try {
      await api.delete(`/expenses/categories/${categoryId}`);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      setCategoryId('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete category (it might be in use).');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const formData = new FormData();
      formData.append('employeeId', employeeId);
      formData.append('categoryId', categoryId);
      formData.append('amount', amount);
      formData.append('date', date);
      formData.append('purpose', purpose);
      formData.append('paymentMode', paymentMode);
      formData.append('submitDirectly', submitDirectly ? 'true' : 'false');
      
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }
      if (paymentProofFile) {
        formData.append('paymentProof', paymentProofFile);
      }

      if (isEditMode && editExpenseId) {
        await api.patch(`/expenses/${editExpenseId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (submitDirectly) {
           await api.post(`/expenses/${editExpenseId}/submit`);
        }
      } else {
        await api.post('/expenses', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowAddModal(false);
      setIsEditMode(false);
      setEditExpenseId('');
      // Reset
      setEmployeeId(user.employeeId || '');
      setCategoryId('');
      setAmount('');
      setPurpose('');
      setPaymentMode('CASH');
      setReceiptFile(null);
      setPaymentProofFile(null);
      
      fetchExpenses();
      if (isEditMode) setSelectedExpense(null);
    } catch (err: any) {
      setFormError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'submit'} expense.`);
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (expense: Expense) => {
    setIsEditMode(true);
    setEditExpenseId(expense.id);
    setEmployeeId(expense.employeeId || '');
    setCategoryId(expense.categoryId || '');
    setAmount(expense.amount.toString());
    setDate(new Date(expense.date).toISOString().split('T')[0]);
    setPurpose(expense.purpose);
    setPaymentMode(expense.paymentMode);
    setSubmitDirectly(true);
    setReceiptFile(null);
    setPaymentProofFile(null);
    setShowAddModal(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) return;
    try {
      await api.delete(`/expenses/${id}`);
      setSelectedExpense(null);
      fetchExpenses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Expense No', 'Employee', 'Category', 'Date', 'Purpose', 'Amount (INR)', 'Status'];
    const rows = filteredExpenses.map((exp) => [
      exp.expenseNo || '',
      exp.employee?.name || '',
      exp.category?.name || '',
      new Date(exp.date).toLocaleDateString(),
      exp.purpose || '',
      exp.amount.toString(),
      exp.status || '',
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
    link.setAttribute('download', `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredExpenses.length === 0) {
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

    const tableRows = filteredExpenses
      .map((exp) => `
        <tr>
          <td style="font-family: monospace; font-weight: bold; color: #111;">${exp.expenseNo || ''}</td>
          <td>${exp.employee?.name || ''}</td>
          <td>
            <div style="font-weight: 600; color: #111;">${exp.category?.name || ''}</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">Date: ${new Date(exp.date).toLocaleDateString()}</div>
          </td>
          <td>${exp.purpose || ''}</td>
          <td style="text-align: right; font-weight: bold; color: #111;">
            ₹${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </td>
          <td style="text-align: center; font-weight: bold; font-size: 10px;">
            ${exp.status || ''}
          </td>
        </tr>
      `)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Expenses Report - ${new Date().toLocaleDateString()}</title>
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
              <div class="title">Expenses Report</div>
              <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
              <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Expense No</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Purpose</th>
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

  const handleWorkflowAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!selectedExpense) return;
    setActionError('');
    setActionLoading(true);

    try {
      const response = await api.post(`/expenses/${selectedExpense.id}/${action}`, {
        comments,
      });

      // Update selected item detail and reload list
      setSelectedExpense((prev) => prev ? { ...prev, status: response.data.data.status } : null);
      setComments('');
      fetchExpenses();
    } catch (err: any) {
      setActionError(err.response?.data?.message || `Failed to ${action} step.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    setPayoutError('');
    setPayoutLoading(true);

    try {
      const formData = new FormData();
      formData.append('accountId', payoutAccountId);
      if (paymentReference) {
        formData.append('paymentReference', paymentReference);
      }
      if (paymentProofFile) {
        formData.append('paymentProof', paymentProofFile);
      }

      await api.post(`/expenses/${selectedExpense.id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSelectedExpense(null);
      setPaymentReference('');
      setPaymentProofFile(null);
      fetchExpenses();
      if (canPay) {
        // reload balances
        const accRes = await api.get('/accounts');
        setAccounts(accRes.data.data);
      }
    } catch (err: any) {
      setPayoutError(err.response?.data?.message || 'Payout settlement execution failed.');
    } finally {
      setPayoutLoading(false);
    }
  };

  // Status Badge Builder
  const renderStatusBadge = (status: string) => {
    let classes = '';
    switch (status) {
      case 'DRAFT':
        classes = 'bg-slate-100 border-slate-200 text-slate-700';
        break;
      case 'SUBMITTED':
        classes = 'bg-blue-50 border-blue-100 text-blue-700';
        break;
      case 'UNDER_REVIEW':
        classes = 'bg-amber-50 border-amber-100 text-amber-700 animate-pulse';
        break;
      case 'RETURNED_FOR_CORRECTION':
        classes = 'bg-orange-50 border-orange-100 text-orange-700';
        break;
      case 'APPROVED':
        classes = 'bg-emerald-50 border-emerald-100 text-emerald-700';
        break;
      case 'REJECTED':
        classes = 'bg-red-50 border-red-100 text-red-700';
        break;
      case 'REIMBURSED':
        classes = 'bg-emerald-50 border-emerald-100 text-emerald-700';
        break;
      default:
        classes = 'bg-slate-100 border-slate-200 text-slate-700';
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${classes}`}>
        {status.replace(/_/g, ' ').toLowerCase()}
      </span>
    );
  };

  // Detect if current user can approve the active step
  const isUserActiveApprover = () => {
    if (!selectedExpense || !selectedExpense.approvalRequest) return false;
    const req = selectedExpense.approvalRequest;
    if (req.status !== 'PENDING') return false;
    
    const activeStep = req.approvalSteps.find((s) => s.stepNumber === req.currentStep);
    if (!activeStep || activeStep.status !== 'PENDING') return false;

    const isMatched = user.role === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && user.role?.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && user.role?.startsWith('ADMIN')) ||
      user.role === 'SUPER_ADMIN';

    return isMatched;
  };

  const activeStepRole = selectedExpense?.approvalRequest?.approvalSteps?.find(
    (s) => s.stepNumber === selectedExpense.approvalRequest?.currentStep
  )?.roleName || '';

  // Select options for ResponsiveSelect
  const employeeOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Employee --' },
    ...employees.map((emp) => ({ value: emp.id, label: emp.name })),
  ];

  const categoryOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Category --' },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

  const paymentModeOptions: ResponsiveSelectOption[] = [
    { value: 'CASH', label: 'Physical Cash Box' },
    { value: 'UPI', label: 'UPI Digital Wallet' },
  ];

  const payoutAccountOptions: ResponsiveSelectOption[] = [
    { value: '', label: '-- Choose Payout Source --' },
    ...accounts.map((acc) => ({
      value: acc.id,
      label: `${acc.name} (Bal: ₹${acc.currentBalance.toLocaleString('en-IN')})`,
    })),
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Office & Staff Expenses
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 sm:mt-1.5 text-xs sm:text-sm">
            File company expense reports, monitor review sequences, and settle payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={fetchExpenses}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] font-semibold text-white text-xs sm:text-sm shadow-lg shadow-[var(--primary)]/15 active:scale-98 transition-all cursor-pointer text-white-force"
            style={{ color: '#ffffff' }}
          >
            <Plus className="w-4 h-4 shrink-0 text-white" />
            <span>File Expense</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-xs sm:text-sm text-red-500">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Date Filters, Search & Export */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm w-full space-y-3">
        {/* Search input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by expense no, employee, purpose, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 text-slate-900 placeholder-slate-400 outline-none transition-all text-xs"
          />
        </div>

        {/* Date inputs & Actions row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 sm:bg-transparent p-1.5 sm:p-0 rounded-xl border border-slate-200 sm:border-0">
              <span className="text-[11px] font-bold text-[var(--text-secondary)] whitespace-nowrap pl-1 sm:pl-0">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-auto px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:border-[var(--primary)] outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 sm:bg-transparent p-1.5 sm:p-0 rounded-xl border border-slate-200 sm:border-0">
              <span className="text-[11px] font-bold text-[var(--text-secondary)] whitespace-nowrap pl-1 sm:pl-0">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full sm:w-auto px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:border-[var(--primary)] outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="px-2.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer shrink-0"
              >
                Clear
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              title="Export filtered expenses to CSV"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              title="Print filtered expenses to PDF"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main layout: Grid of list + review side detail sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Expenses List Card Container */}
        <div className={`rounded-2xl glass-panel bg-white border border-[var(--border)] overflow-hidden shadow-sm ${
          selectedExpense ? 'lg:col-span-2' : 'lg:col-span-3'
        }`}>
          {/* Mobile Card List (< 640px) */}
          <div className="sm:hidden p-3 space-y-2.5">
            {loading && expenses.length === 0 ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 animate-pulse space-y-2.5">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-5 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              ))
            ) : filteredExpenses.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-semibold italic text-xs">
                {expenses.length === 0 
                  ? "No expense claims registered in this company." 
                  : "No expenses found for the selected date range."}
              </div>
            ) : (
              currentExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExpense(exp)}
                  className={`p-3.5 rounded-xl bg-white border transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
                    selectedExpense?.id === exp.id 
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top row: Expense No + Date & Status */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold font-mono text-slate-900 text-xs">
                        {exp.expenseNo}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(exp.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div>{renderStatusBadge(exp.status)}</div>
                  </div>

                  {/* Middle: Amount & Category */}
                  <div className="py-2 flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {exp.category?.name || 'Uncategorized'}
                      </span>
                      <span className="text-base font-black font-mono text-slate-900">
                        ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                      {exp.paymentMode}
                    </span>
                  </div>

                  {/* Bottom row: Employee & Purpose */}
                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 flex flex-col gap-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Employee:</span>
                      <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[190px]">
                        {exp.employee?.name}
                      </span>
                    </div>
                    {exp.purpose && (
                      <p className="text-slate-500 text-[11px] italic truncate">
                        "{exp.purpose}"
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto w-full">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider bg-slate-50">
                  <th className="px-6 py-4">Expense No</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Category / Date</th>
                  <th className="px-6 py-4">Purpose</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-xs text-[var(--text-primary)]">
                {loading && expenses.length === 0 ? (
                  [1, 2, 3].map((n) => (
                    <tr key={n} className="animate-pulse">
                      <td colSpan={6} className="h-16 bg-white/2"></td>
                    </tr>
                  ))
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-semibold italic">
                      {expenses.length === 0 
                        ? "No expense claims registered in this company." 
                        : "No expenses found for the selected date range."}
                    </td>
                  </tr>
                ) : (
                  currentExpenses.map((exp) => (
                    <tr
                      key={exp.id}
                      onClick={() => setSelectedExpense(exp)}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                        selectedExpense?.id === exp.id ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-[var(--text-primary)] font-mono">
                        {exp.expenseNo}
                      </td>

                      <td className="px-6 py-4 text-[var(--text-secondary)] font-medium">
                        {exp.employee?.name}
                      </td>

                      <td className="px-6 py-4 space-y-1">
                        <span className="text-[var(--text-primary)] font-semibold block">
                          {exp.category?.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(exp.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-[var(--text-secondary)] max-w-xs truncate">
                        {exp.purpose}
                      </td>

                      <td className="px-6 py-4 text-right font-black font-mono text-[var(--text-primary)] text-sm">
                        ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {renderStatusBadge(exp.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredExpenses.length > 0 && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="text-xs text-[var(--text-secondary)] font-medium text-center sm:text-left">
                Showing <span className="font-bold text-[var(--text-primary)]">{indexOfFirstItem + 1}</span> to{' '}
                <span className="font-bold text-[var(--text-primary)]">
                  {Math.min(indexOfLastItem, filteredExpenses.length)}
                </span>{' '}
                of <span className="font-bold text-[var(--text-primary)]">{filteredExpenses.length}</span> expenses
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
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
                              ? 'bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/15 border-none'
                              : 'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] bg-white'
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
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Workflow review sheet (Modal on Mobile, Sidebar on Desktop) */}
        {selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs lg:static lg:inset-auto lg:z-auto lg:p-0 lg:bg-transparent lg:block animate-fade-in">
            <div className="w-full max-w-lg lg:max-w-none max-h-[88vh] lg:max-h-none overflow-y-auto rounded-2xl glass-panel p-5 sm:p-6 bg-white border border-[var(--card-border)] shadow-2xl lg:shadow-xl space-y-5 sm:space-y-6 relative animate-slide-in-right">
              <div className="absolute top-4 right-4 flex gap-2">
                {(user.role === 'SUPER_ADMIN' || user.id === selectedExpense.createdBy) && 
                  (selectedExpense.status === 'RETURNED_FOR_CORRECTION' || selectedExpense.status === 'DRAFT' || selectedExpense.status === 'REJECTED') && (
                  <button
                    onClick={() => openEditModal(selectedExpense)}
                    className="p-1 text-slate-400 hover:text-[var(--primary)] transition-colors cursor-pointer"
                    title="Edit & Resubmit"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                )}
                {user.role === 'SUPER_ADMIN' && selectedExpense.status !== 'REIMBURSED' && (
                  <button
                    onClick={() => handleDeleteExpense(selectedExpense.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete Expense"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedExpense(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            {/* Header info */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--primary)] block mb-1">
                Claim Verification Details
              </span>
              <h2 className="text-xl font-extrabold text-[var(--text-primary)] font-mono">
                {selectedExpense.expenseNo}
              </h2>
            </div>

            {/* Core facts */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedExpense.employee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Purpose:</span>
                <span className="text-[var(--text-secondary)] font-medium">{selectedExpense.purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="text-[var(--text-secondary)] font-bold uppercase">{selectedExpense.paymentMode.replace('_', ' ')}</span>
              </div>
              
              {selectedExpense.receiptUrl && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Bill:</span>
                   <a href={`${getBackendUrl()}${selectedExpense.receiptUrl}`} target="_blank" rel="noreferrer" className="text-[var(--primary)] font-bold hover:underline">View Receipt</a>
                </div>
              )}
              {selectedExpense.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-slate-500">UTR / Ref:</span>
                  <span className="text-[var(--text-secondary)] font-medium">{selectedExpense.paymentReference}</span>
                </div>
              )}
              {selectedExpense.paymentProofUrl && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Proof:</span>
                   <a href={`${getBackendUrl()}${selectedExpense.paymentProofUrl}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline">View Proof</a>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Requested Amount:</span>
                <span className="text-base font-black text-[var(--text-primary)] font-mono">
                  ₹{selectedExpense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Workflow approval tracks */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[var(--primary)]" />
                <span>Approval Sequence Steps</span>
              </h3>

              {!selectedExpense.approvalRequest ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500 italic">
                  No active approval track. Re-submit this draft to trigger.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedExpense.approvalRequest.approvalSteps.map((step) => {
                    const isActive = selectedExpense.approvalRequest?.status === 'PENDING' && selectedExpense.approvalRequest?.currentStep === step.stepNumber;
                    
                    let statusColor = 'text-slate-500 border-slate-200 bg-slate-50';
                    if (step.status === 'APPROVED') statusColor = 'text-emerald-600 border-emerald-500/20 bg-emerald-50';
                    if (step.status === 'REJECTED') statusColor = 'text-red-600 border-red-500/20 bg-red-50';
                    if (step.status === 'RETURNED') statusColor = 'text-orange-600 border-orange-500/20 bg-orange-50';
                    if (isActive) statusColor = 'text-amber-700 border-amber-500/30 bg-amber-50';

                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${statusColor}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold flex items-center gap-2">
                            <span className="text-[10px] w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-650">
                              {step.stepNumber + 1}
                            </span>
                            <span>{step.roleName} Role</span>
                          </span>

                          <span className="text-[10px] font-extrabold uppercase">
                            {isActive ? 'Pending Review' : step.status.toLowerCase()}
                          </span>
                        </div>

                        {step.comments && (
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic pl-7 border-l border-slate-200">
                            "{step.comments}"
                          </p>
                        )}

                        {step.actionAt && (
                          <span className="text-[9px] text-[var(--text-muted)] font-mono text-right">
                            Reviewed on: {new Date(step.actionAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* REVIEWER ACTION CARD */}
            {isUserActiveApprover() && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-4 animate-zoom-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-750">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>ACTION REQUIRED: Pending your Review ({activeStepRole})</span>
                </div>

                {actionError && (
                  <div className="p-2.5 rounded bg-red-100 border border-red-250 text-[10px] text-red-700">
                    {actionError}
                  </div>
                )}

                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-amber-500 text-xs text-slate-900 outline-none h-16 resize-none"
                  placeholder="Review comments / approval remarks..."
                />

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleWorkflowAction('approve')}
                    disabled={actionLoading}
                    className="py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase shadow disabled:opacity-50 cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleWorkflowAction('return')}
                    disabled={actionLoading}
                    className="py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold text-[10px] uppercase shadow disabled:opacity-50 cursor-pointer"
                  >
                    Return
                  </button>
                  <button
                    onClick={() => handleWorkflowAction('reject')}
                    disabled={actionLoading}
                    className="py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase shadow disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* CASHIER PAYOUT ACTION CARD */}
            {selectedExpense.status === 'APPROVED' && canPay && (
              <form onSubmit={handlePayoutSubmit} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-4 animate-zoom-in">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>Settle Approved Expense Reimbursement</span>
                </div>

                {payoutError && (
                  <div className="p-2.5 rounded bg-red-100 border border-red-200 text-[10px] text-red-700">
                    {payoutError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                    Payout Source Account
                  </label>
                  <ResponsiveSelect
                    label="Payout Source Account"
                    value={payoutAccountId}
                    options={payoutAccountOptions}
                    onChange={(val) => setPayoutAccountId(val)}
                  />
                </div>

                {/* Payment Reference / UTR */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                    UTR / Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-white border border-slate-200 focus:border-[var(--primary)] text-xs text-slate-900 outline-none"
                    placeholder="e.g. UTR-123456789"
                  />
                </div>

                {/* Payment Proof Upload */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1.5">
                    Upload Proof (Cheque / Screenshot)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setPaymentProofFile(e.target.files ? e.target.files[0] : null)}
                    className="block w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs focus:outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[var(--primary-light)] file:text-[var(--primary)] hover:file:bg-[var(--primary-light)]/85 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={payoutLoading}
                  className="w-full py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs uppercase shadow-md shadow-[var(--primary)]/10 disabled:opacity-50 active:scale-98 transition-all cursor-pointer text-white-force"
                  style={{ color: '#ffffff' }}
                >
                  {payoutLoading ? 'Executing Payout...' : 'Disburse Payout Settlement'}
                </button>
              </form>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal - Full Screen on Mobile */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-stretch sm:items-center justify-center sm:p-4">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl bg-white border-0 sm:border border-slate-200 overflow-hidden shadow-2xl flex flex-col animate-zoom-in">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--primary)] shrink-0" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {isEditMode ? 'Edit & Resubmit Claim' : 'File Office / Staff Expense'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setIsEditMode(false);
                  setEditExpenseId('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateExpense} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {/* Employee Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Submitting Employee
                    </label>
                    <ResponsiveSelect
                      label="Submitting Employee"
                      value={employeeId}
                      options={employeeOptions}
                      onChange={(val) => setEmployeeId(val)}
                      disabled={!!user.employeeId && !isSuperAdmin}
                    />
                  </div>

                  {/* Expense Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-650">
                        Category
                      </label>
                      {canCreateCategory && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md text-[10px] text-[var(--primary)] font-bold transition-colors cursor-pointer"
                            title="Add New Category"
                          >
                            + New
                          </button>
                          {canEditOrDeleteCategory && categoryId && (
                            <>
                              <button
                                type="button"
                                onClick={handleEditCategory}
                                className="p-0.5 hover:bg-slate-100 rounded text-amber-600 transition-colors cursor-pointer"
                                title="Edit Category"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={handleDeleteCategory}
                                className="p-0.5 hover:bg-red-50 rounded text-red-600 transition-colors cursor-pointer"
                                title="Delete Category"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <ResponsiveSelect
                      label="Expense Category"
                      value={categoryId}
                      options={categoryOptions}
                      onChange={(val) => setCategoryId(val)}
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none font-mono"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none font-mono"
                      required
                    />
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Proposed Payout Mode
                    </label>
                    <ResponsiveSelect
                      label="Payout Mode"
                      value={paymentMode}
                      options={paymentModeOptions}
                      onChange={(val) => setPaymentMode(val)}
                    />
                  </div>

                  {/* Submission Checkbox */}
                  <div className="flex items-center pt-2 sm:pt-6">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={submitDirectly}
                        onChange={(e) => setSubmitDirectly(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-slate-350 bg-white text-[var(--primary)] focus:ring-[var(--primary)]/10"
                      />
                      <span>Submit Directly for Approval</span>
                    </label>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                    Expense Description / Purpose
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="block w-full px-3.5 sm:px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    placeholder="e.g. Flight travel tickets for Bangalore conference"
                    required
                  />
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                    Upload Bill / Receipt (Image or PDF)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                    className="block w-full px-3 sm:px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs sm:text-sm focus:outline-none file:mr-3 sm:file:mr-4 file:py-1.5 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-light)] file:text-[var(--primary)] hover:file:bg-[var(--primary-light)]/85 transition-colors cursor-pointer"
                    {...(!isEditMode && { required: true })}
                  />
                  {isEditMode && <span className="text-[10px] text-slate-400 mt-1 block">Leave empty to keep existing receipt.</span>}
                </div>

                {/* UPI Payment Screenshot */}
                {paymentMode === 'UPI' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-650 mb-1.5">
                      Upload UPI Payment Screenshot (Required)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => setPaymentProofFile(e.target.files ? e.target.files[0] : null)}
                      className="block w-full px-3 sm:px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 text-xs sm:text-sm focus:outline-none file:mr-3 sm:file:mr-4 file:py-1.5 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-light)] file:text-[var(--primary)] hover:file:bg-[var(--primary-light)]/85 transition-colors cursor-pointer"
                      {...(!isEditMode && { required: true })}
                    />
                    {isEditMode && <span className="text-[10px] text-slate-400 mt-1 block">Leave empty to keep existing screenshot.</span>}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="p-3.5 sm:p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 sm:gap-3 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsEditMode(false);
                    setEditExpenseId('');
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer text-white-force"
                  style={{ color: '#ffffff' }}
                >
                  {formLoading ? 'Submitting...' : submitDirectly ? (isEditMode ? 'Update & Resubmit' : 'Submit Claim') : (isEditMode ? 'Update Draft' : 'Save as Draft')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
