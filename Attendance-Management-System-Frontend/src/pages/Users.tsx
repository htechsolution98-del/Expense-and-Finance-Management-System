import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  Plus,
  Search,
  Shield,
  User as UserIcon,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Users as UsersIcon,
  Sliders,
  CheckCircle,
  XCircle,
  HelpCircle,
  Edit2,
  Trash2,
  Key,
  Clock,
  Calendar,
  Eye
} from 'lucide-react';
import { formatTime12 } from '../components/TimeInput12';
import { ResponsiveSelect } from '../components/ResponsiveSelect';

interface User {
  id: string;
  name?: string;
  phone?: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  employeeId?: string | null;
  employeeCode?: string | null;
  shiftId?: string | null;
  shift?: {
    id: string;
    name: string;
    code?: string | null;
    startTime: string;
    endTime: string;
    isNightShift?: boolean;
    isDefaultInherited?: boolean;
    isExpiredFallback?: boolean;
  } | null;
  shiftSchedule?: {
    shiftId?: string | null;
    durationType: 'PERMANENT' | '1_WEEK' | '2_WEEKS' | '1_MONTH' | 'CUSTOM';
    startDate: string;
    endDate: string | null;
    notes?: string;
  } | null;
  shiftDaysRemaining?: number | null;
  isShiftExpired?: boolean;
  shiftStatusText?: string;
}

interface ShiftOption {
  id: string;
  name: string;
  code?: string | null;
  startTime: string;
  endTime: string;
  isDefault?: boolean;
  isNightShift?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

const permissionCategories = [
  {
    title: 'User Management',
    perms: ['USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_DISABLE']
  },
  {
    title: 'Roles & Access Control',
    perms: ['ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE']
  },
  {
    title: 'Financial Accounts',
    perms: ['ACCOUNT_VIEW', 'ACCOUNT_CREATE', 'ACCOUNT_UPDATE']
  },
  {
    title: 'Company Settings & Details',
    perms: ['COMPANY_VIEW', 'COMPANY_UPDATE']
  },
  {
    title: 'Office Expenses & Claims',
    perms: ['EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE']
  },
  {
    title: 'Staff Advances',
    perms: ['ADVANCE_VIEW', 'ADVANCE_CREATE', 'ADVANCE_APPROVE']
  },
  {
    title: 'Company Payments',
    perms: ['PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_APPROVE']
  },
  {
    title: 'Statutory Payroll & Slips',
    perms: ['SALARY_VIEW', 'SALARY_CREATE', 'SALARY_APPROVE']
  },
  {
    title: 'Business Loans',
    perms: ['LOAN_VIEW', 'LOAN_CREATE', 'LOAN_APPROVE']
  },
  {
    title: 'Reports & Analytics & Audit',
    perms: ['REPORT_VIEW']
  }
];



