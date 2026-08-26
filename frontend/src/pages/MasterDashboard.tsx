import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Banknote, 
  Plus, 
  Search, 
  Power, 
  Globe, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  X,
  PlusCircle,
  FileText,
  Edit2,
  Trash2,
  Lock,
  CreditCard,
  TrendingUp
} from 'lucide-react';
import { api } from '../services/api';

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED';
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  subscriptionPlanId?: string | null;
  subscriptionPlan?: { name: string; months: number } | null;
  createdAt: string;
  userCount: number;
  employeeCount: number;
  adminEmail?: string | null;
}

interface SystemStats {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  totalEmployees: number;
  totalTransactionVolume: number;
}

export const MasterDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Defense-in-depth: Block access if the user is not the Global Master Admin
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : {};
  const isGlobalMasterAdmin = user.role === 'SUPER_ADMIN' && user.companyId === '00000000-0000-0000-0000-000000000000';

  if (!isGlobalMasterAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // State Management
  const [stats, setStats] = useState<SystemStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    suspendedCompanies: 0,
    totalUsers: 0,
    totalEmployees: 0,
    totalTransactionVolume: 0,
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Registration Form State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
  });
  
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Edit Company State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    adminEmail: '',
    subscriptionStatus: 'TRIAL' as 'TRIAL' | 'ACTIVE' | 'EXPIRED',
    trialEndsAt: '',
    subscriptionEndsAt: '',
  });
  const [editFormSubmitting, setEditFormSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'companies' | 'plans' | 'payments'>('companies');

  // Payment History state
  interface PaymentRecord {
    id: string;
    companyId: string;
    planId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amountPaid: number;
    currency: string;
    status: string;
    paidAt: string;
    company: { id: string; name: string; email: string | null };
    plan: { name: string; months: number };
  }
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      setPaymentsError('');
      const res = await api.get('/system/payments');
      if (res.data?.success && res.data?.data) {
        setPayments(res.data.data);
      }
    } catch (err: any) {
      setPaymentsError(err.response?.data?.message || 'Failed to load payment history.');
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Subscription Plans state
  interface SubscriptionPlan {
    id: string;
    name: string;
    months: number;
    price: number;
    hasGst: boolean;
    isActive: boolean;
    createdAt: string;
  }
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    months: 1,
    price: 0,
    hasGst: false,
    isActive: true,
  });
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Fetch plans
  const fetchPlans = async () => {
    try {
      setPlansLoading(true);
      setPlansError('');
      const res = await api.get('/system/plans');
      if (res.data?.success && res.data?.data) {
        setPlans(res.data.data);
      }
    } catch (err: any) {
      setPlansError(err.response?.data?.message || 'Failed to load subscription plans.');
    } finally {
      setPlansLoading(false);
    }
  };

  const handleOpenPlanModal = (plan: SubscriptionPlan | null = null) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanFormData({
        name: plan.name,
        months: plan.months,
        price: plan.price,
        hasGst: plan.hasGst,
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setPlanFormData({
        name: '',
        months: 1,
        price: 0,
        hasGst: false,
        isActive: true,
      });
    }
    setPlansError('');
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlansError('');
    setPlanSubmitting(true);
    try {
      if (editingPlan) {
        const res = await api.put(`/system/plans/${editingPlan.id}`, planFormData);
        if (res.data?.success) {
          setPlans(plans.map(p => p.id === editingPlan.id ? res.data.data : p));
          setShowPlanModal(false);
        }
      } else {
        const res = await api.post('/system/plans', planFormData);
        if (res.data?.success) {
          setPlans([res.data.data, ...plans]);
          setShowPlanModal(false);
        }
      }
    } catch (err: any) {
      setPlansError(err.response?.data?.message || 'Failed to save subscription plan.');
    } finally {
      setPlanSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the plan "${name}"?`)) {
      return;
    }
    try {
      setPlansError('');
      const res = await api.delete(`/system/plans/${id}`);
      if (res.data?.success) {
        setPlans(plans.filter(p => p.id !== id));
      }
    } catch (err: any) {
      setPlansError(err.response?.data?.message || 'Failed to delete subscription plan.');
    }
  };

  const handleTogglePlanStatus = async (plan: SubscriptionPlan) => {
    try {
      setPlansError('');
      const res = await api.put(`/system/plans/${plan.id}`, { isActive: !plan.isActive });
      if (res.data?.success) {
        setPlans(plans.map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p));
      }
    } catch (err: any) {
      setPlansError(err.response?.data?.message || 'Failed to update plan status.');
    }
  };


  // Password Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetCompany, setResetTargetCompany] = useState<Company | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Edit Handlers
  const handleOpenEditModal = (company: Company) => {
    setEditingCompany(company);
    setEditFormData({
      name: company.name,
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      currency: company.currency || 'INR',
      timezone: company.timezone || 'Asia/Kolkata',
      adminEmail: company.adminEmail || '',
      subscriptionStatus: company.subscriptionStatus || 'TRIAL',
      trialEndsAt: company.trialEndsAt ? new Date(company.trialEndsAt).toISOString().split('T')[0] : '',
      subscriptionEndsAt: company.subscriptionEndsAt ? new Date(company.subscriptionEndsAt).toISOString().split('T')[0] : '',
    });
    setEditFormError('');
    setShowEditModal(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setEditFormError('');
    setEditFormSubmitting(true);

    try {
      const res = await api.put(`/system/companies/${editingCompany.id}`, editFormData);
      if (res.data?.success) {
        const updated = res.data.data;
        setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...updated } : c));
        setShowEditModal(false);
      }
    } catch (err: any) {
      setEditFormError(err.response?.data?.message || 'Failed to update company details.');
    } finally {
      setEditFormSubmitting(false);
    }
  };

  // Password Reset Handlers
  const handleOpenResetModal = (company: Company) => {
    setResetTargetCompany(company);
    setResetPassword('');
    setResetError('');
    setResetSuccess('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetCompany) return;
    setResetError('');
    setResetSuccess('');
    setResetSubmitting(true);

    try {
      const res = await api.post(`/system/companies/${resetTargetCompany.id}/reset-password`, {
        password: resetPassword
      });
      if (res.data?.success) {
        setResetSuccess(res.data?.message || 'Admin password reset successfully!');
        setTimeout(() => {
          setShowResetModal(false);
          setResetSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'Failed to reset administrator password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Delete Handler
  const handleDeleteCompany = async (companyId: string, name: string) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete "${name}"?\n\nThis will instantly erase ALL database records associated with this company, including users, employees, ledger transactions, breaks, settings, and accounts. This action is IRREVERSIBLE!`)) {
      return;
    }

    try {
      setError('');
      const res = await api.delete(`/system/companies/${companyId}`);
      if (res.data?.success) {
        fetchStatsAndCompanies();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete client company.');
    }
  };

  // Fetch Master Data
  const fetchStatsAndCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [statsRes, companiesRes] = await Promise.all([
        api.get('/system/stats'),
        api.get('/system/companies')
      ]);

      if (statsRes.data?.success && statsRes.data?.data) {
        setStats(statsRes.data.data);
      }
      if (companiesRes.data?.success && companiesRes.data?.data) {
        setCompanies(companiesRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load system dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndCompanies();
  }, []);

  // Impersonate Context (Switch Company)
  const handleImpersonate = (companyId: string) => {
    localStorage.setItem('switch_company_id', companyId);
    // Redirect to root, page reload will read switch_company_id in Axios client
    window.location.href = '/';
  };

  // Toggle Company Status
  const handleToggleStatus = async (companyId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      setError('');
      const res = await api.patch(`/system/companies/${companyId}/status`, {
        status: nextStatus
      });
      if (res.data?.success) {
        // Refresh local data
        setCompanies(companies.map(c => c.id === companyId ? { ...c, status: nextStatus } : c));
        // Update stats summary counts
        setStats(prev => ({
          ...prev,
          activeCompanies: nextStatus === 'ACTIVE' ? prev.activeCompanies + 1 : prev.activeCompanies - 1,
          suspendedCompanies: nextStatus === 'SUSPENDED' ? prev.suspendedCompanies + 1 : prev.suspendedCompanies - 1,
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update company status.');
    }
  };

  // Form Submission
  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormSubmitting(true);

    try {
      const res = await api.post('/system/companies', formData);
      if (res.data?.success) {
        setFormSuccess('Client Company registered and seeded successfully!');
        setFormData({
          name: '',
          email: '',
          phone: '',
          address: '',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          adminName: '',
          adminEmail: '',
          adminPhone: '',
          adminPassword: '',
        });
        // Fetch fresh data
        fetchStatsAndCompanies();
        // Hide Modal after short delay
        setTimeout(() => {
          setShowRegisterModal(false);
          setFormSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to register client company.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter Search Results
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* System alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregated KPI Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Total Companies */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Clients</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">{stats.totalCompanies}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-500 font-bold">
            <span className="text-emerald-600">{stats.activeCompanies} Active</span>
            <span>•</span>
            <span className="text-amber-600">{stats.suspendedCompanies} Suspended</span>
          </div>
        </div>

        {/* KPI: Total Operators / Users */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Users</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">{stats.totalUsers}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[10px] text-slate-400 font-semibold">
            <span>User accounts across all clients</span>
          </div>
        </div>

        {/* KPI: Total Employees */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Employees</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">{stats.totalEmployees}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[10px] text-slate-400 font-semibold">
            <span>Staff members registered in system</span>
          </div>
        </div>

        {/* KPI: Total Transaction Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Payout Volume</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">
                ₹{stats.totalTransactionVolume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-[10px] text-slate-400 font-semibold">
            <span>Sum of all financial ledger items</span>
          </div>
        </div>

      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-2 mb-6">
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'companies'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Client Companies ({companies.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('plans');
            fetchPlans();
          }}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'plans'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Subscription Pricing Plans ({plans.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('payments');
            fetchPayments();
          }}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'payments'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Payment History ({payments.length})
          </span>
        </button>
      </div>

      {activeTab === 'companies' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Client Companies Directory</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Configure clients settings, suspend accounts, and view ledgers.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Client Name / ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-950 outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
              
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shrink-0 shadow-md shadow-emerald-600/10"
              >
                <Plus className="w-4 h-4" />
                <span>Add Client</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Client Company</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Metadata</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Local Config</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Loading Client Companies...
                    </td>
                  </tr>
                ) : filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No client companies found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{c.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{c.email || 'No email'} | {c.phone || 'No phone'}</span>
                            {c.adminEmail && (
                              <span className="text-[10px] text-indigo-600 font-bold block mt-1">
                                Admin Login: <span className="underline">{c.adminEmail}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="text-slate-700 font-semibold block">Users Count: <strong className="text-slate-900 font-bold">{c.userCount}</strong></span>
                          <span className="text-slate-700 font-semibold block">Employees: <strong className="text-slate-900 font-bold">{c.employeeCount}</strong></span>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              c.subscriptionStatus === 'ACTIVE' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : c.subscriptionStatus === 'TRIAL'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {c.subscriptionStatus}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold">
                              {c.subscriptionStatus === 'ACTIVE' && c.subscriptionEndsAt 
                                ? (c.subscriptionPlan ? `${c.subscriptionPlan.name} | Ends: ${new Date(c.subscriptionEndsAt).toLocaleDateString()}` : `Ends: ${new Date(c.subscriptionEndsAt).toLocaleDateString()}`)
                                : c.subscriptionStatus === 'TRIAL' && c.trialEndsAt
                                ? `Ends: ${new Date(c.trialEndsAt).toLocaleDateString()}`
                                : 'Expired'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.timezone}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-semibold text-slate-400">Currency:</span>
                          <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{c.currency}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold shadow-inner cursor-pointer ${
                            c.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70' 
                              : 'bg-red-50 text-red-700 hover:bg-red-100/70'
                          }`}
                          title="Click to change status"
                        >
                          <Power className="w-3 h-3" />
                          <span>{c.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span>
                        </button>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center items-center gap-3">
                          <button
                            onClick={() => handleImpersonate(c.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            title="Impersonate context to view logs and dashboard"
                          >
                            <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                            <span>View As</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            title="Edit Company Details"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenResetModal(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            title="Reset Admin Password"
                          >
                            <Lock className="w-3 h-3 text-indigo-500" />
                            <span>Reset Pass</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCompany(c.id, c.name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                            title="Delete Client Company"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Subscription Plans Config</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Configure dynamic subscription packages for the client checkouts.</p>
            </div>
            
            <button
              onClick={() => handleOpenPlanModal()}
              className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10"
            >
              <Plus className="w-4 h-4" />
              <span>Add Plan</span>
            </button>
          </div>

          {plansError && (
            <div className="p-4 m-6 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{plansError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Plan Name</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Duration</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Price</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {plansLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Loading Subscription Plans...
                    </td>
                  </tr>
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No pricing plans created yet. Add your first plan!
                    </td>
                  </tr>
                ) : (
                  plans.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-slate-600 font-semibold">{p.months} {p.months === 1 ? 'Month' : 'Months'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-600">₹{p.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          {p.hasGst && <span className="text-[9px] text-slate-400 font-bold tracking-wide mt-0.5">+ 18% GST</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleTogglePlanStatus(p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            p.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center items-center gap-3">
                          <button
                            onClick={() => handleOpenPlanModal(p)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                          >
                            <Edit2 className="w-3 h-3 text-slate-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeletePlan(p.id, p.name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 text-[10px] font-bold cursor-pointer transition-colors shadow-sm"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-left">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Subscription Payment History
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">All Razorpay payments received across all client companies.</p>
            </div>
            {payments.length > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">
                  Total: ₹{payments.reduce((sum, p) => sum + p.amountPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {paymentsError && (
            <div className="p-4 m-6 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{paymentsError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Company</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Plan</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Amount Paid</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Razorpay Payment ID</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Razorpay Order ID</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-3.5 font-bold text-slate-500 uppercase tracking-wider text-left">Paid At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paymentsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">Loading Payment History...</td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No payments recorded yet. Payments will appear here after successful Razorpay transactions.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{p.company.name}</span>
                            <span className="text-[10px] text-slate-400">{p.company.email || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block">{p.plan.name}</span>
                        <span className="text-[10px] text-slate-400">{p.plan.months} {p.plan.months === 1 ? 'Month' : 'Months'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-extrabold text-emerald-600">₹{p.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span className="text-[10px] text-slate-400 block">{p.currency}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg block max-w-[180px] truncate" title={p.razorpayPaymentId}>
                          {p.razorpayPaymentId}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded-lg block max-w-[160px] truncate" title={p.razorpayOrderId}>
                          {p.razorpayOrderId}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          p.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {p.status === 'SUCCESS' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-slate-700 font-semibold block">{new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[10px] text-slate-400">{new Date(p.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl relative text-left my-8 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[var(--primary)]" />
                  Register Client Company
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Initialize a client company and automatically seed standard directories.</p>
              </div>
              <button 
                onClick={() => {
                  setShowRegisterModal(false);
                  setFormError('');
                  setFormSuccess('');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable form) */}
            <form onSubmit={handleRegisterCompany} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Form alerts */}
              {formError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* SECTION A: Company Details */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">Company Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Acme Corporation"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. billing@acme.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. Block A2, Sector 62, Noida"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Currency Symbol</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="AED">AED (Dh)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Timezone</label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    >
                      <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                      <option value="UTC">UTC (GMT)</option>
                      <option value="America/New_York">US Eastern (New York)</option>
                      <option value="Asia/Dubai">UAE (Asia/Dubai)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION B: Primary Administrator Details */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">Primary Admin User (Tenant Owner)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Admin Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      placeholder="e.g. admin@acme.com"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Admin Mobile *</label>
                    <input
                      type="text"
                      required
                      value={formData.adminPhone}
                      onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Admin Login Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {formSubmitting ? 'Seeding Client Modules...' : 'Register & Seed'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
      {/* Edit Client Company Modal */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl relative text-left my-8 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[var(--primary)]" />
                  Edit Client Company: {editingCompany.name}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Modify the administrative details of the registered company profile.</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateCompany} className="p-6 space-y-6">
              {editFormError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-2">Admin Login Email *</label>
                  <input
                    type="email"
                    required
                    value={editFormData.adminEmail}
                    onChange={(e) => setEditFormData({ ...editFormData, adminEmail: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Phone</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Company Address</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Currency Symbol</label>
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="AED">AED (Dh)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Timezone</label>
                  <select
                    value={editFormData.timezone}
                    onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  >
                    <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                    <option value="UTC">UTC (GMT)</option>
                    <option value="America/New_York">US Eastern (New York)</option>
                    <option value="Asia/Dubai">UAE (Asia/Dubai)</option>
                  </select>
                </div>
                
                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-3">Subscription Setup</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Status</label>
                      <select
                        value={editFormData.subscriptionStatus}
                        onChange={(e) => setEditFormData({ ...editFormData, subscriptionStatus: e.target.value as any })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors font-bold"
                      >
                        <option value="TRIAL">Trial Mode</option>
                        <option value="ACTIVE">Active Paid</option>
                        <option value="EXPIRED">Expired</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Trial Ends Date</label>
                      <input
                        type="date"
                        value={editFormData.trialEndsAt}
                        onChange={(e) => setEditFormData({ ...editFormData, trialEndsAt: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Subscription Ends Date</label>
                      <input
                        type="date"
                        value={editFormData.subscriptionEndsAt}
                        onChange={(e) => setEditFormData({ ...editFormData, subscriptionEndsAt: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editFormSubmitting}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {editFormSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showResetModal && resetTargetCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl relative text-left my-8 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  Reset Admin Password
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Force reset login credentials for company admin owner.</p>
              </div>
              <button 
                onClick={() => setShowResetModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}
              {resetSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Company:</span>
                <span className="text-slate-800 font-semibold block mb-3 text-xs">{resetTargetCompany.name}</span>
                
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Admin Email User:</span>
                <span className="text-indigo-600 font-bold block mb-4 text-xs">{resetTargetCompany.adminEmail || 'No Admin Seeded'}</span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">New Admin Password *</label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter minimum 6 characters"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {resetSubmitting ? 'Resetting Password...' : 'Reset Credentials'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Setup Subscription Plan Create/Edit Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl relative text-left my-8 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[var(--primary)]" />
                  {editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Specify package details, duration, and pricing configuration.</p>
              </div>
              <button 
                onClick={() => setShowPlanModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePlan} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  placeholder="e.g. 3 Months Standard Plan"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Duration (Months) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={planFormData.months}
                    onChange={(e) => setPlanFormData({ ...planFormData, months: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Price (INR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 text-xs outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasGst"
                    checked={planFormData.hasGst}
                    onChange={(e) => setPlanFormData({ ...planFormData, hasGst: e.target.checked })}
                    className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <label htmlFor="hasGst" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    Add 18% GST to this plan
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={planFormData.isActive}
                    onChange={(e) => setPlanFormData({ ...planFormData, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    Make this subscription plan active for checkout
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-200 pt-4 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSubmitting}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  {planSubmitting ? 'Saving Plan...' : 'Save Plan'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

