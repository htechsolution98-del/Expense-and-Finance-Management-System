import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api } from '../services/api';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  FileText,
  UserCheck,
  Building2,
  RefreshCw,
  Search,
  Sliders,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
  X,
  Trash2,
  Edit2,
  ShieldCheck,
  Briefcase
} from 'lucide-react';

interface LeaveType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isPaid: boolean;
  annualQuota: number;
  maxConsecutiveDays?: number;
  allowHalfDay: boolean;
  allowCarryForward: boolean;
  carryForwardLimit?: number;
  isActive: boolean;
}

interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
  carriedForward: number;
  leaveType?: LeaveType;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    department?: { name: string };
  };
}

interface LeaveRequest {
  id: string;
  leaveNo: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  dayType: string;
  reason: string;
  attachment?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  appliedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    department?: { name: string };
    users?: { userRoles?: { role?: { name: string } }[] }[];
  };
  leaveType?: LeaveType;
  approver?: { name: string; email: string };
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  description?: string;
  isOptional: boolean;
}

interface CustomPolicyRule {
  id: string;
  name: string;
  enabled: boolean;
}

interface LeavePolicy {
  id: string;
  name: string;
  year: number;
  workingDaysOnly: boolean;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  advanceNoticeDays: number;
  maxConsecutiveDays?: number;
  allowNegativeBalance: boolean;
  autoApprove: boolean;
  customRules?: CustomPolicyRule[];
}

