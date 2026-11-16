import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Receipt,
  Users,
  Landmark,
  BookOpen,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

interface BottomNavProps {
  user: any;
  onOpenSidebar: () => void;
  isVisible?: boolean;
}

interface BottomNavItem {
  name: string;
  path?: string;
  icon: React.ReactNode;
  isMore?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ user, onOpenSidebar, isVisible = true }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getRoleBottomNavItems = (): BottomNavItem[] => {
    const role = (user?.role || '').toUpperCase();
    const permissions: string[] = user?.permissions || [];
    const hasPerm = (p: string) => permissions.includes('*') || permissions.includes(p);

    // 1. SUPER_ADMIN / ADMIN Panel
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || hasPerm('*')) {
      return [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
        { name: 'Attendance', path: '/attendance', icon: <Clock className="w-5 h-5 shrink-0" /> },
        { name: 'Vouchers', path: '/vouchers', icon: <Receipt className="w-5 h-5 shrink-0" /> },
        { name: 'Employees', path: '/employees', icon: <Users className="w-5 h-5 shrink-0" /> },
        { name: 'More', isMore: true, icon: <MoreHorizontal className="w-5 h-5 shrink-0" /> },
      ];
    }

    // 2. ACCOUNTS / ACCOUNTANT Panel
    if (role === 'ACCOUNTS' || role === 'ACCOUNTANT' || role.startsWith('ACCOUNT')) {
      return [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
        { name: 'Accounts', path: '/accounts', icon: <Landmark className="w-5 h-5 shrink-0" /> },
        { name: 'Vouchers', path: '/vouchers', icon: <Receipt className="w-5 h-5 shrink-0" /> },
        { name: 'Ledger', path: '/ledger', icon: <BookOpen className="w-5 h-5 shrink-0" /> },
        { name: 'More', isMore: true, icon: <MoreHorizontal className="w-5 h-5 shrink-0" /> },
      ];
    }

    // 3. HR / MANAGER Panel
    if (role === 'HR' || role === 'MANAGER') {
      return [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
        { name: 'Attendance', path: '/attendance', icon: <Clock className="w-5 h-5 shrink-0" /> },
        { name: 'Employees', path: '/employees', icon: <Users className="w-5 h-5 shrink-0" /> },
        { name: 'Leaves', path: '/leaves', icon: <Calendar className="w-5 h-5 shrink-0" /> },
        { name: 'More', isMore: true, icon: <MoreHorizontal className="w-5 h-5 shrink-0" /> },
      ];
    }

    // 4. STAFF / EMPLOYEE Panel (Default)
    return [
      { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5 shrink-0" /> },
      { name: 'Attendance', path: '/attendance', icon: <Clock className="w-5 h-5 shrink-0" /> },
      { name: 'Expenses', path: '/expenses', icon: <Receipt className="w-5 h-5 shrink-0" /> },
      { name: 'Leaves', path: '/leaves', icon: <Calendar className="w-5 h-5 shrink-0" /> },
      { name: 'More', isMore: true, icon: <MoreHorizontal className="w-5 h-5 shrink-0" /> },
    ];
  };

  const navItems = getRoleBottomNavItems();

  // Check if any of the primary 4 routes are active
  const isAnyPrimaryActive = navItems.slice(0, 4).some((item) => {
    if (!item.path) return false;
    return item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path);
  });

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className={`md:hidden fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full max-w-md z-40 bg-white/95 backdrop-blur-xl border-2 border-[var(--primary)] rounded-3xl shadow-xl shadow-slate-900/10 px-2 py-1.5 transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-28 opacity-0 pointer-events-none'
      }`}
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          if (item.isMore) {
            const isMoreActive = !isAnyPrimaryActive;
            return (
              <button
                key="more-menu-btn"
                type="button"
                onClick={onOpenSidebar}
                className="flex flex-col items-center justify-center py-1 px-1 transition-all cursor-pointer select-none group"
              >
                <div 
                  className={`w-full max-w-[62px] py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    isMoreActive
                      ? 'border border-[var(--primary)]/40 bg-[var(--primary-light)] text-[var(--primary)] shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <div className="relative">
                    <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'text-[var(--primary)]' : 'text-slate-500 group-hover:text-slate-800'}`} />
                    {isMoreActive && (
                      <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[var(--primary)] ring-2 ring-white" />
                    )}
                  </div>
                  <span className={`text-[10px] tracking-tight mt-0.5 truncate leading-none ${isMoreActive ? 'font-extrabold text-[var(--primary)]' : 'font-semibold'}`}>
                    More
                  </span>
                </div>
              </button>
            );
          }

          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path!);

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                if (item.path && location.pathname !== item.path) {
                  navigate(item.path);
                }
              }}
              className="flex flex-col items-center justify-center py-1 px-1 transition-all cursor-pointer select-none group"
            >
              <div 
                className={`w-full max-w-[62px] py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isActive
                    ? 'border border-[var(--primary)]/40 bg-[var(--primary-light)] text-[var(--primary)] shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className={isActive ? 'text-[var(--primary)]' : 'text-slate-500 group-hover:text-slate-800'}>
                  {item.icon}
                </div>
                <span className={`text-[10px] tracking-tight mt-0.5 truncate leading-none ${isActive ? 'font-extrabold text-[var(--primary)]' : 'font-semibold'}`}>
                  {item.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
