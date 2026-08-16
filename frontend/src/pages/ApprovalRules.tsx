import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';

interface ApprovalRule {
  id: string;
  module: string;
  minAmount: number;
  maxAmount: number;
  approverRoles: string;
}

const MODULES = ['EXPENSE', 'ADVANCE', 'SALARY', 'BANK_ACCOUNT', 'PAYMENT_OUT', 'PAYMENT_IN'];

const ApprovalRules: React.FC = () => {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
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
  const [module, setModule] = useState('ADVANCE');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [approverRoles, setApproverRoles] = useState<string[]>([]);
  const [dbRoles, setDbRoles] = useState<string[]>(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS', 'HR', 'STAFF']);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [showEditForm, setShowEditForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/users/roles');
      const roleNames = res.data.data.map((r: { name: string }) => r.name);
      setDbRoles(roleNames);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/approval-rules');
      setRules(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch approval rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchRoles();
  }, []);

  const handleRoleToggle = (role: string, currentRoles: string[], setRoles: (r: string[]) => void) => {
    if (currentRoles.includes(role)) {
      setRoles(currentRoles.filter(r => r !== role));
    } else {
      setRoles([...currentRoles, role]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (approverRoles.length === 0) throw new Error("Select at least one approver role");
      await api.post('/approval-rules', {
        module,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        approverRoles: approverRoles.join(',')
      });
      setShowAddForm(false);
      setModule('ADVANCE');
      setMinAmount('');
      setMaxAmount('');
      setApproverRoles([]);
      fetchRules();
    } catch (err: any) {
      setFormError(err.message || err.response?.data?.message || 'Failed to create rule');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEdit = (rule: ApprovalRule) => {
    setEditId(rule.id);
    setModule(rule.module);
    setMinAmount(rule.minAmount.toString());
    setMaxAmount(rule.maxAmount.toString());
    setApproverRoles(rule.approverRoles.split(',').map(r => r.trim()).filter(Boolean));
    setShowEditForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (approverRoles.length === 0) throw new Error("Select at least one approver role");
      await api.put(`/approval-rules/${editId}`, {
        module,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        approverRoles: approverRoles.join(',')
      });
      setShowEditForm(false);
      fetchRules();
    } catch (err: any) {
      setFormError(err.message || err.response?.data?.message || 'Failed to update rule');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.delete(`/approval-rules/${id}`);
      fetchRules();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete rule');
    }
  };

  const closeModals = () => {
    setShowAddForm(false);
    setShowEditForm(false);
    setFormError('');
    setModule('ADVANCE');
    setMinAmount('');
    setMaxAmount('');
    setApproverRoles([]);
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => void, isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0e1420] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <h3 className="text-xl font-bold text-white mb-6">{isEdit ? 'Edit Rule' : 'New Approval Rule'}</h3>
        
        {formError && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {formError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1.5">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
            >
              {MODULES.map(m => (
                <option key={m} value={m} className="bg-[#0e1420]">{m}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-1.5">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                required
                min="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                placeholder="e.g. 0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-1.5">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                required
                min="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none"
                placeholder="e.g. 5000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">Approver Roles</label>
            <div className="flex flex-wrap gap-2">
              {dbRoles.map(role => (
                <button
                  type="button"
                  key={role}
                  onClick={() => handleRoleToggle(role, approverRoles, setApproverRoles)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    approverRoles.includes(role)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
            <button
              type="button"
              onClick={closeModals}
              className="px-5 py-2.5 rounded-xl font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 py-2.5 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              {formLoading ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Approval Rules</h1>
          <p className="text-gray-400 mt-1.5 text-sm">Manage dynamic approval workflows based on amount limits.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchRules}
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
              <Plus className="w-4 h-4" /> Add Rule
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
        {rules.map((rule) => (
          <div key={rule.id} className="p-6 rounded-2xl bg-[#0e1420] border border-white/5 relative group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{rule.module}</h3>
                <span className="text-xs text-gray-500 uppercase tracking-wider">₹{rule.minAmount} - ₹{rule.maxAmount}</span>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Approved By:</p>
              <div className="flex flex-wrap gap-1">
                {rule.approverRoles.split(',').map(r => (
                  <span key={r} className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                    {r.trim()}
                  </span>
                ))}
              </div>
            </div>
            
            {canEditOrDelete && (
              <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpenEdit(rule)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg cursor-pointer">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        {rules.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white/5 rounded-xl border border-white/10">
            No approval rules configured. Click "Add Rule" to create one.
          </div>
        )}
      </div>

      {showAddForm && renderForm(handleCreate, false)}
      {showEditForm && renderForm(handleUpdate, true)}
    </div>
  );
};

export default ApprovalRules;
