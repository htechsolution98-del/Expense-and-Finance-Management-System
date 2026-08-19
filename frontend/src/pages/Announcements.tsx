import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Megaphone,
  Search,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
  Archive,
  User,
  Clock,
  ArrowRight
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  content: string;
  attachment: string | null;
  targetRoles: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  expiresAt: string | null;
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string;
  };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter Tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'EXPIRED'>('ALL');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAttachment, setFormAttachment] = useState('');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formTargetRoles, setFormTargetRoles] = useState<string[]>([]);
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // User details
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { role: 'STAFF', permissions: [] };
  const canManage =
    user.permissions?.includes('ANNOUNCEMENT_CREATE') ||
    user.permissions?.includes('*') ||
    user.role === 'SUPER_ADMIN';

  // Load Announcements & Roles
  const loadData = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data.data);

      if (canManage) {
        try {
          const rolesRes = await api.get('/users/roles');
          setRoles(rolesRes.data.data || []);
        } catch (rolesErr) {
          console.error('Failed to load roles: ', rolesErr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch announcements data.');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic Polling (30s)
  useAutoRefresh(loadData, 30000, [loadData]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormTitle('');
    setFormContent('');
    setFormAttachment('');
    setFormStatus('ACTIVE');
    setFormExpiresAt('');
    setFormTargetRoles([]);
    setFormError('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (ann: Announcement) => {
    setSelectedAnn(ann);
    setFormTitle(ann.title);
    setFormContent(ann.content);
    setFormAttachment(ann.attachment || '');
    setFormStatus(ann.status);
    setFormExpiresAt(ann.expiresAt ? new Date(ann.expiresAt).toISOString().split('T')[0] : '');
    setFormTargetRoles(ann.targetRoles ? ann.targetRoles.split(',').map(r => r.trim()) : []);
    setFormError('');
    setShowEditModal(true);
  };

  // Handle Form Submit (Create)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      const payload = {
        title: formTitle,
        content: formContent,
        attachment: formAttachment || null,
        targetRoles: formTargetRoles.length > 0 ? formTargetRoles.join(',') : null,
        status: formStatus,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      };

      await api.post('/announcements', payload);
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to create announcement.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Form Submit (Edit)
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnn) return;
    setFormLoading(true);
    setFormError('');

    try {
      const payload = {
        title: formTitle,
        content: formContent,
        attachment: formAttachment || null,
        targetRoles: formTargetRoles.length > 0 ? formTargetRoles.join(',') : null,
        status: formStatus,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      };

      await api.put(`/announcements/${selectedAnn.id}`, payload);
      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to update announcement.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete announcement.');
    }
  };

  // Target Roles check box handler
  const handleRoleToggle = (roleName: string) => {
    setFormTargetRoles(prev => 
      prev.includes(roleName) 
        ? prev.filter(r => r !== roleName) 
        : [...prev, roleName]
    );
  };

  // Check Expiry
  const isExpired = (expiresAtStr: string | null) => {
    if (!expiresAtStr) return false;
    return new Date(expiresAtStr).getTime() < new Date().getTime();
  };

  // Filter & Search Logic
  const filteredAnnouncements = announcements.filter(ann => {
    // Search filter
    const matchesSearch = 
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') return ann.status === 'ACTIVE' && !isExpired(ann.expiresAt);
    if (activeTab === 'DRAFT') return ann.status === 'DRAFT';
    if (activeTab === 'ARCHIVED') return ann.status === 'ARCHIVED';
    if (activeTab === 'EXPIRED') return isExpired(ann.expiresAt);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Widget */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--card-border)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[var(--primary-light)] text-[var(--primary)] rounded-2xl">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Company Announcements</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Stay updated with official company notices, policy updates and news.</p>
          </div>
        </div>
        
        {canManage && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs and Search Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-[var(--card-border)] shadow-sm">
        {/* tabs only for admin/manager who can see drafts/expired/etc */}
        {canManage ? (
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-xl">
            {(['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'EXPIRED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-[var(--primary)] shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500">
            Showing all active announcements
          </div>
        )}

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
          />
        </div>
      </div>

      {/* Feed Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-[var(--card-border)] text-center shadow-sm">
          <div className="p-4 bg-slate-50 rounded-full text-slate-400 mb-4">
            <Megaphone className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-800">No Announcements Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">There are no company announcements that match the selected filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAnnouncements.map((ann) => {
            const expired = isExpired(ann.expiresAt);
            return (
              <div
                key={ann.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full overflow-hidden"
              >
                {/* Visual Accent Header */}
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  {/* Meta Tags */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Status Tag */}
                      {ann.status === 'ACTIVE' && !expired && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Active
                        </span>
                      )}
                      {ann.status === 'DRAFT' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          Draft
                        </span>
                      )}
                      {ann.status === 'ARCHIVED' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Archived
                        </span>
                      )}
                      {expired && ann.status === 'ACTIVE' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                          Expired
                        </span>
                      )}
                    </div>

                    {/* Expiry text */}
                    {ann.expiresAt && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Expires: {new Date(ann.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Title & Content */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 leading-snug tracking-tight mb-2">
                      {ann.title}
                    </h3>
                    <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                      {ann.content}
                    </p>
                  </div>

                  {/* Attachment if present */}
                  {ann.attachment && (
                    <div className="pt-2">
                      <a
                        href={ann.attachment}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] font-bold hover:underline"
                      >
                        <span>View Attachment</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Target Roles Info */}
                  {ann.targetRoles && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <div className="flex flex-wrap gap-1">
                        {ann.targetRoles.split(',').map((r) => (
                          <span
                            key={r}
                            className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-semibold uppercase"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer info & actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-700 leading-tight">
                        {ann.createdBy.name || 'Author'}
                      </p>
                      <p className="text-[9px] text-slate-500 leading-none mt-0.5">
                        {new Date(ann.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons (only for admin) */}
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(ann)}
                        title="Edit Announcement"
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ann.id)}
                        title="Delete Announcement"
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-800 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[var(--primary)]" />
                Create Announcement
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day Holiday Notification"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Content */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Content <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={6}
                  placeholder="Write the details of the announcement here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              {/* Expiry & Status row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  >
                    <option value="ACTIVE">Active (Broadcast)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* Target Roles selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">Target Roles (If left empty, broadcast to all employees)</label>
                <div className="flex flex-wrap gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {roles.map((r) => (
                    <label key={r.name} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formTargetRoles.includes(r.name)}
                        onChange={() => handleRoleToggle(r.name)}
                        className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4 cursor-pointer"
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Attachment URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Attachment URL (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Link to PDF, Google Doc, image, etc."
                  value={formAttachment}
                  onChange={(e) => setFormAttachment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  {formLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedAnn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[var(--primary)]" />
                Edit Announcement
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Title <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Independence Day Holiday Notification"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Content */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Content <span className="text-rose-500">*</span></label>
                <textarea
                  required
                  rows={6}
                  placeholder="Write the details of the announcement here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
                />
              </div>

              {/* Expiry & Status row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                  >
                    <option value="ACTIVE">Active (Broadcast)</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* Target Roles selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">Target Roles (If left empty, broadcast to all employees)</label>
                <div className="flex flex-wrap gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {roles.map((r) => (
                    <label key={r.name} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formTargetRoles.includes(r.name)}
                        onChange={() => handleRoleToggle(r.name)}
                        className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4 cursor-pointer"
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Attachment URL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Attachment URL (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Link to PDF, Google Doc, image, etc."
                  value={formAttachment}
                  onChange={(e) => setFormAttachment(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  {formLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  Update Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