export const LeaveManagement: React.FC = () => {
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { role: '', permissions: [] };
  const userRole = (user.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdminRole = userRole === 'ADMIN' || userRole.startsWith('ADMIN');
  const isAccountsRole = userRole === 'ACCOUNTS' || userRole.startsWith('ACCOUNT');

  const canApprove = isSuperAdmin ||
    isAdminRole ||
    isAccountsRole ||
    user.permissions?.includes('LEAVE_APPROVE') ||
    user.permissions?.includes('LEAVE_MANAGE');
  const canManagePolicy = isSuperAdmin || user.permissions?.includes('LEAVE_POLICY_MANAGE');

  const [activeTab, setActiveTab] = useState<'my_leaves' | 'approvals' | 'calendar' | 'balances' | 'settings' | 'holidays' | 'reports'>('my_leaves');
  const [loading, setLoading] = useState<boolean>(true);

  // Data States
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myBalances, setMyBalances] = useState<LeaveBalance[]>([]);
  const [allBalances, setAllBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);

  // Filters & Modals
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);
  const [showHolidayModal, setShowHolidayModal] = useState<boolean>(false);
  const [showApproveRejectModal, setShowApproveRejectModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'CANCEL'>('APPROVE');
  const [actionComments, setActionComments] = useState<string>('');

  // Apply Form
  const [formLeaveTypeId, setFormLeaveTypeId] = useState<string>('');
  const [formFromDate, setFormFromDate] = useState<string>('');
  const [formToDate, setFormToDate] = useState<string>('');
  const [formDayType, setFormDayType] = useState<string>('FULL_DAY');
  const [formReason, setFormReason] = useState<string>('');
  const [formAttachment, setFormAttachment] = useState<File | null>(null);
  const [calcDays, setCalcDays] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // New Leave Type Form
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [newTypeCode, setNewTypeCode] = useState<string>('');
  const [newTypeName, setNewTypeName] = useState<string>('');
  const [newTypeDesc, setNewTypeDesc] = useState<string>('');
  const [newTypeQuota, setNewTypeQuota] = useState<number>(12);
  const [newTypeIsPaid, setNewTypeIsPaid] = useState<boolean>(true);

  // New Holiday Form
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [newHolidayName, setNewHolidayName] = useState<string>('');
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayIsOptional, setNewHolidayIsOptional] = useState<boolean>(false);

  // Policy Form State
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyName, setPolicyName] = useState<string>('');
  const [policyYear, setPolicyYear] = useState<number>(new Date().getFullYear());
  const [advanceNoticeDays, setAdvanceNoticeDays] = useState<number>(0);
  const [customRules, setCustomRules] = useState<CustomPolicyRule[]>([]);
  const [newRuleInput, setNewRuleInput] = useState<string>('');

  // Super Admin Quota Adjustment States
  const [employeesList, setEmployeesList] = useState<{ id: string; name: string; employeeCode: string }[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [showAdjustQuotaModal, setShowAdjustQuotaModal] = useState<boolean>(false);
  const [adjustBalanceItem, setAdjustBalanceItem] = useState<LeaveBalance | null>(null);
  const [adjustAllocated, setAdjustAllocated] = useState<number>(0);
  const [adjustUsed, setAdjustUsed] = useState<number>(0);
  const [adjustCarriedForward, setAdjustCarriedForward] = useState<number>(0);
  const [syncingQuotas, setSyncingQuotas] = useState<boolean>(false);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedEmployeeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const balanceUrl = selectedEmployeeId ? `/leaves/balance?employeeId=${selectedEmployeeId}` : '/leaves/balance';
      const [typesRes, balancesRes, requestsRes, holidaysRes, policyRes] = await Promise.all([
        api.get('/leaves/types').catch(() => ({ data: { data: [] } })),
        api.get(balanceUrl).catch(() => ({ data: { data: [] } })),
        api.get('/leaves/requests').catch(() => ({ data: { data: [] } })),
        api.get('/leaves/holidays').catch(() => ({ data: { data: [] } })),
        api.get('/leaves/policy').catch(() => ({ data: { data: [] } })),
      ]);

      setLeaveTypes(typesRes.data.data || []);
      setMyBalances(balancesRes.data.data || []);
      setLeaveRequests(requestsRes.data.data || []);
      setHolidays(holidaysRes.data.data || []);
      const polData = policyRes.data.data;
      setPolicies(Array.isArray(polData) ? polData : polData ? [polData] : []);

      if (canApprove) {
        const empRes = await api.get('/masters/employees').catch(() => api.get('/users'));
        setEmployeesList(empRes.data.data || []);

        if (activeTab === 'balances' || activeTab === 'reports') {
          const allBalRes = await api.get('/leaves/balance?all=true');
          setAllBalances(allBalRes.data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to load leave management data', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30s to catch leave approvals/rejections in real-time
  useAutoRefresh(fetchData, 30000, [activeTab, selectedEmployeeId]);

  // Live calculation of days when dates change in Apply Leave form
  useEffect(() => {
    if (formFromDate && formToDate) {
      if (new Date(formFromDate) > new Date(formToDate)) {
        setCalcDays(null);
        setSubmitError('From Date cannot be after To Date');
        return;
      }
      setSubmitError('');
      api.get(`/leaves/calculate-days?fromDate=${formFromDate}&toDate=${formToDate}&dayType=${formDayType}`)
        .then((res) => {
          setCalcDays(res.data.data.totalDays);
        })
        .catch(() => setCalcDays(null));
    } else {
      setCalcDays(null);
    }
  }, [formFromDate, formToDate, formDayType]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLeaveTypeId || !formFromDate || !formToDate || !formReason) {
      setSubmitError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('leaveTypeId', formLeaveTypeId);
      formData.append('fromDate', formFromDate);
      formData.append('toDate', formToDate);
      formData.append('dayType', formDayType);
      formData.append('reason', formReason);
      if (formAttachment) {
        formData.append('attachment', formAttachment);
      }

      await api.post('/leaves/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowApplyModal(false);
      resetApplyForm();
      fetchData();
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetApplyForm = () => {
    setFormLeaveTypeId('');
    setFormFromDate('');
    setFormToDate('');
    setFormDayType('FULL_DAY');
    setFormReason('');
    setFormAttachment(null);
    setCalcDays(null);
    setSubmitError('');
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);

    try {
      if (actionType === 'APPROVE') {
        await api.post(`/leaves/requests/${selectedRequest.id}/approve`, { comments: actionComments });
      } else if (actionType === 'REJECT') {
        await api.post(`/leaves/requests/${selectedRequest.id}/reject`, { rejectionReason: actionComments });
      } else if (actionType === 'CANCEL') {
        await api.post(`/leaves/requests/${selectedRequest.id}/cancel`, { cancellationReason: actionComments });
      }

      setShowApproveRejectModal(false);
      setSelectedRequest(null);
      setActionComments('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditTypeModal = (t: LeaveType) => {
    setEditingTypeId(t.id);
    setNewTypeCode(t.code);
    setNewTypeName(t.name);
    setNewTypeDesc(t.description || '');
    setNewTypeQuota(t.annualQuota);
    setNewTypeIsPaid(t.isPaid);
    setShowTypeModal(true);
  };

  const handleSaveLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeCode || !newTypeName) return;
    setSubmitting(true);
    try {
      if (editingTypeId) {
        await api.put(`/leaves/types/${editingTypeId}`, {
          name: newTypeName,
          description: newTypeDesc,
          annualQuota: newTypeQuota,
          isPaid: newTypeIsPaid,
        });
      } else {
        await api.post('/leaves/types', {
          code: newTypeCode,
          name: newTypeName,
          description: newTypeDesc,
          annualQuota: newTypeQuota,
          isPaid: newTypeIsPaid,
        });
      }
      setShowTypeModal(false);
      setEditingTypeId(null);
      setNewTypeCode('');
      setNewTypeName('');
      setNewTypeDesc('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save leave type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLeaveType = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate leave type "${name}"?`)) return;
    try {
      await api.delete(`/leaves/types/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete leave type');
    }
  };

  const openEditHolidayModal = (h: Holiday) => {
    setEditingHolidayId(h.id);
    setNewHolidayName(h.name);
    setNewHolidayDate(new Date(h.date).toISOString().split('T')[0]);
    setNewHolidayIsOptional(h.isOptional);
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayDate) return;
    setSubmitting(true);
    try {
      if (editingHolidayId) {
        await api.put(`/leaves/holidays/${editingHolidayId}`, {
          name: newHolidayName,
          date: newHolidayDate,
          isOptional: newHolidayIsOptional,
        });
      } else {
        await api.post('/leaves/holidays', {
          name: newHolidayName,
          date: newHolidayDate,
          isOptional: newHolidayIsOptional,
        });
      }
      setShowHolidayModal(false);
      setEditingHolidayId(null);
      setNewHolidayName('');
      setNewHolidayDate('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete holiday "${name}"?`)) return;
    try {
      await api.delete(`/leaves/holidays/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete holiday');
    }
  };

  const handleAddCustomRule = (nameToAdd?: string) => {
    const name = (nameToAdd || newRuleInput).trim();
    if (!name) return;
    const newRule: CustomPolicyRule = {
      id: Date.now().toString(),
      name,
      enabled: true,
    };
    setCustomRules((prev) => [...prev, newRule]);
    if (!nameToAdd) setNewRuleInput('');
  };

  const handleToggleCustomRule = (id: string) => {
    setCustomRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteCustomRule = (id: string) => {
    setCustomRules((prev) => prev.filter((r) => r.id !== id));
  };

  const openAdjustQuotaModal = (b: LeaveBalance) => {
    setAdjustBalanceItem(b);
    setAdjustAllocated(b.allocated);
    setAdjustUsed(b.used);
    setAdjustCarriedForward(b.carriedForward || 0);
    setShowAdjustQuotaModal(true);
  };

  const handleSaveAdjustQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBalanceItem) return;
    setSubmitting(true);
    try {
      const empId = adjustBalanceItem.employeeId || selectedEmployeeId || user.employeeId;
      await api.post('/leaves/balance/adjust', {
        employeeId: empId,
        leaveTypeId: adjustBalanceItem.leaveTypeId,
        allocated: Number(adjustAllocated),
        used: Number(adjustUsed),
        carriedForward: Number(adjustCarriedForward),
        year: adjustBalanceItem.year || new Date().getFullYear(),
      });
      setShowAdjustQuotaModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to adjust leave quota');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncAllQuotas = async () => {
    if (!window.confirm('Sync annual quotas to all active employees for current year?')) return;
    setSyncingQuotas(true);
    try {
      const res = await api.post('/leaves/balance/sync', { year: new Date().getFullYear() });
      alert(res.data.message || 'Quotas synced successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to sync quotas');
    } finally {
      setSyncingQuotas(false);
    }
  };

  const handleToggleLeaveTypePaid = async (leaveTypeId: string, currentIsPaid: boolean) => {
    if (!canManagePolicy && !isSuperAdmin) return;
    try {
      await api.put(`/leaves/types/${leaveTypeId}`, {
        isPaid: !currentIsPaid,
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle Paid/Unpaid status');
    }
  };

  const openAddPolicyModal = () => {
    setEditingPolicyId(null);
    setPolicyName('');
    setPolicyYear(new Date().getFullYear());
    setAdvanceNoticeDays(0);
    setCustomRules([]);
    setNewRuleInput('');
    setShowPolicyModal(true);
  };

  const openEditPolicyModal = (p: LeavePolicy) => {
    setEditingPolicyId(p.id);
    setPolicyName(p.name);
    setPolicyYear(p.year);
    setAdvanceNoticeDays(p.advanceNoticeDays || 0);

    let initialRules: CustomPolicyRule[] = [];
    if (p.customRules && Array.isArray(p.customRules) && p.customRules.length > 0) {
      initialRules = p.customRules;
    } else {
      if (p.excludeWeekends) initialRules.push({ id: '1', name: 'Exclude Weekends from Leave Count', enabled: true });
      if (p.excludeHolidays) initialRules.push({ id: '2', name: 'Exclude Public Holidays from Count', enabled: true });
      if (p.allowNegativeBalance) initialRules.push({ id: '3', name: 'Allow Negative Balance (Over-draw)', enabled: true });
    }
    setCustomRules(initialRules);
    setNewRuleInput('');
    setShowPolicyModal(true);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const excludeWeekends = customRules.some(r => r.name.toLowerCase().includes('weekend') && r.enabled);
      const excludeHolidays = customRules.some(r => r.name.toLowerCase().includes('holiday') && r.enabled);
      const allowNegativeBalance = customRules.some(r => (r.name.toLowerCase().includes('negative') || r.name.toLowerCase().includes('over-draw')) && r.enabled);

      const payload = {
        name: policyName.trim() || `${policyYear} Corporate Leave Policy`,
        year: policyYear,
        advanceNoticeDays: Number(advanceNoticeDays) || 0,
        excludeWeekends,
        excludeHolidays,
        allowNegativeBalance,
        customRules,
      };

      if (editingPolicyId) {
        await api.put(`/leaves/policy/${editingPolicyId}`, payload);
      } else {
        await api.post('/leaves/policy', payload);
      }
      setShowPolicyModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save leave policy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePolicy = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete leave policy "${name}"?`)) return;
    try {
      await api.delete(`/leaves/policy/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete leave policy');
    }
  };

  // Helper to extract applicant role of a request
  const getApplicantRole = (r: LeaveRequest) => {
    const roleName = r.employee?.users?.[0]?.userRoles?.[0]?.role?.name || 'STAFF';
    return roleName.toUpperCase();
  };

  // Role-scoped approval queue filtering:
  // - Account I applicant: 1-day leave goes to Admin; >1 day leave goes to Super Admin.
  // - Staff applicant: 1-day leave goes to Account I; 1-2 days to Admin; >2 days to Super Admin (Stage 1) -> Admin (Stage 2).
  // - Admin applicant: goes to Super Admin.
  const queueRequests = leaveRequests.filter((r) => {
    const appRole = getApplicantRole(r);
    const isAppAccount = appRole === 'ACCOUNTS' || appRole.startsWith('ACCOUNT');
    const isAppAdmin = appRole === 'ADMIN' || appRole.startsWith('ADMIN');

    if (isAccountsRole) {
      // Accounts role approves ONLY staff's 1-day leaves (not Accounts' own leaves)
      return r.totalDays <= 1 && !isAppAccount && !isAppAdmin;
    }
    if (isAdminRole) {
      if (r.status !== 'PENDING' && r.status !== 'SUPER_APPROVED') return true;
      // Admin approves 1-day leaves (Account I or Staff) and 1 to 2 day leaves
      if (r.totalDays <= 2 && r.status === 'PENDING') return true;
      // Admin approves Stage 2 (>2 day leaves)
      if (r.totalDays > 2 && r.status === 'SUPER_APPROVED') return true;
      return false;
    }
    if (isSuperAdmin) {
      if (r.status !== 'PENDING') return true;
      // Super Admin approves Account I's >1 day leaves
      if (isAppAccount && r.totalDays > 1) return true;
      // Super Admin approves Admin's leaves
      if (isAppAdmin) return true;
      // Super Admin approves Staff's >2 day leaves (Stage 1)
      if (r.totalDays > 2) return true;
      return true;
    }
    return true;
  });

  const pendingRequests = queueRequests.filter((r) => r.status === 'PENDING' || r.status === 'SUPER_APPROVED');

  // Filtered requests list for Approvals Queue
  const filteredRequests = queueRequests.filter((r) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      r.status === statusFilter ||
      (statusFilter === 'PENDING' && r.status === 'SUPER_APPROVED');
    const matchesSearch =
      (r.employee?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.employee?.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.leaveNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.leaveType?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Filtered list of MY own leave requests (applied by currently logged-in user / selected employee)
  const myLeaveRequests = leaveRequests.filter((r) => {
    if (selectedEmployeeId) {
      return r.employeeId === selectedEmployeeId;
    }
    const currentEmpId = user?.employeeId;
    if (currentEmpId) {
      return r.employeeId === currentEmpId;
    }
    return true;
  });

  const filteredMyRequests = myLeaveRequests.filter((r) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      r.status === statusFilter ||
      (statusFilter === 'PENDING' && r.status === 'SUPER_APPROVED');
    const matchesSearch =
      (r.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.leaveNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.leaveType?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalAllocated = myBalances.reduce((sum, b) => sum + b.allocated, 0);
  const totalUsed = myBalances.reduce((sum, b) => sum + b.used, 0);
  const totalPending = myBalances.reduce((sum, b) => sum + b.pending, 0);
  const totalRemaining = myBalances.reduce((sum, b) => sum + b.remaining, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Leave Management System</h1>
            <p className="text-sm text-slate-400">Apply leaves, view balances, approve team requests & calendar</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetApplyForm();
              setShowApplyModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Apply Leave
          </button>
          <button onClick={fetchData} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Allocated Card */}
        <div
          onClick={() => setActiveTab('my_leaves')}
          className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-transparent cursor-pointer hover:border-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all group"
          title="Click to view My Leaves Quotas"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 group-hover:text-indigo-300">Total Allocated</span>
          <div className="text-3xl font-extrabold text-white mt-1">{totalAllocated} <span className="text-xs text-gray-400 font-normal">Days</span></div>
          <span className="text-[11px] text-gray-400 mt-1 block">Annual Allowance &rarr;</span>
        </div>

        {/* Available Balance Card */}
        <div
          onClick={() => setActiveTab('my_leaves')}
          className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-emerald-500/10 to-transparent cursor-pointer hover:border-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all group"
          title="Click to view Available Leave Balances"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 group-hover:text-emerald-300">Available Balance</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{totalRemaining} <span className="text-xs text-gray-400 font-normal">Days</span></div>
          <span className="text-[11px] text-emerald-500/80 mt-1 block">Ready to use &rarr;</span>
        </div>

        {/* Pending Requests Card */}
        <div
          onClick={() => {
            if (canApprove) {
              setActiveTab('approvals');
            } else {
              setActiveTab('my_leaves');
              setStatusFilter('PENDING');
            }
          }}
          className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-amber-500/10 to-transparent cursor-pointer hover:border-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all group"
          title="Click to open Approvals Queue"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 group-hover:text-amber-300">Pending Requests</span>
            {canApprove && pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                {pendingRequests.length} New
              </span>
            )}
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-1">
            {canApprove ? pendingRequests.length : totalPending} <span className="text-xs text-gray-400 font-normal">{canApprove ? 'Request(s)' : 'Days'}</span>
          </div>
          <span className="text-[11px] text-amber-500/80 mt-1 block">
            {canApprove ? 'Open Approvals Queue &rarr;' : 'Awaiting Approval &rarr;'}
          </span>
        </div>

        {/* Used Leave Card */}
        <div
          onClick={() => {
            setActiveTab('my_leaves');
            setStatusFilter('APPROVED');
          }}
          className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent cursor-pointer hover:border-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all group"
          title="Click to view Approved/Consumed Leave History"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 group-hover:text-blue-300">Used Leave</span>
          <div className="text-3xl font-extrabold text-white mt-1">{totalUsed} <span className="text-xs text-gray-400 font-normal">Days</span></div>
          <span className="text-[11px] text-gray-400 mt-1 block">Consumed history &rarr;</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('my_leaves')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'my_leaves' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" /> My Leaves
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'approvals' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Approvals Queue
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'calendar' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarIcon className="w-4 h-4" /> Leave Calendar
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'balances' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" /> Team Balances
          </button>
        )}
        {canManagePolicy && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" /> Leave Types & Policy
          </button>
        )}
        <button
          onClick={() => setActiveTab('holidays')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'holidays' ? 'border-emerald-500 text-emerald-400 bg-white/5 rounded-t-xl' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" /> Holidays
        </button>
      </div>

      {/* ── TAB 1: MY LEAVES ────────────────────────────────────────────────── */}
      {activeTab === 'my_leaves' && (
        <div className="space-y-6">
          {/* Leave Balances Grid */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-white/5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  Your Leave Quotas ({new Date().getFullYear()})
                </h2>
                <p className="text-xs text-gray-400">
                  {selectedEmployeeId
                    ? `Viewing & managing quotas for selected employee`
                    : `Your allocated quotas and available balances`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canApprove && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 shrink-0">Filter Employee:</span>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Myself ({user.name || 'Super Admin'})</option>
                      {employeesList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {canManagePolicy && (
                  <button
                    type="button"
                    onClick={handleSyncAllQuotas}
                    disabled={syncingQuotas}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingQuotas ? 'animate-spin' : ''}`} />
                    Sync All Quotas
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {myBalances.map((b) => (
                <div key={b.id} className="glass-panel p-4 rounded-xl border border-white/5 space-y-2 hover:border-white/20 transition-all relative group">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm truncate pr-2">{b.leaveType?.name} ({b.leaveType?.code})</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (b.leaveType?.id) {
                            handleToggleLeaveTypePaid(b.leaveType.id, !!b.leaveType.isPaid);
                          }
                        }}
                        disabled={!canManagePolicy && !isSuperAdmin}
                        title={canManagePolicy || isSuperAdmin ? `Click to switch to ${b.leaveType?.isPaid ? 'UNPAID' : 'PAID'}` : undefined}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          b.leaveType?.isPaid
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        } ${canManagePolicy || isSuperAdmin ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                      >
                        {b.leaveType?.isPaid ? 'PAID' : 'UNPAID'}
                      </button>
                      {/* Edit quota button removed as per request */}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-gray-400 pt-1 border-t border-white/5">
                    <span>Allocated: <strong>{b.allocated}</strong></span>
                    <span>Used: <strong>{b.used}</strong></span>
                    <span>Pending: <strong>{b.pending}</strong></span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (b.used / (b.allocated || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-400">Remaining</span>
                    <span className="text-base font-extrabold text-emerald-400">{b.remaining} Days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <h2 className="text-base font-bold text-white">My Leave History</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search leave requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-[#0e1420]/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Leave No</th>
                    <th className="px-6 py-4">Leave Type</th>
                    <th className="px-6 py-4">Dates</th>
                    <th className="px-6 py-4 text-center">Days</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredMyRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No leave requests found.</td>
                    </tr>
                  ) : (
                    filteredMyRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-emerald-400">{r.leaveNo}</td>
                        <td className="px-6 py-4 font-semibold text-white">
                          {r.leaveType?.name} <span className="text-xs text-gray-400">({r.leaveType?.code})</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {new Date(r.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to{' '}
                          {new Date(r.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-white">{r.totalDays}</td>
                        <td className="px-6 py-4 text-xs text-gray-300 max-w-xs truncate">{r.reason}</td>
                        <td className="px-6 py-4">
                          {r.status === 'APPROVED' && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Approved</span>
                          )}
                          {r.status === 'SUPER_APPROVED' && (
                            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                              Super Admin Approved <span className="text-[10px] opacity-75">(Stage 1)</span>
                            </span>
                          )}
                          {r.status === 'PENDING' && (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                              {r.totalDays > 1 ? 'Pending Super Admin (Stage 1/2)' : 'Pending Admin'}
                            </span>
                          )}
                          {r.status === 'REJECTED' && (
                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Rejected</span>
                          )}
                          {r.status === 'CANCELLED' && (
                            <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Cancelled</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {(r.status === 'PENDING' || r.status === 'SUPER_APPROVED') && (
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setActionType('CANCEL');
                                setShowApproveRejectModal(true);
                              }}
                              className="text-xs font-semibold text-red-400 hover:text-red-300 underline"
                            >
                              Cancel Request
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PENDING APPROVALS QUEUE ───────────────────────────────────── */}
      {activeTab === 'approvals' && canApprove && (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden shadow-2xl space-y-4 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pb-2 border-b border-white/5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" /> Pending Team Approvals
            </h2>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="PENDING">Pending Only</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All Requests</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-[#0e1420]/50 text-gray-400 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Leave Type</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4 text-center">Days</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No requests found matching criteria.</td>
                  </tr>
                ) : (
                  filteredRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{r.employee?.name}</div>
                        <div className="text-xs text-emerald-400 font-mono">{r.employee?.employeeCode} · {r.employee?.department?.name || 'General'}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        {r.leaveType?.name} ({r.leaveType?.code})
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-300">
                        {new Date(r.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} to{' '}
                        {new Date(r.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-white">{r.totalDays}</td>
                      <td className="px-6 py-4 text-xs text-gray-300 max-w-xs">{r.reason}</td>
                      <td className="px-6 py-4">
                        {r.status === 'APPROVED' && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Approved</span>
                        )}
                        {r.status === 'SUPER_APPROVED' && (
                          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                            Stage 1 Approved (Super Admin)
                          </span>
                        )}
                        {r.status === 'PENDING' && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                            {r.totalDays <= 1
                              ? 'Pending Account I Approval'
                              : r.totalDays <= 2
                              ? 'Pending Admin Approval'
                              : 'Pending Super Admin (Stage 1)'}
                          </span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Rejected</span>
                        )}
                        {r.status === 'CANCELLED' && (
                          <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">Cancelled</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {/* 1-Day Leave: Single step approval by Account I / Accounts */}
                        {r.status === 'PENDING' && r.totalDays <= 1 && (
                          <>
                            {isAccountsRole || isAdminRole || isSuperAdmin ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setActionType('APPROVE');
                                    setShowApproveRejectModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setActionType('REJECT');
                                    setShowApproveRejectModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                Pending Account I Approval
                              </span>
                            )}
                          </>
                        )}

                        {/* 1 to 2-Day Leave: Single step approval by Admin */}
                        {r.status === 'PENDING' && r.totalDays > 1 && r.totalDays <= 2 && (
                          <>
                            {isAdminRole || isSuperAdmin ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setActionType('APPROVE');
                                    setShowApproveRejectModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setActionType('REJECT');
                                    setShowApproveRejectModal(true);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                Pending Admin Approval
                              </span>
                            )}
                          </>
                        )}

                        {/* Multi-Day Leave (>2 days), Stage 1: Super Admin approval required */}
                        {r.status === 'PENDING' && r.totalDays > 2 && (
                          <>
                            {isSuperAdmin ? (
                              <button
                                onClick={() => {
                                  setSelectedRequest(r);
                                  setActionType('APPROVE');
                                  setShowApproveRejectModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-bold border border-cyan-500/30 transition-colors"
                              >
                                Stage 1 Approve
                              </button>
                            ) : (
                              <span className="text-xs text-amber-400 font-semibold px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                Super Admin Approval Needed
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setActionType('REJECT');
                                setShowApproveRejectModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Multi-Day Leave (>1 day), Stage 2: Final Admin Approval */}
                        {r.status === 'SUPER_APPROVED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setActionType('APPROVE');
                                setShowApproveRejectModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors"
                            >
                              Final Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setActionType('REJECT');
                                setShowApproveRejectModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold border border-red-500/30 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: LEAVE CALENDAR ────────────────────────────────────────────── */}
      {activeTab === 'calendar' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-400" /> Team Leave Calendar ({calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() - 1)))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalendarDate(new Date())}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.setMonth(calendarDate.getMonth() + 1)))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Simple Approved Leaves List by Date */}
          <div className="space-y-3">
            {leaveRequests.filter((r) => r.status === 'APPROVED').length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-white/5 rounded-xl">No approved leaves scheduled for this period.</div>
            ) : (
              leaveRequests
                .filter((r) => r.status === 'APPROVED')
                .map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                        {r.leaveType?.code}
                      </div>
                      <div>
                        <div className="font-bold text-white">{r.employee?.name} <span className="text-xs text-gray-400">({r.employee?.employeeCode})</span></div>
                        <div className="text-xs text-emerald-400 font-medium">
                          {r.leaveType?.name} · {r.totalDays} Day(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono text-gray-300">
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} —{' '}
                      {new Date(r.toDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: LEAVE TYPES & POLICIES (ADMIN) ───────────────────────────── */}
      {activeTab === 'settings' && canManagePolicy && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leave Types Management */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Configurable Leave Types</h2>
              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setEditingTypeId(null);
                    setNewTypeCode('');
                    setNewTypeName('');
                    setNewTypeQuota(0);
                    setNewTypeIsPaid(true);
                    setShowTypeModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New Type
                </button>
              )}
            </div>

            <div className="space-y-3">
              {leaveTypes.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      {t.name} <span className="text-xs font-mono text-emerald-400">({t.code})</span>
                      <button
                        type="button"
                        onClick={() => handleToggleLeaveTypePaid(t.id, t.isPaid)}
                        disabled={!isSuperAdmin && !canManagePolicy}
                        title={isSuperAdmin || canManagePolicy ? `Click to switch to ${t.isPaid ? 'UNPAID' : 'PAID'}` : undefined}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          t.isPaid
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        } ${isSuperAdmin || canManagePolicy ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                      >
                        {t.isPaid ? 'PAID' : 'UNPAID'}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.description || 'Standard leave quota'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-white">{t.annualQuota}</span>
                      <span className="text-xs text-gray-400 block">Days / Year</span>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                        <button
                          onClick={() => openEditTypeModal(t)}
                          title="Edit Leave Type"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLeaveType(t.id, t.name)}
                          title="Delete Leave Type"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Policy Settings */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Company Leave Policies</h2>
                <p className="text-xs text-gray-400">Configure global weekend, holiday, and notice rules</p>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={openAddPolicyModal}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Policy
                </button>
              )}
            </div>

            <div className="space-y-4">
              {policies.map((pol) => (
                <div key={pol.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div>
                      <h3 className="font-bold text-white text-sm">{pol.name} ({pol.year})</h3>
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Active Policy</span>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditPolicyModal(pol)}
                          title="Edit Policy"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePolicy(pol.id, pol.name)}
                          title="Delete Policy"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-gray-400">Policy Rules & Advance Notice ({pol.advanceNoticeDays} Days Notice):</div>
                    {pol.customRules && pol.customRules.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {pol.customRules.map((rule) => (
                          <div
                            key={rule.id}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                              rule.enabled
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-slate-900 border-white/10 text-gray-500 line-through'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                            {rule.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-300">
                        <div className="p-2.5 rounded-lg bg-white/5">
                          <div className="text-gray-400 text-[10px]">Exclude Weekends</div>
                          <div className="font-bold text-emerald-400 mt-0.5">{pol.excludeWeekends ? 'YES' : 'NO'}</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          <div className="text-gray-400 text-[10px]">Exclude Public Holidays</div>
                          <div className="font-bold text-emerald-400 mt-0.5">{pol.excludeHolidays ? 'YES' : 'NO'}</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          <div className="text-gray-400 text-[10px]">Advance Notice</div>
                          <div className="font-bold text-white mt-0.5">{pol.advanceNoticeDays} Day(s)</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/5">
                          <div className="text-gray-400 text-[10px]">Negative Balance (Over-draw)</div>
                          <div className="font-bold text-amber-400 mt-0.5">{pol.allowNegativeBalance ? 'YES' : 'NO'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: HOLIDAYS ──────────────────────────────────────────────────── */}
      {activeTab === 'holidays' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Company Holiday Calendar ({new Date().getFullYear()})</h2>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setEditingHolidayId(null);
                  setNewHolidayName('');
                  setNewHolidayDate('');
                  setNewHolidayIsOptional(false);
                  setShowHolidayModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Holiday
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {holidays.map((h) => (
              <div key={h.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white block">{h.name}</span>
                    <div className="text-xs font-mono text-emerald-400 mt-0.5">
                      {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {h.isOptional && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">Optional</span>}
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1 pl-1">
                        <button
                          onClick={() => openEditHolidayModal(h)}
                          title="Edit Holiday"
                          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          title="Delete Holiday"
                          className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── APPLY LEAVE MODAL ────────────────────────────────────────────────── */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" /> Apply for Leave
              </h2>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4 text-sm">
              {submitError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Leave Type *</label>
                <select
                  value={formLeaveTypeId}
                  onChange={(e) => setFormLeaveTypeId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Leave Type --</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) — {t.annualQuota} Days/Year ({t.isPaid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">From Date *</label>
                  <input
                    type="date"
                    value={formFromDate}
                    onChange={(e) => setFormFromDate(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">To Date *</label>
                  <input
                    type="date"
                    value={formToDate}
                    onChange={(e) => setFormToDate(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Duration Type</label>
                <div className="flex gap-4 text-xs text-gray-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dayType"
                      value="FULL_DAY"
                      checked={formDayType === 'FULL_DAY'}
                      onChange={() => setFormDayType('FULL_DAY')}
                      className="accent-emerald-500"
                    /> Full Day
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dayType"
                      value="HALF_DAY"
                      checked={formDayType === 'HALF_DAY'}
                      onChange={() => setFormDayType('HALF_DAY')}
                      className="accent-emerald-500"
                    /> Half Day (0.5 Day)
                  </label>
                </div>
              </div>

              {calcDays !== null && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex justify-between items-center">
                  <span>Calculated Working Days (Excl. Holidays/Weekends):</span>
                  <span className="text-base">{calcDays} Day(s)</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Reason for Leave *</label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Provide reason for leave request..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Medical / Supporting Document (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => setFormAttachment(e.target.files ? e.target.files[0] : null)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20"
                >
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── APPROVE / REJECT / CANCEL MODAL ─────────────────────────────────── */}
      {showApproveRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">
              {actionType === 'APPROVE' ? 'Approve Leave Request' : actionType === 'REJECT' ? 'Reject Leave Request' : 'Cancel Leave Request'}
            </h2>

            <div className="p-3 rounded-xl bg-white/5 text-xs space-y-1">
              <div><strong>Employee:</strong> {selectedRequest.employee?.name} ({selectedRequest.employee?.employeeCode})</div>
              <div><strong>Leave Type:</strong> {selectedRequest.leaveType?.name} ({selectedRequest.leaveType?.code})</div>
              <div><strong>Days:</strong> {selectedRequest.totalDays} Day(s)</div>
              <div><strong>Reason:</strong> {selectedRequest.reason}</div>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {actionType === 'REJECT' ? 'Rejection Reason *' : 'Comments / Remarks'}
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  required={actionType === 'REJECT'}
                  rows={3}
                  placeholder="Enter comments or remarks..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowApproveRejectModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 rounded-xl text-xs font-bold ${
                    actionType === 'APPROVE'
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-red-500 text-white hover:bg-red-400'
                  }`}
                >
                  {submitting ? 'Processing...' : `Confirm ${actionType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NEW / EDIT LEAVE TYPE MODAL ────────────────────────────────────────────── */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">{editingTypeId ? 'Edit Leave Type' : 'Create New Leave Type'}</h2>

            <form onSubmit={handleSaveLeaveType} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Leave Code * (e.g. CL, SL, EL)</label>
                <input
                  type="text"
                  value={newTypeCode}
                  onChange={(e) => setNewTypeCode(e.target.value.toUpperCase())}
                  required
                  disabled={!!editingTypeId}
                  placeholder="CL"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Leave Name *</label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  required
                  placeholder="Casual Leave"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Annual Quota (Days)</label>
                <input
                  type="number"
                  value={newTypeQuota}
                  onChange={(e) => setNewTypeQuota(Number(e.target.value))}
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPaid"
                  checked={newTypeIsPaid}
                  onChange={(e) => setNewTypeIsPaid(e.target.checked)}
                  className="accent-emerald-500"
                />
                <label htmlFor="isPaid" className="text-gray-300">Paid Leave (No salary deduction)</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-gray-300">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                  {editingTypeId ? 'Update Leave Type' : 'Save Leave Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NEW / EDIT HOLIDAY MODAL ───────────────────────────────────────────────── */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">{editingHolidayId ? 'Edit Holiday' : 'Add Company Holiday'}</h2>

            <form onSubmit={handleSaveHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Holiday Name *</label>
                <input
                  type="text"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  required
                  placeholder="Independence Day"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isOpt"
                  checked={newHolidayIsOptional}
                  onChange={(e) => setNewHolidayIsOptional(e.target.checked)}
                  className="accent-emerald-500"
                />
                <label htmlFor="isOpt" className="text-gray-300">Optional / Restricted Holiday</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowHolidayModal(false)} className="px-4 py-2 rounded-xl bg-white/5 text-gray-300">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                  {editingHolidayId ? 'Update Holiday' : 'Add Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT / ADD LEAVE POLICY MODAL ────────────────────────────────────────── */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                {editingPolicyId ? 'Edit Leave Policy' : 'Add Corporate Leave Policy'}
              </h2>
              <button onClick={() => setShowPolicyModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-300 mb-1">Policy Name</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026 Standard Corporate Policy"
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Year *</label>
                  <input
                    type="number"
                    value={policyYear}
                    onChange={(e) => setPolicyYear(Number(e.target.value))}
                    required
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Advance Notice Requirement (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={advanceNoticeDays}
                  onChange={(e) => setAdvanceNoticeDays(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dynamic Policy Rules Section */}
              <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-xs">Custom Policy Rules</h3>
                    <p className="text-[11px] text-gray-400">Add or toggle rules specific to your company policy</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    {customRules.length} Rule(s)
                  </span>
                </div>

                {/* New Rule Input & Add Button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomRule();
                      }
                    }}
                    placeholder="Enter custom policy rule name..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomRule()}
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Rule
                  </button>
                </div>

                {/* Quick Suggestion Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 flex items-center mr-1">Quick Add:</span>
                  <button
                    type="button"
                    onClick={() => handleAddCustomRule('Exclude Weekends from Leave Count')}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] transition-colors"
                  >
                    + Weekends Excluded
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomRule('Exclude Public Holidays from Count')}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] transition-colors"
                  >
                    + Holidays Excluded
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomRule('Allow Negative Balance (Over-draw)')}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] transition-colors"
                  >
                    + Allow Over-draw
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCustomRule('Medical Certificate Required for > 2 Days')}
                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] transition-colors"
                  >
                    + Medical Certificate Required
                  </button>
                </div>

                {/* List of Created Rules */}
                <div className="space-y-2 pt-2 max-h-48 overflow-y-auto">
                  {customRules.length === 0 ? (
                    <div className="p-3 text-center text-gray-400 italic bg-slate-900/50 rounded-xl border border-dashed border-white/10">
                      No custom policy rules added yet. Type a rule title above or click a quick suggestion button to add one.
                    </div>
                  ) : (
                    customRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggleCustomRule(rule.id)}
                            className="w-4 h-4 accent-emerald-500 rounded shrink-0"
                          />
                          <span className={`text-xs truncate ${rule.enabled ? 'text-white font-medium' : 'text-gray-400 line-through'}`}>
                            {rule.name}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRule(rule.id)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          title="Remove Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  {submitting ? 'Saving...' : editingPolicyId ? 'Update Policy' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADJUST EMPLOYEE LEAVE QUOTA MODAL ────────────────────────────────────────── */}
      {showAdjustQuotaModal && adjustBalanceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                Adjust Leave Quota
              </h2>
              <button onClick={() => setShowAdjustQuotaModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 rounded-xl bg-white/5 text-xs space-y-1">
              <div><strong>Leave Type:</strong> {adjustBalanceItem.leaveType?.name} ({adjustBalanceItem.leaveType?.code})</div>
              <div><strong>Employee:</strong> {employeesList.find(e => e.id === (adjustBalanceItem.employeeId || selectedEmployeeId))?.name || user.name || 'Super Admin'}</div>
              <div><strong>Policy Quota Standard:</strong> {adjustBalanceItem.leaveType?.annualQuota || 12} Days / Year</div>
            </div>

            <form onSubmit={handleSaveAdjustQuota} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Allocated Quota Days *</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={adjustAllocated}
                  onChange={(e) => setAdjustAllocated(Number(e.target.value))}
                  required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Used Days</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={adjustUsed}
                    onChange={(e) => setAdjustUsed(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-300 mb-1">Carried Forward</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={adjustCarriedForward}
                    onChange={(e) => setAdjustCarriedForward(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex justify-between items-center font-bold">
                <span>Calculated Available Balance:</span>
                <span className="text-base">
                  {Math.max(0, Number(adjustAllocated) + Number(adjustCarriedForward) - Number(adjustUsed) - (adjustBalanceItem.pending || 0))} Days
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustQuotaModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  {submitting ? 'Saving...' : 'Update Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