    export const Users: React.FC = () => {
      const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
      const [users, setUsers] = useState<User[]>([]);
      const [roles, setRoles] = useState<Role[]>([]);
      const [permissions, setPermissions] = useState<Permission[]>([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');

      // Search and filters
      const [searchQuery, setSearchQuery] = useState('');
      const [usersPage, setUsersPage] = useState(1);
      const usersPerPage = 10;

      // Shifts state
      const [shifts, setShifts] = useState<ShiftOption[]>([]);
      const [newUserShiftId, setNewUserShiftId] = useState('');
      const [editUserShiftId, setEditUserShiftId] = useState('');

      // Add user modal state
      const [showAddModal, setShowAddModal] = useState(false);
      const [newUserName, setNewUserName] = useState('');
      const [newUserPhone, setNewUserPhone] = useState('');
      const [newUserEmail, setNewUserEmail] = useState('');
      const [newUserPassword, setNewUserPassword] = useState('');
      const [newUserRole, setNewUserRole] = useState('');
      const [newUserEmpCode, setNewUserEmpCode] = useState('');
      const [autoGenerateCode, setAutoGenerateCode] = useState(true);
      const [formLoading, setFormLoading] = useState(false);
      const [formError, setFormError] = useState('');

      // Edit user modal state
      const [showEditUserModal, setShowEditUserModal] = useState(false);
      const [editUserFormId, setEditUserFormId] = useState<string | null>(null);
      const [editUserName, setEditUserName] = useState('');
      const [editUserPhone, setEditUserPhone] = useState('');
      const [editUserEmail, setEditUserEmail] = useState('');
      const [editUserEmpCode, setEditUserEmpCode] = useState('');
      const [editUserLoading, setEditUserLoading] = useState(false);
      const [editUserError, setEditUserError] = useState('');

      // Add role modal state
      const [showAddRoleModal, setShowAddRoleModal] = useState(false);
      const [newRoleName, setNewRoleName] = useState('');
      const [newRoleDescription, setNewRoleDescription] = useState('');
      const [addRoleSaving, setAddRoleSaving] = useState(false);
      const [addRoleError, setAddRoleError] = useState('');

      // Edit Role Modal State
      const [showEditRoleModal, setShowEditRoleModal] = useState(false);
      const [editRoleId, setEditRoleId] = useState<string | null>(null);
      const [editRoleName, setEditRoleName] = useState('');
      const [editRoleDescription, setEditRoleDescription] = useState('');
      const [editRoleSaving, setEditRoleSaving] = useState(false);
      const [editRoleError, setEditRoleError] = useState('');

      // Edit user role inline state
      const [editingUserId, setEditingUserId] = useState<string | null>(null);
      const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

      // Selected Role & Permissions state
      const [selectedRoleName, setSelectedRoleName] = useState<string>('ADMIN');
      const [rolePermissions, setRolePermissions] = useState<string[]>([]);
      const [permSaving, setPermSaving] = useState(false);
      const [permMessage, setPermMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

      // Current logged in user context
      const currentUserString = localStorage.getItem('user');
      const currentUser = currentUserString ? JSON.parse(currentUserString) : null;
      const isSuperAdmin = currentUser && currentUser.role === 'SUPER_ADMIN';
      const canManageUsers = isSuperAdmin || (currentUser && currentUser.role === 'ADMIN');

      // Extra Permissions & Shift Roster modal state
      const [showExtraPermsModal, setShowExtraPermsModal] = useState(false);
      const [extraPermsTargetUser, setExtraPermsTargetUser] = useState<User | null>(null);
      const [extraPermsLoading, setExtraPermsLoading] = useState(false);
      const [extraPermsSaving, setExtraPermsSaving] = useState(false);
      const [extraPermsSelected, setExtraPermsSelected] = useState<string[]>([]);
      const [extraPermsMessage, setExtraPermsMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
      const [extraPermsShifts, setExtraPermsShifts] = useState<ShiftOption[]>([]);
      const [extraPermsSelectedShiftId, setExtraPermsSelectedShiftId] = useState<string>('');
      const [extraPermsDurationType, setExtraPermsDurationType] = useState<'PERMANENT' | '1_WEEK' | '2_WEEKS' | '1_MONTH' | 'CUSTOM'>('PERMANENT');
      const [extraPermsStartDate, setExtraPermsStartDate] = useState<string>('');
      const [extraPermsEndDate, setExtraPermsEndDate] = useState<string>('');
      const [extraPermsDaysRemaining, setExtraPermsDaysRemaining] = useState<number | null>(null);
      const [extraPermsIsExpired, setExtraPermsIsExpired] = useState<boolean>(false);

      // Reset Password modal state
      const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
      const [resetPasswordTargetUser, setResetPasswordTargetUser] = useState<User | null>(null);
      const [resetNewPassword, setResetNewPassword] = useState('');
      const [resetConfirmPassword, setResetConfirmPassword] = useState('');
      const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
      const [resetPasswordError, setResetPasswordError] = useState('');
      const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');

      const hasPermission = (perms: string[]) => {
        if (isSuperAdmin) return true;
        return perms.some((p) => currentUser?.permissions?.includes(p));
      };

      const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
          // Always fetch users
          const usersRes = await api.get('/users');
          setUsers(usersRes.data.data);

          // Fetch company shifts
          try {
            const shiftsRes = await api.get('/attendance/shifts');
            if (shiftsRes.data?.status === 'success' && shiftsRes.data.data) {
              setShifts(shiftsRes.data.data);
              const def = shiftsRes.data.data.find((s: ShiftOption) => s.isDefault);
              if (def) {
                setNewUserShiftId((prev) => prev || def.id);
              }
            }
          } catch {
            // Shifts not accessible - ignore
          }

          // Fetch roles and permissions separately - these require ROLE_VIEW
          try {
            const [rolesRes, permsRes] = await Promise.all([
              api.get('/users/roles'),
              api.get('/users/permissions')
            ]);
            setRoles(rolesRes.data.data);
            setPermissions(permsRes.data.data);

            // Set initial checked permissions for the selected role
            const initialRole = rolesRes.data.data.find((r: Role) => r.name === selectedRoleName);
            if (initialRole) {
              setRolePermissions(initialRole.permissions);
            }
          } catch {
            // Roles/permissions not accessible - that's ok for non-admin users
          }
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to retrieve directory data.');
        } finally {
          setLoading(false);
        }
      };

      useEffect(() => {
        fetchData();
      }, []);

      // Auto-refresh users/employees every 30s
      useAutoRefresh(fetchData, 30000);

      // ── Extra Permissions Handlers ────────────────────────────────────────────
      const openExtraPermsModal = async (user: User) => {
        setExtraPermsTargetUser(user);
        setExtraPermsMessage(null);
        setShowExtraPermsModal(true);
        setExtraPermsLoading(true);

        const todayStr = new Date().toISOString().split('T')[0];
        setExtraPermsStartDate(todayStr);

        try {
          // Load extra permissions, company shifts and active roster schedule
          const extraRes = await api.get(`/users/${user.id}/extra-permissions`);
          const data = extraRes.data?.data || {};

          setExtraPermsSelected(data.extraPermissions || []);
          setExtraPermsShifts(data.shifts || shifts || []);
          setExtraPermsSelectedShiftId(data.shiftId || '');

          if (data.shiftSchedule) {
            setExtraPermsDurationType(data.shiftSchedule.durationType || 'PERMANENT');
            setExtraPermsStartDate(data.shiftSchedule.startDate || todayStr);
            setExtraPermsEndDate(data.shiftSchedule.endDate || '');
          } else if (data.shiftId) {
            setExtraPermsDurationType('PERMANENT');
            setExtraPermsStartDate(todayStr);
            setExtraPermsEndDate('');
          } else {
            setExtraPermsDurationType('PERMANENT');
            setExtraPermsStartDate(todayStr);
            setExtraPermsEndDate('');
          }

          setExtraPermsDaysRemaining(data.shiftDaysRemaining ?? null);
          setExtraPermsIsExpired(data.isShiftExpired ?? false);

          // Set the role permissions to the target user's role so "Inherited from Role" is accurate
          const userRole = roles.find((r) => r.name === user.role);
          if (userRole) {
            setRolePermissions(userRole.permissions);
          } else {
            setRolePermissions([]);
          }
        } catch {
          setExtraPermsSelected([]);
          setRolePermissions([]);
          setExtraPermsSelectedShiftId(user.shiftId || '');
          setExtraPermsDurationType('PERMANENT');
        } finally {
          setExtraPermsLoading(false);
        }
      };

      const handleDurationChange = (type: 'PERMANENT' | '1_WEEK' | '2_WEEKS' | '1_MONTH' | 'CUSTOM') => {
        setExtraPermsDurationType(type);
        const start = new Date();
        const startStr = start.toISOString().split('T')[0];
        setExtraPermsStartDate(startStr);

        if (type === '1_WEEK') {
          const end = new Date();
          end.setDate(end.getDate() + 7);
          setExtraPermsEndDate(end.toISOString().split('T')[0]);
        } else if (type === '2_WEEKS') {
          const end = new Date();
          end.setDate(end.getDate() + 14);
          setExtraPermsEndDate(end.toISOString().split('T')[0]);
        } else if (type === '1_MONTH') {
          const end = new Date();
          end.setDate(end.getDate() + 30);
          setExtraPermsEndDate(end.toISOString().split('T')[0]);
        } else if (type === 'PERMANENT') {
          setExtraPermsEndDate('');
        }
      };

      const toggleExtraPerm = (permName: string) => {
        setExtraPermsSelected((prev) =>
          prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
        );
      };

      const handleSaveExtraPerms = async () => {
        if (!extraPermsTargetUser) return;
        setExtraPermsSaving(true);
        setExtraPermsMessage(null);
        try {
          const payload = {
            permissions: extraPermsSelected,
            shiftId: extraPermsSelectedShiftId || null,
            shiftSchedule: {
              durationType: extraPermsDurationType,
              startDate: extraPermsStartDate || new Date().toISOString().split('T')[0],
              endDate: extraPermsDurationType === 'PERMANENT' ? null : (extraPermsEndDate || null),
            },
          };

          await api.put(`/users/${extraPermsTargetUser.id}/extra-permissions`, payload);

          // Update header and local storage
          window.dispatchEvent(new Event('shift-schedule-updated'));
          fetchData();

          try {
            const meRes = await api.get('/auth/me');
            if (meRes.data?.success && meRes.data?.data?.user) {
              localStorage.setItem('user', JSON.stringify(meRes.data.data.user));
              window.dispatchEvent(new Event('user-permissions-updated'));
            }
          } catch {
            // Silently ignore
          }

          setExtraPermsMessage({ text: 'Shift roster & permissions saved successfully! Changes are active.', type: 'success' });
        } catch (err: any) {
          setExtraPermsMessage({ text: err.response?.data?.message || 'Failed to save changes.', type: 'error' });
        } finally {
          setExtraPermsSaving(false);
        }
      };

      // Update permission checkboxes when selected role changes
      useEffect(() => {
        const roleObj = roles.find((r) => r.name === selectedRoleName);
        if (roleObj) {
          setRolePermissions(roleObj.permissions);
        }
      }, [selectedRoleName, roles]);

      const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetPasswordError('');
        setResetPasswordSuccess('');

        if (!resetPasswordTargetUser) return;

        if (resetNewPassword.length < 6) {
          setResetPasswordError('Password must be at least 6 characters long.');
          return;
        }

        if (resetNewPassword !== resetConfirmPassword) {
          setResetPasswordError('Passwords do not match.');
          return;
        }

        setResetPasswordLoading(true);
        try {
          const res = await api.post(`/users/${resetPasswordTargetUser.id}/reset-password`, {
            newPassword: resetNewPassword,
          });

          if (res.data?.success || res.data?.status === 'success') {
            setResetPasswordSuccess('Password reset successfully!');
            setResetNewPassword('');
            setResetConfirmPassword('');
            setTimeout(() => {
              setShowResetPasswordModal(false);
              setResetPasswordTargetUser(null);
            }, 2000);
          }
        } catch (err: any) {
          setResetPasswordError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
          setResetPasswordLoading(false);
        }
      };

      const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormLoading(true);

        try {
          await api.post('/users', {
            name: newUserName,
            phone: newUserPhone,
            email: newUserEmail,
            password: newUserPassword,
            roleName: newUserRole,
            employeeCode: autoGenerateCode ? undefined : newUserEmpCode,
            autoGenerateCode,
            shiftId: newUserShiftId || undefined,
          });

          setShowAddModal(false);
          setNewUserName('');
          setNewUserPhone('');
          setNewUserEmail('');
          setNewUserPassword('');
          setNewUserRole('');
          setNewUserEmpCode('');
          setAutoGenerateCode(true);
          const def = shifts.find((s) => s.isDefault);
          setNewUserShiftId(def ? def.id : '');
          fetchData();
        } catch (err: any) {
          setFormError(err.response?.data?.message || 'Failed to create user account.');
        } finally {
          setFormLoading(false);
        }
      };

      const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditUserError('');
        setEditUserLoading(true);

        try {
          await api.patch(`/users/${editUserFormId}`, {
            name: editUserName,
            phone: editUserPhone,
            email: editUserEmail,
            employeeCode: editUserEmpCode,
            shiftId: editUserShiftId || null,
          });

          setShowEditUserModal(false);
          fetchData();
        } catch (err: any) {
          setEditUserError(err.response?.data?.message || 'Failed to update user account.');
        } finally {
          setEditUserLoading(false);
        }
      };

