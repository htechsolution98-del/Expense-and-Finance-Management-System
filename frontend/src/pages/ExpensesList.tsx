import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { 
  Plus, Receipt, RefreshCw, Wallet, AlertCircle, X, Shield, Clock, Trash2, Edit
} from 'lucide-react';

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
        classes = 'bg-gray-500/10 border-gray-500/25 text-gray-400';
        break;
      case 'SUBMITTED':
        classes = 'bg-blue-500/10 border-blue-500/25 text-blue-400';
        break;
      case 'UNDER_REVIEW':
        classes = 'bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse';
        break;
      case 'RETURNED_FOR_CORRECTION':
        classes = 'bg-orange-500/10 border-orange-500/25 text-orange-400';
        break;
      case 'APPROVED':
        classes = 'bg-green-500/10 border-green-500/25 text-green-400';
        break;
      case 'REJECTED':
        classes = 'bg-red-500/10 border-red-500/25 text-red-400';
        break;
      case 'REIMBURSED':
        classes = 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
        break;
      default:
        classes = 'bg-gray-500/10 border-gray-500/25 text-gray-400';
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Office & Staff Expenses
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            File company expense reports, monitor review sequences, and settle payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchExpenses}
            disabled={loading}
            className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>File Expense</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main layout: Grid of list + review side detail sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Expenses List */}
        <div className={`rounded-2xl glass-panel bg-card-dark/20 border border-white/5 overflow-hidden shadow-xl ${
          selectedExpense ? 'lg:col-span-2' : 'lg:col-span-3'
        }`}>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#0c101a]/40">
                  <th className="px-6 py-4">Expense No</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Category / Date</th>
                  <th className="px-6 py-4">Purpose</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {loading && expenses.length === 0 ? (
                  [1, 2, 3].map((n) => (
                    <tr key={n} className="animate-pulse">
                      <td colSpan={6} className="h-16 bg-white/2"></td>
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-semibold italic">
                      No expense claims registered in this company.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      onClick={() => setSelectedExpense(exp)}
                      className={`hover:bg-white/2 transition-colors cursor-pointer ${
                        selectedExpense?.id === exp.id ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-white font-mono">
                        {exp.expenseNo}
                      </td>

                      <td className="px-6 py-4 text-gray-300 font-medium">
                        {exp.employee?.name}
                      </td>

                      <td className="px-6 py-4 space-y-1">
                        <span className="text-gray-400 font-semibold block">
                          {exp.category?.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(exp.date).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-gray-400 max-w-xs truncate">
                        {exp.purpose}
                      </td>

                      <td className="px-6 py-4 text-right font-black font-mono text-white text-sm">
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
        </div>

        {/* Side Workflow review sheet */}
        {selectedExpense && (
          <div className="rounded-2xl glass-panel p-6 bg-card-dark/30 border border-white/5 shadow-xl space-y-6 animate-slide-in-right relative">
            <div className="absolute top-4 right-4 flex gap-3">
              {(user.role === 'SUPER_ADMIN' || user.id === selectedExpense.createdBy) && 
                (selectedExpense.status === 'RETURNED_FOR_CORRECTION' || selectedExpense.status === 'DRAFT' || selectedExpense.status === 'REJECTED') && (
                <button
                  onClick={() => openEditModal(selectedExpense)}
                  className="text-gray-500 hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Edit & Resubmit"
                >
                  <Edit className="w-5 h-5" />
                </button>
              )}
              {user.role === 'SUPER_ADMIN' && selectedExpense.status !== 'REIMBURSED' && (
                <button
                  onClick={() => handleDeleteExpense(selectedExpense.id)}
                  className="text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
                  title="Delete Expense"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setSelectedExpense(null)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header info */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 block mb-1">
                Claim Verification Details
              </span>
              <h2 className="text-xl font-extrabold text-white font-mono">
                {selectedExpense.expenseNo}
              </h2>
            </div>

            {/* Core facts */}
            <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee:</span>
                <span className="font-bold text-white">{selectedExpense.employee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Purpose:</span>
                <span className="text-gray-300 font-medium">{selectedExpense.purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Mode:</span>
                <span className="text-gray-400 font-bold uppercase">{selectedExpense.paymentMode.replace('_', ' ')}</span>
              </div>
              
              {selectedExpense.receiptUrl && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt Bill:</span>
                  <a href={`http://localhost:5000${selectedExpense.receiptUrl}`} target="_blank" rel="noreferrer" className="text-indigo-400 font-bold hover:underline">View Receipt</a>
                </div>
              )}
              {selectedExpense.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">UTR / Ref:</span>
                  <span className="text-gray-300 font-medium">{selectedExpense.paymentReference}</span>
                </div>
              )}
              {selectedExpense.paymentProofUrl && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Proof:</span>
                  <a href={`http://localhost:5000${selectedExpense.paymentProofUrl}`} target="_blank" rel="noreferrer" className="text-green-400 font-bold hover:underline">View Proof</a>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                <span className="text-gray-500 font-bold uppercase text-[10px]">Requested Amount:</span>
                <span className="text-base font-black text-white font-mono">
                  ₹{selectedExpense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Workflow approval tracks */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Approval Sequence Steps</span>
              </h3>

              {!selectedExpense.approvalRequest ? (
                <div className="p-4 rounded-xl border border-white/5 bg-white/1 text-center text-xs text-gray-500 italic">
                  No active approval track. Re-submit this draft to trigger.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedExpense.approvalRequest.approvalSteps.map((step) => {
                    const isActive = selectedExpense.approvalRequest?.status === 'PENDING' && selectedExpense.approvalRequest?.currentStep === step.stepNumber;
                    
                    let statusColor = 'text-gray-500 border-white/5 bg-white/1';
                    if (step.status === 'APPROVED') statusColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
                    if (step.status === 'REJECTED') statusColor = 'text-red-400 border-red-500/20 bg-red-500/5';
                    if (step.status === 'RETURNED') statusColor = 'text-orange-400 border-orange-500/20 bg-orange-500/5';
                    if (isActive) statusColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';

                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${statusColor}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold flex items-center gap-2">
                            <span className="text-[10px] w-5 h-5 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                              {step.stepNumber + 1}
                            </span>
                            <span>{step.roleName} Role</span>
                          </span>

                          <span className="text-[10px] font-extrabold uppercase">
                            {isActive ? 'Pending Review' : step.status.toLowerCase()}
                          </span>
                        </div>

                        {step.comments && (
                          <p className="text-[11px] text-gray-400 leading-relaxed italic pl-7 border-l border-white/10">
                            "{step.comments}"
                          </p>
                        )}

                        {step.actionAt && (
                          <span className="text-[9px] text-gray-500 font-mono text-right">
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
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4 animate-zoom-in">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span>ACTION REQUIRED: Pending your Review ({activeStepRole})</span>
                </div>

                {actionError && (
                  <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                    {actionError}
                  </div>
                )}

                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-amber-500 text-xs text-white outline-none h-16 resize-none"
                  placeholder="Review comments / approval remarks..."
                />

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleWorkflowAction('approve')}
                    disabled={actionLoading}
                    className="py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-[10px] uppercase shadow disabled:opacity-50 cursor-pointer"
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
                    className="py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase shadow disabled:opacity-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* CASHIER PAYOUT ACTION CARD */}
            {selectedExpense.status === 'APPROVED' && canPay && (
              <form onSubmit={handlePayoutSubmit} className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 space-y-4 animate-zoom-in">
                <div className="flex items-center gap-2 text-xs font-bold text-green-400">
                  <Wallet className="w-4 h-4" />
                  <span>Settle Approved Expense Reimbursement</span>
                </div>

                {payoutError && (
                  <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                    {payoutError}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                    Payout Source Account
                  </label>
                  <select
                    value={payoutAccountId}
                    onChange={(e) => setPayoutAccountId(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-green-500 text-xs text-white outline-none"
                    required
                  >
                    <option value="">-- Choose Payout Source --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: ₹{acc.currentBalance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Reference / UTR */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                    UTR / Reference Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-green-500 text-xs text-white outline-none"
                    placeholder="e.g. UTR-123456789"
                  />
                </div>

                {/* Payment Proof Upload */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                    Upload Proof (Cheque / Screenshot)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setPaymentProofFile(e.target.files ? e.target.files[0] : null)}
                    className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 text-gray-400 text-xs focus:outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-green-500/20 file:text-green-400 hover:file:bg-green-500/30 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={payoutLoading}
                  className="w-full py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-xs uppercase shadow-md shadow-green-500/10 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {payoutLoading ? 'Executing Payout...' : 'Disburse Payout Settlement'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">
                  {isEditMode ? 'Edit & Resubmit Claim' : 'File Office / Staff Expense'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setIsEditMode(false);
                  setEditExpenseId('');
                }}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Submitting Employee
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expense Category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Expense Category
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                      required
                    >
                      <option value="">-- Choose Category --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {canCreateCategory && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs text-indigo-400 transition-colors"
                          title="Add New Category"
                        >
                          ➕
                        </button>
                        {canEditOrDeleteCategory && (
                          <>
                            <button
                              type="button"
                              onClick={handleEditCategory}
                              disabled={!categoryId}
                              className={`px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-yellow-400 transition-colors ${!categoryId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
                              title="Edit Category"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={handleDeleteCategory}
                              disabled={!categoryId}
                              className={`px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-red-400 transition-colors ${!categoryId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
                              title="Delete Category"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div>
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

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none font-mono"
                    required
                  />
                </div>

                {/* Payment Mode */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Proposed Payout Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                  >
                    <option value="CASH">Physical Cash Box</option>
                    <option value="UPI">UPI Digital Wallet</option>
                  </select>
                </div>

                {/* Submission Checkbox */}
                <div className="col-span-2 sm:col-span-1 flex items-center pl-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={submitDirectly}
                      onChange={(e) => setSubmitDirectly(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-white/5 bg-[#0e1420] text-indigo-500 focus:ring-indigo-500/20"
                    />
                    <span>Submit Directly for Approval</span>
                  </label>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Expense Description / Purpose
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                  placeholder="e.g. Flight travel tickets for Bangalore conference"
                  required
                />
              </div>

              {/* Receipt Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Upload Bill / Receipt (Image or PDF)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-gray-400 text-sm focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30 transition-colors"
                  {...(!isEditMode && { required: true })}
                />
                {isEditMode && <span className="text-[10px] text-gray-500 mt-1 block">Leave empty to keep existing receipt.</span>}
              </div>

              {/* UPI Payment Screenshot */}
              {paymentMode === 'UPI' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Upload UPI Payment Screenshot (Required)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setPaymentProofFile(e.target.files ? e.target.files[0] : null)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-gray-400 text-sm focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-500/20 file:text-indigo-400 hover:file:bg-indigo-500/30 transition-colors"
                    {...(!isEditMode && { required: true })}
                  />
                  {isEditMode && <span className="text-[10px] text-gray-500 mt-1 block">Leave empty to keep existing screenshot.</span>}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsEditMode(false);
                    setEditExpenseId('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-650 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
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
