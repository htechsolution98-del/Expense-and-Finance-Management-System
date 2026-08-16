import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';

interface PaymentCategory {
  id: string;
  name: string;
  type: string;
  status: string;
}

const PaymentCategories: React.FC = () => {
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentUserString = localStorage.getItem('user');
  const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
  const isSuperAdmin = currentUser && currentUser.role === 'SUPER_ADMIN';

  const hasPermission = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.some((p) => currentUser?.permissions?.includes(p));
  };

  const canCreate = hasPermission(['COMPANY_UPDATE']);
  const canEditOrDelete = isSuperAdmin;

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('BOTH');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('BOTH');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/payment-categories');
      setCategories(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch payment categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/payment-categories', { name, type });
      setShowAddForm(false);
      setName('');
      setType('BOTH');
      fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEdit = (cat: PaymentCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditType(cat.type);
    setEditStatus(cat.status);
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.patch(`/payment-categories/${editId}`, {
        name: editName,
        type: editType,
        status: editStatus,
      });
      setShowEditForm(false);
      fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to update category');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/payment-categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Payment Categories</h1>
          <p className="text-gray-400 mt-1.5 text-sm">Manage dynamic categories for payments in and out.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCategories}
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
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
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
                <button onClick={() => handleOpenEdit(cat)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg cursor-pointer">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cat.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0a0f16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">New Category</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg">{formError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Category Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500">
                  <option value="BOTH">Both (In & Out)</option>
                  <option value="PAYMENT_IN">Payment In (Deposit)</option>
                  <option value="PAYMENT_OUT">Payment Out (Payout)</option>
                </select>
              </div>
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
              <h2 className="text-lg font-bold text-white">Edit Category</h2>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-lg">{formError}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2">Category Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 text-white text-sm outline-none focus:border-emerald-500" />
              </div>
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
