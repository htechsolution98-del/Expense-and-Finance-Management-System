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
  Calendar,
  Clock,
  Megaphone,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Helper to read user from localStorage
const readUser = () => {
  const userString = localStorage.getItem('user');
  return userString ? JSON.parse(userString) : { permissions: [], role: '' };
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  // Dragging and Collapse states - By default sidebar is collapsed
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed_v3');
    if (saved === null) return true; // Default collapsed as requested!
    return saved === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem('sidebar_width');
    return savedWidth ? parseInt(savedWidth, 10) : 270;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string; top: number; left: number } | null>(null);

  // Listen for global toggle-sidebar-collapse event from header
  useEffect(() => {
    const handleToggleCollapse = () => {
      setIsCollapsed((prev) => !prev);
      setTooltip(null);
    };
    window.addEventListener('toggle-sidebar-collapse', handleToggleCollapse);
    return () => window.removeEventListener('toggle-sidebar-collapse', handleToggleCollapse);
  }, []);

  // Expanded styles
  const activeClass = "flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[var(--sidebar-active-bg)] border-l-4 border-[var(--primary)] text-[var(--sidebar-active-text)] font-semibold shadow-inner transition-all duration-200";
  const inactiveClass = "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-hover-text)] transition-all duration-200";
  const disabledClass = "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-600 cursor-not-allowed select-none";

  // Collapsed styles (icon only)
  const collapsedActiveClass = "flex items-center justify-center p-2.5 rounded-xl bg-[var(--sidebar-active-bg)] border border-[var(--primary)]/60 text-[var(--sidebar-active-text)] font-semibold shadow-inner transition-all duration-200";
  const collapsedInactiveClass = "flex items-center justify-center p-2.5 rounded-xl text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-hover-text)] transition-all duration-200";
  const collapsedDisabledClass = "flex items-center justify-center p-2.5 rounded-xl text-slate-600 cursor-not-allowed select-none opacity-50";

  // Reactive user state — updates instantly when permissions change
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    const onPermissionsUpdated = () => setUser(readUser());
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

  // Mouse Drag Resizing Logic
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
    setTooltip(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;

      if (newWidth < 130) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
        const clamped = Math.min(Math.max(newWidth, 200), 380);
        setSidebarWidth(clamped);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed_v3', String(isCollapsed));
    localStorage.setItem('sidebar_width', String(sidebarWidth));
  }, [isCollapsed, sidebarWidth]);

  const hasPermission = (perms: string[]) => {
    if (user.permissions?.includes('*')) return true;
    if (user.role === 'SUPER_ADMIN') return true;
    return perms.some((p: string) => user.permissions?.includes(p));
  };

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'ACCOUNTS' || user.role?.startsWith('ADMIN') || user.role?.startsWith('ACCOUNT');
  const isGlobalMasterAdmin = user.role === 'SUPER_ADMIN' && user.companyId === '00000000-0000-0000-0000-000000000000';

  const sections = [
    {
      title: 'SYSTEM CONSOLE',
      items: [
        {
          name: 'Master Dashboard',
          path: '/master-dashboard',
          icon: <ShieldAlert className="w-5 h-5" />,
          enabled: true,
          visible: isGlobalMasterAdmin
        }
      ]
    },
    {
      title: 'OVERVIEW',
      items: [
        {
          name: 'Dashboard',
          path: '/',
          icon: <LayoutDashboard className="w-5 h-5" />,
          enabled: true,
          visible: true
        },
        {
          name: 'Announcements',
          path: '/announcements',
          icon: <Megaphone className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['ANNOUNCEMENT_VIEW'])
        }
      ]
    },
    {
      title: 'FINANCE',
      items: [
        {
          name: 'Accounts',
          path: '/accounts',
          icon: <Landmark className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['ACCOUNT_VIEW', 'ACCOUNT_CREATE'])
        },
        {
          name: 'Payments',
          path: '/payments',
          icon: <Wallet className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_APPROVE'])
        },
        {
          name: 'Expenses',
          path: '/expenses',
          icon: <Receipt className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE'])
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
          visible: user.role === 'SUPER_ADMIN' || user.permissions?.includes('*')
        },
        {
          name: 'Business Loans',
          path: '/loans',
          icon: <Banknote className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['LOAN_VIEW'])
        },
        {
          name: 'Reports & Analytics',
          path: '/reports',
          icon: <LayoutDashboard className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['REPORT_VIEW'])
        }
      ]
    },
    {
      title: 'PEOPLE',
      items: [
        {
          name: 'Employee Portal',
          path: '/employees',
          icon: <Users className="w-5 h-5" />,
          enabled: true,
          visible: true
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
          visible: hasPermission(['ADVANCE_VIEW', 'ADVANCE_CREATE', 'ADVANCE_APPROVE'])
        },
        {
          name: 'Attendance',
          path: '/attendance',
          icon: <Clock className="w-5 h-5" />,
          enabled: true,
          visible: true
        },
        {
          name: 'Leave Management',
          path: '/leaves',
          icon: <Calendar className="w-5 h-5" />,
          enabled: true,
          visible: true
        }
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        {
          name: 'Users',
          path: '/users',
          icon: <Users className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['USER_VIEW'])
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
          name: 'Attendance Settings',
          path: '/attendance-config',
          icon: <Settings className="w-5 h-5" />,
          enabled: true,
          visible: user.role === 'SUPER_ADMIN' || user.permissions?.includes('*')
        },
        {
          name: 'Audit History',
          path: '/audit',
          icon: <ShieldAlert className="w-5 h-5" />,
          enabled: true,
          visible: hasPermission(['REPORT_VIEW'])
        }
      ]
    }
  ];

  const renderSidebarContent = (isMobile: boolean) => {
    const collapsed = !isMobile && isCollapsed;

    return (
      <>
        {/* Brand logo */}
        <div className={`py-3.5 border-b border-slate-800 flex items-center shrink-0 ${collapsed ? 'px-2 justify-center' : 'px-4 justify-between gap-2'}`}>
          <div className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? (
              <div 
                onClick={toggleCollapse}
                className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 cursor-pointer hover:border-emerald-500/70 hover:scale-105 transition-all" 
                title="KaryaNiyantrak (Click to expand)"
              >
                <img src="/logo-emblem.png" alt="KaryaNiyantrak" className="w-8.5 h-8.5 object-contain" />
              </div>
            ) : (
              <div className="flex items-center">
                <img
                  src="/karyaniyantrak-logo-white.png"
                  alt="KaryaNiyantrak"
                  className="h-12 w-auto max-w-[205px] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                />
              </div>
            )}
          </div>
          {/* Clean Collapse button inside header when expanded on desktop */}
          {!collapsed && !isMobile && (
            <button 
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {isMobile && onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation menu */}
        <nav 
          className={`flex-1 py-3 space-y-2 overflow-y-auto scrollbar-none ${collapsed ? 'px-2' : 'px-3.5'}`} 
          onScroll={() => setTooltip(null)}
          onClick={isMobile ? onClose : undefined}
        >
          {sections.map((sec) => {
            const secVisibleItems = sec.items.filter((item) => item.visible);
            if (secVisibleItems.length === 0) return null;

            return (
              <div key={sec.title} className="space-y-1">
                {collapsed ? (
                  <div className="my-2 border-t border-slate-800/80 mx-1.5" />
                ) : (
                  <p className="px-3.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1 mt-3 truncate">
                    {sec.title}
                  </p>
                )}

                {secVisibleItems.map((item) => (
                  item.enabled ? (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      className={({ isActive }) => (collapsed ? (isActive ? collapsedActiveClass : collapsedInactiveClass) : (isActive ? activeClass : inactiveClass))}
                      onMouseEnter={(e) => {
                        if (collapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            name: item.name,
                            top: rect.top + rect.height / 2,
                            left: rect.right + 12,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (collapsed) setTooltip(null);
                      }}
                      onClick={() => {
                        if (collapsed) setTooltip(null);
                      }}
                    >
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {item.icon}
                      </div>
                      {!collapsed && <span className="text-xs truncate">{item.name}</span>}
                    </NavLink>
                  ) : (
                    <div 
                      key={item.name} 
                      className={collapsed ? collapsedDisabledClass : disabledClass}
                      onMouseEnter={(e) => {
                        if (collapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            name: `${item.name} (Locked)`,
                            top: rect.top + rect.height / 2,
                            left: rect.right + 12,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (collapsed) setTooltip(null);
                      }}
                    >
                      <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                        {item.icon}
                      </div>
                      {!collapsed && (
                        <>
                          <span className="opacity-50 text-xs truncate flex-1 ml-3">{item.name}</span>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 text-[9px] font-semibold text-gray-500 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Locked</span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </nav>
      </>
    );
  };

  return (
    <>
      {/* Desktop Resizable Sidebar (visible on large screens) */}
      <aside 
        style={{ width: isCollapsed ? '72px' : `${sidebarWidth}px` }}
        onMouseLeave={() => setTooltip(null)}
        className={`hidden lg:flex h-screen sticky top-0 flex-col bg-[var(--sidebar)] border-r border-slate-800 shrink-0 relative ${
          !isResizing ? 'transition-[width] duration-200 ease-in-out' : ''
        }`}
      >
        {renderSidebarContent(false)}

        {/* Drag Resize Handle (Desktop Only) */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={toggleCollapse}
          className={`absolute top-0 -right-1 w-2 h-full cursor-col-resize select-none z-30 transition-colors group ${
            isResizing ? 'bg-emerald-500' : 'hover:bg-emerald-500/40'
          }`}
          title="Drag to resize | Double-click to toggle"
        />
      </aside>

      {/* Floating Hover Tooltip in Collapsed Mode */}
      {isCollapsed && tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold shadow-2xl whitespace-nowrap animate-fade-in flex items-center gap-1.5"
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {/* Tooltip Arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] border-4 border-transparent border-r-slate-900" />
          <span>{tooltip.name}</span>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col bg-[var(--sidebar)] border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>
    </>
  );
};
