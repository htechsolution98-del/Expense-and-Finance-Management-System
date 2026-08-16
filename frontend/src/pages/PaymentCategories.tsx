import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, RefreshCw, Tag, DollarSign } from 'lucide-react';

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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Categories Management</h1>
          <p className="text-gray-400 mt-1.5 text-sm">Manage dynamic categories for Payments and Staff Expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllCategories}
            disabled={loading}
            className="p-3 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add {activeTab === 'payment' ? 'Payment' : 'Expense'} Category
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'payment'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 text-gray-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Payment Categories ({paymentCategories.length})
        </button>
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
            activeTab === 'expense'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 text-gray-400 hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" /> Staff Expense Categories ({expenseCategories.length})
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Payment Categories Tab */}
      {activeTab === 'payment' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paymentCategories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-[#0e1420] rounded-2xl border border-white/5">
              No payment categories found. Click "Add Category" to create one.
            </div>
          ) : (
            paymentCategories.map((cat) => (
              <div key={cat.id} className="p-6 rounded-2xl bg-[#0e1420] border border-white/5 relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{cat.type.replace('_', ' ')}</span>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${cat.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {cat.status}
                  </span>
                </div>
                
                {canEditOrDelete && (
                  <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEditPayment(cat)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeletePayment(cat.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Expense Categories Tab */}
      {activeTab === 'expense' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expenseCategories.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-[#0e1420] rounded-2xl border border-white/5">
              No staff expense categories found. Click "Add Category" to create one.
            </div>
          ) : (
            expenseCategories.map((cat) => (
              <div key={cat.id} className="p-6 rounded-2xl bg-[#0e1420] border border-white/5 relative group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                    <span className="text-xs text-indigo-400 uppercase tracking-wider">Staff Expense</span>
                  </div>
                  <span className="px-2 py-1 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-400">
                    ACTIVE
                  </span>
                </div>
                
                {canEditOrDelete && (
                  <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEditExpense(cat)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg cursor-pointer">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteExpense(cat.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">
                New {activeTab === 'payment' ? 'Payment' : 'Staff Expense'} Category
              </h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg">{formError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Category Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeTab === 'payment' ? 'e.g. Sales Income' : 'e.g. Travel & Flight'}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500"
                />
              </div>

              {activeTab === 'payment' && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500">
                    <option value="BOTH">Both (In & Out)</option>
                    <option value="PAYMENT_IN">Payment In (Deposit)</option>
                    <option value="PAYMENT_OUT">Payment Out (Payout)</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-gray-400 hover:text-white cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold cursor-pointer">{formLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">
                Edit {activeTab === 'payment' ? 'Payment' : 'Staff Expense'} Category
              </h2>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg">{formError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Category Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500" />
              </div>

              {activeTab === 'payment' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Type</label>
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500">
                      <option value="BOTH">Both (In & Out)</option>
                      <option value="PAYMENT_IN">Payment In (Deposit)</option>
                      <option value="PAYMENT_OUT">Payment Out (Payout)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditForm(false)} className="px-4 py-2 text-gray-400 hover:text-white cursor-pointer">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold cursor-pointer">{formLoading ? 'Updating...' : 'Update'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCategories;
