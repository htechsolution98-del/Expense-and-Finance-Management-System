import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Edit2, Trash2, RefreshCw, X } from 'lucide-react';
import { ResponsiveSelect } from '../components/ResponsiveSelect';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-800">{isEdit ? 'Edit Rule' : 'New Approval Rule'}</h3>
          <button
            type="button"
            onClick={closeModals}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Module</label>
              <ResponsiveSelect
                label="Module"
                value={module}
                onChange={setModule}
                options={MODULES.map(m => ({
                  value: m,
                  label: m.replace('_', ' ')
                }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Min Amount</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  required
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                  placeholder="e.g. 0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Max Amount</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  required
                  min="0"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                  placeholder="e.g. 5000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Approver Roles</label>
              <div className="flex flex-wrap gap-2">
                {dbRoles.map(role => {
                  const isSelected = approverRoles.includes(role);
                  return (
                    <button
                      type="button"
                      key={role}
                      onClick={() => handleRoleToggle(role, approverRoles, setApproverRoles)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
              {approverRoles.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1 font-medium">Select at least one approver role.</p>
              )}
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 sm:flex sm:justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={closeModals}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50 text-center"
            >
              {formLoading ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">Approval Rules</h1>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm">Manage dynamic approval workflows based on amount limits.</p>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchRules}
            disabled={loading}
            className="p-2.5 sm:p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer border border-slate-200 shrink-0 flex items-center justify-center"
            title="Refresh Approval Rules"
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
              <span className="truncate">Add Rule</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {rules.map((rule) => (
          <div key={rule.id} className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative group flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">{rule.module.replace('_', ' ')}</h3>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block mt-1">
                    ₹{rule.minAmount.toLocaleString()} - ₹{rule.maxAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Approved By:</p>
                <div className="flex flex-wrap gap-1.5">
                  {rule.approverRoles.split(',').map(r => (
                    <span key={r} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {r.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {canEditOrDelete && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(rule)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-all"
                  title="Edit Rule"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-all"
                  title="Delete Rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
        {rules.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm">
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
