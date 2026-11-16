import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Bell, Menu, LogOut, ChevronDown, Shield, Building2, Clock, Moon, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { formatTime12 } from './TimeInput12';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardPage = location.pathname === '/' || location.pathname === '/master-dashboard';
  const isSubPage = !isDashboardPage;
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { email: 'admin@company.com', role: 'SUPER_ADMIN' };
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [companyInfo, setCompanyInfo] = useState<{ name: string; currency: string } | null>(null);

  // Notifications states
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // User Profile Dropdown state
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('switch_company_id');
    navigate('/login');
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/auth/notifications');
      if (response.data?.success && response.data?.data) {
        setNotifications(response.data.data.notifications || []);
        setUnreadCount(response.data.data.count || 0);
      }
    } catch (err) {
      // Silently catch notifications fetch failure
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCompany = async () => {
    try {
      const response = await api.get('/company');
      if (response.data?.data) {
        setCompanyInfo({
          name: response.data.data.name || 'Company Profile',
          currency: response.data.data.currency || 'INR',
        });
      }
    } catch (err) {
      // Silently handle if company API fails or unauthenticated
    }
  };

  useEffect(() => {
    fetchCompany();

    const handleCompanyUpdate = () => {
      fetchCompany();
    };

    window.addEventListener('company-profile-updated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('company-profile-updated', handleCompanyUpdate);
    };
  }, []);

  // Shift state for active user/employee
  const [shiftData, setShiftData] = useState<{
    hasShift: boolean;
    shiftName: string;
    startTime: string;
    endTime: string;
    isNightShift: boolean;
    durationType: string;
    startDate: string;
    endDate: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    isExpiredFallback?: boolean;
    badgeText: string;
  } | null>(null);

  const fetchMyShift = async () => {
    if (isSuperAdmin) return;
    try {
      const res = await api.get('/auth/my-shift');
      if (res.data?.success && res.data?.data) {
        setShiftData(res.data.data);
      }
    } catch {
      // Silently catch shift fetch failure
    }
  };

  useEffect(() => {
    fetchMyShift();

    const handleShiftUpdated = () => {
      fetchMyShift();
    };

    window.addEventListener('shift-schedule-updated', handleShiftUpdated);
    return () => {
      window.removeEventListener('shift-schedule-updated', handleShiftUpdated);
    };
  }, []);

  const switchCompanyId = localStorage.getItem('switch_company_id');

  const handleExitImpersonation = () => {
    localStorage.removeItem('switch_company_id');
    window.location.href = '/master-dashboard';
  };

  return (
    <>
      {switchCompanyId && (
        <div className="w-full bg-amber-500 text-slate-950 px-6 py-2 flex items-center justify-between text-xs font-bold shadow-md z-50">
          <div className="flex items-center gap-2">
            <span className="bg-slate-950 text-amber-500 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
              Impersonation Active
            </span>
            <span>
              Currently viewing dashboard and ledger records as <strong>{companyInfo?.name || 'Client Tenant'}</strong>.
            </span>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="bg-slate-950 text-white px-3 py-1 rounded-md hover:bg-slate-800 transition-colors font-bold cursor-pointer"
          >
            Exit Context
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 w-full bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3.5 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between shadow-sm">
      {/* Mobile Navigation Button: Back button on subpages, Hamburger menu on root */}
      {isSubPage ? (
        <>
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="lg:hidden mr-2 p-1.5 text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center justify-center"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          {onMenuClick && (
            <button 
              onClick={onMenuClick}
              className="hidden lg:flex mr-2 sm:mr-4 p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </>
      ) : (
        onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="mr-2 sm:mr-4 p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )
      )}

      {/* Dynamic Title */}
      {title ? (
        <div className="min-w-0 flex-1 mr-2 sm:mr-4">
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold tracking-tight text-[var(--text-primary)] truncate" title={title}>
            {title}
          </h1>
        </div>
      ) : (
        <div className="min-w-0 flex-1 mr-2 sm:mr-4" />
      )}

      {/* Quick Menu */}
      <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-5 shrink-0">
        {/* Active Shift & Schedule Badge (hidden on mobile to give space to Page Title, visible on md+) */}
        {!isSuperAdmin && shiftData && shiftData.hasShift && (
          <div 
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50/90 border border-violet-200/90 text-violet-900 shadow-xs cursor-default select-none"
            title={`Assigned Shift: ${shiftData.shiftName} (${formatTime12(shiftData.startTime)} - ${formatTime12(shiftData.endTime)}) • ${shiftData.badgeText}`}
          >
            {shiftData.isNightShift ? (
              <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-violet-600 shrink-0" />
            )}
            <div className="text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900">{shiftData.shiftName}</span>
                <span className="text-[11px] font-semibold text-violet-700 hidden md:inline">
                  {formatTime12(shiftData.startTime)} - {formatTime12(shiftData.endTime)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    shiftData.isExpired
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : shiftData.daysRemaining !== null
                      ? 'bg-violet-200/90 text-violet-900 border border-violet-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {shiftData.badgeText || 'Active'}
                </span>
                {shiftData.endDate && !shiftData.isExpired && (
                  <span className="text-[10px] text-slate-500 font-medium hidden lg:inline">
                    (till {new Date(shiftData.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Notifications Dropdown Container */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                fetchNotifications(); // Refresh list on click
              }
            }}
            className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
              showNotifications ? 'bg-slate-50 text-slate-950' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="View Alerts"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full min-w-4 h-4 flex items-center justify-center leading-none transform translate-x-1/3 -translate-y-1/3 border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              {/* Invisible Click Backdrop to Close Dropdown */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowNotifications(false)}
              />
              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-3 overflow-hidden text-left">
                <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-[var(--primary)] px-1.5 py-0.5 rounded bg-[var(--primary-light)]">
                      {unreadCount} Pending
                    </span>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                      No pending approvals or alerts
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(notif.link);
                        }}
                        className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[11px] font-bold text-slate-900">{notif.title}</span>
                          <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                            {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

        {/* User Account / Profile Menu with Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group text-left border-none bg-transparent"
            title="User Profile Menu"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/10 group-hover:scale-105 transition-transform shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold leading-none text-slate-900 group-hover:text-[var(--primary)] transition-colors">
                {user.name || user.email.split('@')[0]}
              </p>
              <p className="text-[10px] font-bold leading-none text-[var(--primary)] mt-1 uppercase tracking-wider">
                {user.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform hidden sm:block" />
          </button>

          {showUserMenu && (
            <>
              {/* Click backdrop to close */}
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 overflow-hidden text-left animate-zoom-in">
                {/* User Info Header */}
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.name || user.email.split('@')[0]}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {user.role}
                    </span>
                    {!isSuperAdmin && shiftData && shiftData.hasShift && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200" title={`Shift: ${shiftData.shiftName}`}>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{shiftData.shiftName} ({shiftData.badgeText || 'Active'})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile Links according to Role */}
                <div className="py-1">
                  {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/company-settings');
                      }}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Company Settings</span>
                    </button>
                  )}

                  {!isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/employees');
                      }}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <User className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Employee Profile Portal</span>
                    </button>
                  )}
                </div>

                {/* Logout Divider & Button */}
                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Direct One-Click Logout Icon for non-superadmin users (hidden on small mobile screens to keep header spacious) */}
        {!isSuperAdmin && (
          <button
            type="button"
            onClick={handleLogout}
            className="hidden sm:flex p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Sign Out / Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
    </>
  );
};
