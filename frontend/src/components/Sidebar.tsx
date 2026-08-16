import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Banknote,
  Users,
  BookOpen,
  ShieldAlert,
  Lock,
  Landmark,
  Tags,
  Building2,
  Settings,
  Calendar
} from 'lucide-react';

// Helper to read user from localStorage
const readUser = () => {
  const userString = localStorage.getItem('user');
  return userString ? JSON.parse(userString) : { permissions: [], role: '' };
};

export const Sidebar: React.FC = () => {
  const activeClass = "flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--sidebar-active-bg)] border-l-4 border-[var(--primary)] text-[var(--sidebar-active-text)] font-semibold shadow-inner";
  const inactiveClass = "flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--sidebar-text)] hover:bg-white/5 hover:text-[var(--sidebar-hover-text)] transition-all duration-200";
  const disabledClass = "flex items-center justify-between px-4 py-3 rounded-xl text-slate-600 cursor-not-allowed select-none";

  // Reactive user state — updates instantly when permissions change
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    // Listen for custom event dispatched by DashboardLayout after /me refresh
    const onPermissionsUpdated = () => setUser(readUser());

    // Also listen for storage changes (other tabs)
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') setUser(readUser());
    };

    window.addEventListener('user-permissions-updated', onPermissionsUpdated);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener('user-permissions-updated', onPermissionsUpdated);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  const hasPermission = (perms: string[]) => {
    // '*' wildcard OR SUPER_ADMIN role — show all menu items
    if (user.permissions?.includes('*')) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return perms.some((p: string) => user.permissions?.includes(p));
  };

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'ACCOUNTS' || user.role?.startsWith('ADMIN') || user.role?.startsWith('ACCOUNT');

  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: <LayoutDashboard className="w-5 h-5" />,
      enabled: true,
      visible: true
    },
    {
      name: 'Users',
      path: '/users',
      icon: <Users className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['USER_VIEW'])
    },
    {
      name: 'Accounts',
      path: '/accounts',
      icon: <Landmark className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['ACCOUNT_VIEW', 'ACCOUNT_CREATE'])
    },
    {
      name: 'Payment Categories',
      path: '/payment-categories',
      icon: <Tags className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['COMPANY_VIEW', 'PAYMENT_VIEW'])
    },
    {
      name: 'Approval Rules',
      path: '/approval-rules',
      icon: <Settings className="w-5 h-5" />,
      enabled: true,
      visible: user.role === 'SUPER_ADMIN' || user.permissions?.includes('*')
    },
    {
      name: 'Company Profile',
      path: '/company-settings',
      icon: <Building2 className="w-5 h-5" />,
      enabled: true,
      visible: user.role === 'SUPER_ADMIN' || user.permissions?.includes('*')
    },
    {
      name: 'Payments',
      path: '/payments',
      icon: <Wallet className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_APPROVE'])
    },
    {
      name: 'Voucher System',
      path: '/vouchers',
      icon: <Receipt className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['PAYMENT_VIEW', 'PAYMENT_CREATE'])
    },
    {
      name: 'Ledger Registry',
      path: '/ledger',
      icon: <BookOpen className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['REPORT_VIEW'])
    },
    {
      name: 'Reports & Analytics',
      path: '/reports',
      icon: <LayoutDashboard className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['REPORT_VIEW'])
    },
    {
      name: 'Expenses',
      path: '/expenses',
      icon: <Receipt className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE'])
    },
    {
      name: 'Salaries',
      path: '/salaries',
      icon: <Banknote className="w-5 h-5" />,
      enabled: true,
      visible: isAdmin && hasPermission(['SALARY_VIEW', 'SALARY_CREATE'])
    },
    {
      name: 'Payroll Batches',
      path: '/payrolls',
      icon: <Users className="w-5 h-5" />,
      enabled: true,
      visible: isAdmin && hasPermission(['SALARY_VIEW'])
    },
    {
      name: 'Staff Advances',
      path: '/advances',
      icon: <Banknote className="w-5 h-5" />,
      enabled: true,
      visible: isAdmin && hasPermission(['ADVANCE_VIEW', 'ADVANCE_CREATE', 'ADVANCE_APPROVE'])
    },
    {
      name: 'Leave Management',
      path: '/leaves',
      icon: <Calendar className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['LEAVE_VIEW', 'LEAVE_APPLY', 'LEAVE_APPROVE', 'LEAVE_MANAGE'])
    },
    {
      name: 'Employee Portal',
      path: '/employees',
      icon: <Users className="w-5 h-5" />,
      enabled: true,
      visible: true
    },
    {
      name: 'Audit History',
      path: '/audit',
      icon: <ShieldAlert className="w-5 h-5" />,
      enabled: true,
      visible: hasPermission(['REPORT_VIEW'])
    },
  ];

  // Filter items to show only visible ones based on permissions
  const visibleItems = navigationItems.filter((item) => item.visible);

  return (
    <aside className="w-72 h-screen sticky top-0 flex flex-col bg-[var(--sidebar)] border-r border-slate-800">
      {/* Brand logo */}
      <div className="px-8 py-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-emerald-500/25">
          Ω
        </div>
        <div>
          <span className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
            ANTIGRAVITY
          </span>
          <span className="block text-[9px] font-bold tracking-widest text-[var(--primary)] uppercase mt-0.5">
            FINANCIAL CONTROL
          </span>
        </div>
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <p className="px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
          Core Operations
        </p>

        {visibleItems.map((item) => (
          item.enabled ? (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => isActive ? activeClass : inactiveClass}
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ) : (
            <div key={item.name} className={disabledClass} title={item.name}>
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="opacity-50">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 text-[9px] font-semibold text-gray-500">
                <Lock className="w-2.5 h-2.5" />
                <span>Locked</span>
              </div>
            </div>
          )
        ))}
      </nav>

      {/* Sidebar Footer info */}
      <div className="p-6 border-t border-slate-800 text-center">
        <p className="text-[10px] text-gray-500 font-semibold">
          MVP Phase 2
        </p>
        <p className="text-[9px] text-gray-600 mt-1">
          Local Development Mode
        </p>
      </div>
    </aside>
  );
};
