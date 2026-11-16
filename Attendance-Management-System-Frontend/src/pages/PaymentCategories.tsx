import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, RefreshCw, Tag, DollarSign, X } from 'lucide-react';
import { ResponsiveSelect } from '../components/ResponsiveSelect';

interface PaymentCategory {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  status?: string;
}

const PaymentCategories: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'payment' | 'expense'>('payment');
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentUserString = localStorage.getItem('user');
  const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
  const isSuperAdmin = currentUser && currentUser.role === 'SUPER_ADMIN';
  const isAdminOrAccounts = currentUser && (
    isSuperAdmin || 
    currentUser.role === 'ADMIN' || 
    currentUser.role === 'ACCOUNTS' || 
    currentUser.role?.startsWith('ACCOUNT') || 
    currentUser.role?.startsWith('ADMIN')
  );

  const canCreate = isAdminOrAccounts;
  const canEditOrDelete = isAdminOrAccounts;

  // Add Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('BOTH');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Form states
  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('BOTH');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const fetchAllCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const [payRes, expRes] = await Promise.all([
        api.get('/payment-categories').catch(() => ({ data: { data: [] } })),
        api.get('/expenses/categories').catch(() => ({ data: { data: [] } })),
      ]);
      setPaymentCategories(payRes.data.data || []);
      setExpenseCategories(expRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (activeTab === 'payment') {
        await api.post('/payment-categories', { name, type });
      } else {
        await api.post('/expenses/categories', { name });
      }
      setShowAddForm(false);
      setName('');
      setType('BOTH');
      fetchAllCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEditPayment = (cat: PaymentCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditType(cat.type);
    setEditStatus(cat.status);
    setShowEditForm(true);
  };

  const handleOpenEditExpense = (cat: ExpenseCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditType('EXPENSE');
    setEditStatus(cat.status || 'ACTIVE');
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (activeTab === 'payment') {
        await api.patch(`/payment-categories/${editId}`, {
          name: editName,
          type: editType,
          status: editStatus,
        });
      } else {
        await api.put(`/expenses/categories/${editId}`, {
          name: editName,
        });
      }
      setShowEditForm(false);
      fetchAllCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update category');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment category?')) return;
    try {
      await api.delete(`/payment-categories/${id}`);
      fetchAllCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense category?')) return;
    try {
      await api.delete(`/expenses/categories/${id}`);
      fetchAllCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const cardStyles = [
    { bg: 'bg-emerald-50/60', border: 'border-emerald-200/80', label: 'text-emerald-700' },
    { bg: 'bg-blue-50/60', border: 'border-blue-200/80', label: 'text-blue-700' },
    { bg: 'bg-violet-50/60', border: 'border-violet-200/80', label: 'text-violet-700' },
    { bg: 'bg-amber-50/60', border: 'border-amber-200/80', label: 'text-amber-700' },
    { bg: 'bg-rose-50/60', border: 'border-rose-200/80', label: 'text-rose-700' },
    { bg: 'bg-cyan-50/60', border: 'border-cyan-200/80', label: 'text-cyan-700' },
    { bg: 'bg-orange-50/60', border: 'border-orange-200/80', label: 'text-orange-700' },
    { bg: 'bg-indigo-50/60', border: 'border-indigo-200/80', label: 'text-indigo-700' }
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">Categories Management</h1>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">Manage dynamic categories for Payments and Staff Expenses.</p>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchAllCategories}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer border border-slate-200 shrink-0 flex items-center justify-center"
            title="Refresh Categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/10 text-center"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">Add {activeTab === 'payment' ? 'Payment' : 'Expense'} Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full flex items-center p-1 sm:p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('payment')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer min-w-0 ${
            activeTab === 'payment'
              ? 'bg-[var(--primary)] text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Payment Categories ({paymentCategories.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expense')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer min-w-0 ${
            activeTab === 'expense'
              ? 'bg-[var(--primary)] text-white shadow-md shadow-emerald-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Staff Expense Categories ({expenseCategories.length})</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Payment Categories Tab */}
      {activeTab === 'payment' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 md:gap-6">
          {paymentCategories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm">
              No payment categories found. Click "Add Category" to create one.
            </div>
          ) : (
            paymentCategories.map((cat, idx) => {
              const style = cardStyles[idx % cardStyles.length];
              return (
                <div key={cat.id} className={`p-3 sm:p-5 md:p-6 rounded-2xl border relative group transition-all duration-200 hover:shadow-md flex flex-col justify-between ${style.bg} ${style.border}`}>
                  <div>
                    <div className="flex justify-between items-start gap-1 sm:gap-2 mb-2 sm:mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-base md:text-lg font-black text-slate-800 leading-snug line-clamp-2">{cat.name}</h3>
                        <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 block truncate ${style.label}`}>{cat.type.replace('_', ' ')}</span>
                      </div>
                      <span className={`px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-md uppercase border shrink-0 ${
                        cat.status === 'ACTIVE' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {cat.status}
                      </span>
                    </div>
                  </div>
                  
                  {canEditOrDelete && (
                    <div className="pt-2 sm:pt-4 border-t border-slate-200/50 flex items-center justify-end gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPayment(cat)}
                        className="p-1 sm:p-1.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-all"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(cat.id)}
                        className="p-1 sm:p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-all"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Expense Categories Tab */}
      {activeTab === 'expense' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 md:gap-6">
          {expenseCategories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm">
              No staff expense categories found. Click "Add Category" to create one.
            </div>
          ) : (
            expenseCategories.map((cat, idx) => {
              const style = cardStyles[idx % cardStyles.length];
              return (
                <div key={cat.id} className={`p-3 sm:p-5 md:p-6 rounded-2xl border relative group transition-all duration-200 hover:shadow-md flex flex-col justify-between ${style.bg} ${style.border}`}>
                  <div>
                    <div className="flex justify-between items-start gap-1 sm:gap-2 mb-2 sm:mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-base md:text-lg font-black text-slate-800 leading-snug line-clamp-2">{cat.name}</h3>
                        <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 block truncate ${style.label}`}>Staff Expense</span>
                      </div>
                      <span className="px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                  
                  {canEditOrDelete && (
                    <div className="pt-2 sm:pt-4 border-t border-slate-200/50 flex items-center justify-end gap-1.5 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={() => handleOpenEditExpense(cat)}
                        className="p-1 sm:p-1.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-all"
                        title="Edit Category"
                      >
                        <Edit2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(cat.id)}
                        className="p-1 sm:p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-all"
                        title="Delete Category"
                      >
                        <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
                New {activeTab === 'payment' ? 'Payment' : 'Staff Expense'} Category
              </h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={activeTab === 'payment' ? 'e.g. Sales Income' : 'e.g. Travel & Flight'}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                  />
                </div>

                {activeTab === 'payment' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2">Type</label>
                    <ResponsiveSelect
                      label="Category Type"
                      value={type}
                      onChange={setType}
                      options={[
                        { value: 'BOTH', label: 'Both (In & Out)' },
                        { value: 'PAYMENT_IN', label: 'Payment In (Deposit)' },
                        { value: 'PAYMENT_OUT', label: 'Payment Out (Payout)' },
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 sm:flex sm:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 text-center"
                >
                  {formLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
                Edit {activeTab === 'payment' ? 'Payment' : 'Staff Expense'} Category
              </h2>
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                  />
                </div>

                {activeTab === 'payment' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">Type</label>
                      <ResponsiveSelect
                        label="Category Type"
                        value={editType}
                        onChange={setEditType}
                        options={[
                          { value: 'BOTH', label: 'Both (In & Out)' },
                          { value: 'PAYMENT_IN', label: 'Payment In (Deposit)' },
                          { value: 'PAYMENT_OUT', label: 'Payment Out (Payout)' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">Status</label>
                      <ResponsiveSelect
                        label="Status"
                        value={editStatus}
                        onChange={setEditStatus}
                        options={[
                          { value: 'ACTIVE', label: 'Active' },
                          { value: 'INACTIVE', label: 'Inactive' },
                        ]}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 sm:flex sm:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 text-center"
                >
                  {formLoading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCategories;