      const handleAddRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddRoleSaving(true);
        setAddRoleError('');
        try {
          const response = await api.post('/users/roles', {
            name: newRoleName,
            description: newRoleDescription,
          });
          
          const createdRole = response.data.data;
          
          await fetchData();

          setSelectedRoleName(createdRole.name);
          setRolePermissions([]);

          setShowAddRoleModal(false);
          setNewRoleName('');
          setNewRoleDescription('');
        } catch (err: any) {
          setAddRoleError(err.response?.data?.message || 'Failed to create role.');
        } finally {
          setAddRoleSaving(false);
        }
      };

      const openEditRoleModal = (role: Role) => {
        setEditRoleId(role.id);
        setEditRoleName(role.name);
        setEditRoleDescription(role.description || '');
        setEditRoleError('');
        setShowEditRoleModal(true);
      };

      const handleEditRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditRoleError('');
        setEditRoleSaving(true);
        try {
          await api.put(`/users/roles/${editRoleId}`, {
            name: editRoleName,
            description: editRoleDescription,
          });
          setShowEditRoleModal(false);
          fetchData(); // Refresh roles list
          if (selectedRoleName === editRoleName) {
            setSelectedRoleName(editRoleName.toUpperCase().trim().replace(/\s+/g, '_')); // Update if selected
          }
        } catch (err: any) {
          setEditRoleError(err.response?.data?.message || 'Failed to update role.');
        } finally {
          setEditRoleSaving(false);
        }
      };

      const handleDeleteRole = async (roleId: string, roleName: string) => {
        if (!window.confirm(`Are you sure you want to delete the role "${roleName}"? This action cannot be undone.`)) return;
        try {
          await api.delete(`/users/roles/${roleId}`);
          if (selectedRoleName === roleName) {
            setSelectedRoleName('ADMIN'); // Reset to default
          }
          fetchData();
        } catch (err: any) {
          alert(err.response?.data?.message || 'Failed to delete role.');
        }
      };

      const handleToggleStatus = async (userToUpdate: User) => {
        if (currentUser && currentUser.id === userToUpdate.id) {
          alert('You cannot deactivate your own account.');
          return;
        }

        const nextStatus = userToUpdate.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
          await api.patch(`/users/${userToUpdate.id}/status`, { status: nextStatus });
          setUsers(prev => prev.map(u => u.id === userToUpdate.id ? { ...u, status: nextStatus } : u));
        } catch (err: any) {
          alert(err.response?.data?.message || 'Failed to update user status.');
        }
      };

      const handleSaveUserRole = async (userId: string, newRole: string) => {
        setUpdatingRoleId(userId);
        try {
          await api.patch(`/users/${userId}/roles`, { roleName: newRole });
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
          setEditingUserId(null);
        } catch (err: any) {
          alert(err.response?.data?.message || 'Failed to update user role.');
        } finally {
          setUpdatingRoleId(null);
        }
      };

      const handleDeleteUser = async (id: string, email: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete user ${email}? This action is irreversible, but their financial and audit history will be preserved.`)) {
          return;
        }
        
        try {
          await api.delete(`/users/${id}`);
          alert('User deleted successfully.');
          // Remove from state
          setUsers(prev => prev.filter(u => u.id !== id));
        } catch (err: any) {
          alert(err.response?.data?.message || 'Failed to delete user.');
        }
      };

      const handlePermissionToggle = (permName: string) => {
        if (selectedRoleName === 'SUPER_ADMIN') {
          // Prompt warning or prevent editing SUPER_ADMIN entirely to prevent lockdown
          if (!window.confirm('WARNING: Modifying SUPER_ADMIN permissions can block system management access. Do you want to proceed?')) {
            return;
          }
        }
        setRolePermissions((prev) =>
          prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
        );
      };

      const handleSaveRolePermissions = async () => {
        setPermSaving(true);
        setPermMessage(null);
        try {
          await api.put(`/users/roles/${selectedRoleName}/permissions`, {
            permissionNames: rolePermissions
          });
          
          // Update local roles state
          setRoles(prev => prev.map(r => r.name === selectedRoleName ? { ...r, permissions: rolePermissions } : r));

          setPermMessage({
            text: `Permissions for role ${selectedRoleName} updated successfully. Users will need to re-login or refresh to apply changes.`,
            type: 'success'
          });
        } catch (err: any) {
          setPermMessage({
            text: err.response?.data?.message || 'Failed to update role permissions.',
            type: 'error'
          });
        } finally {
          setPermSaving(false);
        }
      };

      // Filter users based on query
      const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Reset page when search changes
      useEffect(() => { setUsersPage(1); }, [searchQuery]);

      const usersTotalPages = Math.ceil(filteredUsers.length / usersPerPage);
      const usersIndexFirst = (usersPage - 1) * usersPerPage;
      const usersIndexLast = usersIndexFirst + usersPerPage;
      const currentUsers = filteredUsers.slice(usersIndexFirst, usersIndexLast);

      // Group permissions dynamically
      const getCategorizedPerms = () => {
        const categorized: Record<string, Permission[]> = {};
        const unmapped: Permission[] = [];

        // Initialize categories
        permissionCategories.forEach(cat => {
          categorized[cat.title] = [];
        });

        permissions.forEach(perm => {
          let mapped = false;
          for (const cat of permissionCategories) {
            if (cat.perms.includes(perm.name)) {
              categorized[cat.title].push(perm);
              mapped = true;
              break;
            }
          }
          if (!mapped) {
            unmapped.push(perm);
          }
        });

        if (unmapped.length > 0) {
          categorized['General & Miscellaneous'] = unmapped;
        }

        return categorized;
      };

      const categorizedPermissions = getCategorizedPerms();

      return (
        <div className="space-y-8 animate-fade-in text-gray-200">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <UsersIcon className="w-8 h-8 text-indigo-400" />
                User & Access Management
              </h1>
              <p className="text-gray-400 mt-1.5 text-sm">
                Configure system operator accounts, activate/deactivate access, and custom-tailor permission roles.
              </p>
            </div>

            {/* Tab Controls - Responsive Pill Bar */}
            <div className="w-full flex items-center p-1 sm:p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Users Directory</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('permissions')}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'permissions'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Roles & Permissions</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Tab 1: Users Directory */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Action bar */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search user emails or roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white/5 border border-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-all text-xs sm:text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    title="Refresh Directory"
                  >
                    <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
                  </button>

                  {hasPermission(['USER_CREATE']) && (
                    <button
                      onClick={() => {
                        setNewUserRole(roles.length > 0 ? roles[0].name : '');
                        setShowAddModal(true);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add User Account</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Directory Table Card */}
              <div className="glass-panel border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="min-w-[700px] sm:min-w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0e1420]/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">User Operator</th>
                        <th className="px-6 py-4">Assigned Shift</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Access Role</th>
                        <th className="px-6 py-4">Registration Date</th>
                        {isSuperAdmin && <th className="px-6 py-4 text-right whitespace-nowrap actions-cell">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {loading && users.length === 0 ? (
                        <tr>
                          <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                            Loading users...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                            No user accounts found.
                          </td>
                        </tr>
                      ) : (
                        currentUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-semibold text-white block">{user.name || user.email}</span>
                                  {user.employeeCode ? (
                                    <span className="text-emerald-400 text-[10px] font-mono font-bold block">Emp Code: {user.employeeCode}</span>
                                  ) : (
                                    <span className="text-gray-500 text-[10px] font-mono block">ID: {user.id.substring(0, 8)}</span>
                                  )}
                                  {user.name && <span className="text-gray-500 text-[10px] block">{user.email}</span>}
                                  {user.phone && <span className="text-gray-500 text-[10px] block">📞 {user.phone}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {user.shift ? (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                  user.shift.isNightShift
                                    ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  <span>{user.shift.name} ({formatTime12(user.shift.startTime)} - {formatTime12(user.shift.endTime)})</span>
                                  {user.shift.isDefaultInherited && (
                                    <span className="text-[10px] text-slate-500 font-bold bg-slate-200/80 px-1 py-0.2 rounded">Default</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-xs italic">Default (Company)</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={currentUser && currentUser.id === user.id}
                                title={currentUser && currentUser.id === user.id ? "You cannot deactivate your own account" : `Click to ${user.status === 'ACTIVE' ? 'deactivate' : 'activate'} this user`}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                  currentUser && currentUser.id === user.id
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'cursor-pointer hover:scale-105 active:scale-95'
                                } ${
                                  user.status === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {user.status}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              {editingUserId === user.id ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    defaultValue={user.role}
                                    onChange={(e) => handleSaveUserRole(user.id, e.target.value)}
                                    disabled={updatingRoleId === user.id}
                                    className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  >
                                    {roles.map((r) => (
                                      <option key={r.id} value={r.name}>
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="p-1 rounded bg-white/5 border border-white/5 hover:text-white text-gray-400"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                                  <Shield className="w-4 h-4 text-indigo-400" />
                                  {user.role}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-gray-400 text-xs font-medium whitespace-nowrap">
                              {new Date(user.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            {isSuperAdmin && (
                              <td className="px-6 py-4 text-right whitespace-nowrap actions-cell">
                                <div className="flex justify-end gap-2 min-w-max ml-auto">
                                  <button
                                    onClick={() => {
                                      setEditUserFormId(user.id);
                                      setEditUserName(user.name || '');
                                      setEditUserPhone(user.phone || '');
                                      setEditUserEmail(user.email || '');
                                      setEditUserEmpCode(user.employeeCode || '');
                                      setEditUserShiftId(user.shiftId || '');
                                      setShowEditUserModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer transition-all"
                                  >
                                    Edit Info
                                  </button>
                                  {editingUserId !== user.id && (
                                    <button
                                      onClick={() => setEditingUserId(user.id)}
                                      className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 text-xs font-semibold cursor-pointer transition-all"
                                    >
                                      Change Role
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openExtraPermsModal(user)}
                                    className="px-3 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/15 text-violet-400 hover:text-violet-300 text-xs font-semibold cursor-pointer transition-all"
                                    title="Grant extra individual permissions to this user"
                                  >
                                    Extra Perms
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      setResetPasswordTargetUser(user);
                                      setResetPasswordError('');
                                      setResetPasswordSuccess('');
                                      setResetNewPassword('');
                                      setResetConfirmPassword('');
                                      setShowResetPasswordModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 text-xs font-semibold cursor-pointer transition-all"
                                    title="Reset Password"
                                  >
                                    <Key className="w-3.5 h-3.5 inline mr-1" />
                                    Reset PW
                                  </button>

                                  {currentUser && currentUser.id !== user.id && (
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.email)}
                                      className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold cursor-pointer transition-all"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody></table>

                  {/* Pagination Controls */}
                  {filteredUsers.length > 0 && (
                    <div className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-xs text-gray-400 font-medium">
                        Showing <span className="font-bold text-white">{usersIndexFirst + 1}</span> to{' '}
                        <span className="font-bold text-white">{Math.min(usersIndexLast, filteredUsers.length)}</span>{' '}
                        of <span className="font-bold text-white">{filteredUsers.length}</span> users
                      </div>

                      {usersTotalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setUsersPage((p) => Math.max(p - 1, 1))}
                            disabled={usersPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent"
                          >
                            Previous
                          </button>

                          {Array.from({ length: usersTotalPages }, (_, i) => i + 1).map((pageNum) => {
                            const isEdge = pageNum === 1 || pageNum === usersTotalPages;
                            const isNear = Math.abs(pageNum - usersPage) <= 1;
                            if (isEdge || isNear) {
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => setUsersPage(pageNum)}
                                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    usersPage === pageNum
                                      ? 'bg-indigo-600 text-white shadow-md border-none'
                                      : 'border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white bg-transparent'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            }
                            if (
                              (pageNum === 2 && usersPage > 3) ||
                              (pageNum === usersTotalPages - 1 && usersPage < usersTotalPages - 2)
                            ) {
                              return <span key={pageNum} className="px-1 text-gray-500 text-xs font-semibold">...</span>;
                            }
                            return null;
                          })}

                          <button
                            onClick={() => setUsersPage((p) => Math.min(p + 1, usersTotalPages))}
                            disabled={usersPage === usersTotalPages}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Roles & Permissions Matrix */}
          {activeTab === 'permissions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Side Menu: Roles List */}
              <div className="lg:col-span-4 space-y-4">
                <div className="glass-panel border border-white/5 rounded-2xl p-5 shadow-2xl space-y-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    Select System Role
                  </h2>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Choose a role to configure its access permissions. Changes will take effect on next login.
                  </p>

                  {hasPermission(['ROLE_CREATE']) && (
                    <button
                      onClick={() => setShowAddRoleModal(true)}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Custom Role
                    </button>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {roles.map((role) => {
                      const isSystemRole = ['SUPER_ADMIN'].includes(role.name);
                      return (
                        <div
                          key={role.id}
                          className={`w-full text-left p-2.5 sm:px-4 sm:py-3 rounded-xl border transition-all flex flex-col justify-between relative group ${
                            selectedRoleName === role.name
                              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-emerald-500 text-emerald-300 font-semibold shadow-inner'
                              : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSelectedRoleName(role.name);
                              setPermMessage(null);
                            }}
                            className="w-full text-left cursor-pointer outline-none"
                          >
                            <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5 truncate">
                              <Shield className={`w-3.5 h-3.5 shrink-0 ${selectedRoleName === role.name ? 'text-emerald-400' : 'text-gray-500'}`} />
                              <span className="truncate">{role.name}</span>
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-gray-500 font-medium line-clamp-1 mt-0.5 block">
                              {role.description || `Role: ${role.name}`}
                            </span>
                          </button>

                          {/* Edit/Delete Actions for Custom Roles */}
                          {!isSystemRole && isSuperAdmin && (
                            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditRoleModal(role)}
                                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                title="Edit Role"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role.id, role.name)}
                                className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Delete Role"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                </div>

              {/* Matrix Panel: Permission Categories */}
              <div className="lg:col-span-8 space-y-6">
                <div className="glass-panel border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                        Permissions Config: {selectedRoleName}
                      </h2>
                      <p className="text-xs text-gray-400 mt-1">
                        Check or uncheck individual items to toggle capabilities for role.
                      </p>
                    </div>

                    {hasPermission(['ROLE_UPDATE']) && selectedRoleName !== currentUser?.role ? (
                      <button
                        onClick={handleSaveRolePermissions}
                        disabled={permSaving}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        {permSaving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Save Permissions
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 italic px-4 py-2.5 border border-white/5 rounded-xl bg-white/5 text-center sm:text-left">
                        {selectedRoleName === currentUser?.role ? 'Self-Modification Restricted' : 'Read-Only Mode'}
                      </span>
                    )}
                  </div>

                  {permMessage && (
                    <div
                      className={`p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 sm:gap-3 ${
                        permMessage.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}
                    >
                      {permMessage.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      )}
                      <p>{permMessage.text}</p>
                    </div>
                  )}

                  {/* Scrollable permissions listing - 2 of 2 pair on mobile */}
                  <div className="space-y-4 sm:space-y-6 max-h-[500px] overflow-y-auto pr-1 sm:pr-2 no-scrollbar">
                    {Object.entries(categorizedPermissions).map(([categoryName, perms]) => (
                      <div key={categoryName} className="space-y-2 sm:space-y-3">
                        <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-emerald-500/15 pb-1">
                          {categoryName}
                        </h3>

                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className={`flex items-start gap-1.5 sm:gap-2.5 p-2 sm:p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5 select-none ${
                                rolePermissions.includes(perm.name)
                                  ? 'border-emerald-500/35 bg-emerald-500/10'
                                  : 'border-white/5 bg-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={rolePermissions.includes(perm.name)}
                                disabled={!hasPermission(['ROLE_UPDATE']) || selectedRoleName === currentUser?.role}
                                onChange={() => handlePermissionToggle(perm.name)}
                                className="mt-0.5 rounded border-white/10 text-emerald-600 bg-slate-800 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4"
                              />
                              <div className="min-w-0">
                                <span className="text-[11px] sm:text-sm font-semibold text-white block truncate" title={perm.name}>
                                  {perm.name}
                                </span>
                                <span className="text-[9px] sm:text-xs text-gray-400 mt-0.5 block line-clamp-1 sm:line-clamp-2 leading-tight">
                                  {perm.description || 'No explanation provided.'}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Extra Permissions Modal */}
        {showExtraPermsModal && extraPermsTargetUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">User Details & Shift Configuration</h3>
                    <p className="text-xs text-gray-400">
                      Managing profile exceptions and duty shift for <strong className="text-white">{extraPermsTargetUser.name || extraPermsTargetUser.email}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExtraPermsModal(false)}
                  className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* ── User Overview Summary Card ── */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-base shrink-0">
                      {(extraPermsTargetUser.name || extraPermsTargetUser.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base leading-tight">
                        {extraPermsTargetUser.name || extraPermsTargetUser.email}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                        {extraPermsTargetUser.employeeCode && (
                          <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Emp Code: {extraPermsTargetUser.employeeCode}
                          </span>
                        )}
                        <span>{extraPermsTargetUser.email}</span>
                        {extraPermsTargetUser.phone && <span>• 📞 {extraPermsTargetUser.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                      {extraPermsTargetUser.role}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      extraPermsTargetUser.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {extraPermsTargetUser.status}
                    </span>
                  </div>
                </div>

                {extraPermsMessage && (
                  <div
                    className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-3 ${
                      extraPermsMessage.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    {extraPermsMessage.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0" />
                    )}
                    <p>{extraPermsMessage.text}</p>
                  </div>
                )}

                {extraPermsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mb-3" />
                    <span className="text-sm text-gray-400">Loading current configuration...</span>
                  </div>
                ) : (
                  <>
                    {/* ── Shift & Roster Scheduling Module ── */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 border border-violet-500/20 space-y-4">
                      <div className="flex items-center justify-between border-b border-violet-500/15 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide">Shift & Roster Scheduling</h4>
                            <p className="text-xs text-gray-400">
                              Assign or rotate duty shift for 1 week, 2 weeks, 1 month, or custom period
                            </p>
                          </div>
                        </div>
                        {extraPermsIsExpired && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                            Previous Schedule Expired
                          </span>
                        )}
                      </div>

                      {/* 1. Shift Selector */}
                      <div>
                        <label className="block text-xs font-bold text-violet-300 uppercase tracking-wider mb-2">
                          Select Assigned Shift
                        </label>
                        <select
                          value={extraPermsSelectedShiftId}
                          onChange={(e) => setExtraPermsSelectedShiftId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-[#0e1422] border border-white/10 text-white text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all cursor-pointer"
                        >
                          <option value="">-- Company Default Shift --</option>
                          {(extraPermsShifts.length > 0 ? extraPermsShifts : shifts).map((s) => (
                            <option key={`modal-shift-${s.id}`} value={s.id}>
                              {s.name} ({formatTime12(s.startTime)} - {formatTime12(s.endTime)}) {s.isDefault ? '★ Default' : ''} {s.isNightShift ? '🌙 Night' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Duration / Period Pills */}
                      <div>
                        <label className="block text-xs font-bold text-violet-300 uppercase tracking-wider mb-2">
                          Schedule Duration (Roster Duration)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {[
                            { id: '1_WEEK', label: '1 Week', sub: '7 Days' },
                            { id: '2_WEEKS', label: '2 Weeks', sub: '14 Days' },
                            { id: '1_MONTH', label: '1 Month', sub: '30 Days' },
                            { id: 'PERMANENT', label: 'Permanent', sub: 'Ongoing' },
                            { id: 'CUSTOM', label: 'Custom', sub: 'Pick Dates' },
                          ].map((item) => {
                            const isSelected = extraPermsDurationType === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleDurationChange(item.id as any)}
                                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30 font-bold'
                                    : 'bg-[#0e1422]/70 text-gray-300 border-white/10 hover:border-violet-500/40 hover:bg-white/5'
                                }`}
                              >
                                <span className="block text-xs font-bold">{item.label}</span>
                                <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-violet-100' : 'text-gray-400'}`}>
                                  {item.sub}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Date Range Controls */}
                      {extraPermsDurationType !== 'PERMANENT' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                              Effective From (Start Date)
                            </label>
                            <input
                              type="date"
                              value={extraPermsStartDate}
                              onChange={(e) => setExtraPermsStartDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-[#0e1422] border border-white/10 text-white text-xs focus:border-violet-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                              Valid Until (End Date)
                            </label>
                            <input
                              type="date"
                              value={extraPermsEndDate}
                              onChange={(e) => setExtraPermsEndDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-[#0e1422] border border-white/10 text-white text-xs focus:border-violet-500 outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* 4. Active Schedule Summary Preview */}
                      {(() => {
                        const chosenShift = (extraPermsShifts.length > 0 ? extraPermsShifts : shifts).find(
                          (s) => s.id === extraPermsSelectedShiftId
                        ) || shifts.find((s) => s.isDefault);
                        
                        return (
                          <div className="p-3 rounded-xl bg-[#0e1422]/90 border border-violet-500/20 text-xs flex items-start gap-2.5">
                            <Calendar className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <span className="text-gray-300">Assignment Summary: </span>
                              <strong className="text-white">
                                {chosenShift ? chosenShift.name : 'Company Default Shift'}
                              </strong>
                              {chosenShift && (
                                <span className="text-violet-300 ml-1">
                                  ({formatTime12(chosenShift.startTime)} - {formatTime12(chosenShift.endTime)})
                                </span>
                              )}
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {extraPermsDurationType === 'PERMANENT' ? (
                                  <span className="text-emerald-400 font-semibold">● Ongoing / Permanent Assignment (Active until changed)</span>
                                ) : extraPermsStartDate && extraPermsEndDate ? (
                                  <span>
                                    Active from <strong className="text-white">{new Date(extraPermsStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> to <strong className="text-white">{new Date(extraPermsEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                                    {extraPermsDaysRemaining !== null && extraPermsDaysRemaining > 0 && (
                                      <span className="ml-1 text-violet-400 font-bold">({extraPermsDaysRemaining} days remaining)</span>
                                    )}
                                  </span>
                                ) : (
                                  <span>Select start and end date</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Permissions Section */}
                    {extraPermsTargetUser.role === 'SUPER_ADMIN' ? (
                      <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 border-t border-white/5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-sm">Super Admin Full Privileges</h4>
                          <p className="text-gray-400 text-xs max-w-md mx-auto mt-1 leading-relaxed">
                            This user belongs to the <strong className="text-white">SUPER_ADMIN</strong> role and inherently possesses all platform permissions (<code className="bg-white/5 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs">*</code>).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-white/5 pt-4 space-y-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Individual Permission Exceptions
                        </h4>
                        {Object.entries(categorizedPermissions).map(([categoryName, perms]) => (
                          <div key={`extra-${categoryName}`} className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-400 border-b border-violet-500/10 pb-1.5">
                              {categoryName}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {perms.map((perm) => {
                                const isBaseRolePerm = rolePermissions.includes(perm.name);
                                const isExtraPerm = extraPermsSelected.includes(perm.name);

                                return (
                                  <label
                                    key={`ext-${perm.id}`}
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                      isBaseRolePerm
                                        ? 'border-indigo-500/20 bg-indigo-500/5 opacity-60'
                                        : isExtraPerm
                                        ? 'border-violet-500/30 bg-violet-500/10'
                                        : 'border-white/5 bg-transparent hover:bg-white/5'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isBaseRolePerm || isExtraPerm}
                                      disabled={isBaseRolePerm}
                                      onChange={() => {
                                        if (!isBaseRolePerm) {
                                          toggleExtraPerm(perm.name);
                                        }
                                      }}
                                      className="mt-0.5 rounded border-white/10 text-violet-600 bg-slate-800 focus:ring-violet-500 focus:ring-offset-slate-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <div>
                                      <span className="text-sm font-semibold text-white block">
                                        {perm.name}
                                      </span>
                                      {isBaseRolePerm && (
                                        <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider block mt-0.5">
                                          Inherited from Role
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/5 bg-white/5 shrink-0 flex justify-end gap-3">
                <button
                  onClick={() => setShowExtraPermsModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveExtraPerms}
                  disabled={extraPermsSaving || extraPermsLoading}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-lg shadow-violet-500/20 transition-all flex items-center gap-2"
                >
                  {extraPermsSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Shift & Permissions</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl animate-zoom-in">
              <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-[var(--primary)]" />
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Create New Operator</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
                {formError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-750">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                    placeholder="operator@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Assign Role
                  </label>
                  <ResponsiveSelect
                    label="Assign Role"
                    value={newUserRole}
                    onChange={setNewUserRole}
                    options={roles.map((r) => ({ value: r.name, label: r.name }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Operational Shift (Hospitals / Multi-Shift)
                  </label>
                  <ResponsiveSelect
                    label="Operational Shift"
                    value={newUserShiftId}
                    onChange={setNewUserShiftId}
                    options={[
                      { value: '', label: '-- Company Default Shift --' },
                      ...shifts.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.startTime} - ${s.endTime})${s.isDefault ? ' ★ Default' : ''}${s.isNightShift ? ' 🌙 Night' : ''}`
                      }))
                    ]}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="autoGenerateCode"
                      checked={autoGenerateCode}
                      onChange={(e) => setAutoGenerateCode(e.target.checked)}
                      className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="autoGenerateCode" className="text-xs font-semibold text-slate-600 cursor-pointer">
                      Auto-Generate Employee Code
                    </label>
                  </div>
                </div>

                {!autoGenerateCode && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Custom Employee Code
                    </label>
                    <input
                      type="text"
                      value={newUserEmpCode}
                      onChange={(e) => setNewUserEmpCode(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                      placeholder="e.g. EMP-001"
                      required={!autoGenerateCode}
                    />
                  </div>
                )}

                <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 sm:flex sm:justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-200 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {formLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{formLoading ? 'Creating...' : 'Create Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditUserModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[var(--primary)]" />
                  <span>Edit User Details</span>
                </h3>
                <button
                  onClick={() => setShowEditUserModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
                {editUserError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-750">{editUserError}</p>
                  </div>
                )}

                <form onSubmit={handleEditUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={editUserPhone}
                      onChange={(e) => setEditUserPhone(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                      Employee Code
                    </label>
                    <input
                      type="text"
                      value={editUserEmpCode}
                      onChange={(e) => setEditUserEmpCode(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                      placeholder="e.g. EMP-001"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editUserEmail}
                      onChange={(e) => setEditUserEmail(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all"
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                      Assigned Shift (Duty Schedule)
                    </label>
                    <select
                      value={editUserShiftId}
                      onChange={(e) => setEditUserShiftId(e.target.value)}
                      className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Company Default Shift --</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.startTime} - {s.endTime}) {s.isDefault ? '★ Default' : ''} {s.isNightShift ? '🌙 Night' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowEditUserModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editUserLoading}
                      className="px-6 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {editUserLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Role Modal */}
        {showAddRoleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-zoom-in">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[var(--primary)]" />
                  <h3 className="text-lg font-bold text-slate-900">Create Custom Role</h3>
                </div>
                <button
                  onClick={() => setShowAddRoleModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRole} className="p-6 space-y-4 text-left">
                {addRoleError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-750">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{addRoleError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value.toUpperCase())}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    placeholder="e.g. DATA_ENTRY"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Will be auto-formatted to uppercase with underscores.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    placeholder="Optional description"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddRoleModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={addRoleSaving}
                    className="px-6 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                  >
                    {addRoleSaving ? 'Saving...' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {showEditRoleModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-zoom-in">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[var(--primary)]" />
                  <h3 className="text-lg font-bold text-slate-900">Edit Custom Role</h3>
                </div>
                <button
                  onClick={() => setShowEditRoleModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditRoleSubmit} className="p-6 space-y-4 text-left">
                {editRoleError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-750">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{editRoleError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value.toUpperCase())}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editRoleDescription}
                    onChange={(e) => setEditRoleDescription(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-900 text-sm outline-none"
                    placeholder="Optional description"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditRoleModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={editRoleSaving}
                    className="px-6 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold shadow-lg shadow-[var(--primary)]/15 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                  >
                    {editRoleSaving ? 'Saving...' : 'Update Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal (Super Admin use case) */}
        {showResetPasswordModal && resetPasswordTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden text-left">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-600" />
                  Reset Password: {resetPasswordTargetUser.name || resetPasswordTargetUser.email}
                </h3>
                <button
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordTargetUser(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs">
                  Changing password for: <strong className="text-slate-900 block mt-0.5">{resetPasswordTargetUser.email}</strong>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-900 text-sm outline-none"
                    placeholder="Enter new password (min 6 chars)"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-655 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-900 text-sm outline-none"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                {resetPasswordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                    {resetPasswordError}
                  </div>
                )}

                {resetPasswordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-xl text-xs font-medium">
                    {resetPasswordSuccess}
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setResetPasswordTargetUser(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={resetPasswordLoading}
                    className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                  >
                    {resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

export default Users;
