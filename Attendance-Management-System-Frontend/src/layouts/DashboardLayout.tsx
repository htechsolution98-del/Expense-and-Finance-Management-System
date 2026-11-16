import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { api } from '../services/api';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { ShieldCheck, X } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : {};
  });
  const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  // Reset scroll and keep bottom nav visible whenever route changes
  useEffect(() => {
    setIsBottomNavVisible(true);
    lastScrollY.current = 0;
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Window scroll fallback for devices where document scrolls
  useEffect(() => {
    const handleWindowScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const diff = currentScrollY - lastScrollY.current;
      if (currentScrollY <= 20) {
        setIsBottomNavVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }
      if (Math.abs(diff) > 8) {
        if (diff > 0) {
          setIsBottomNavVisible(false);
        } else {
          setIsBottomNavVisible(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const handleMainScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    const currentScrollY = target.scrollTop;
    const diff = currentScrollY - lastScrollY.current;

    // Always visible near top
    if (currentScrollY <= 20) {
      setIsBottomNavVisible(true);
      lastScrollY.current = currentScrollY;
      return;
    }

    // Always visible near bottom of content so actions are accessible
    const isNearBottom = target.scrollHeight - currentScrollY - target.clientHeight <= 40;
    if (isNearBottom) {
      setIsBottomNavVisible(true);
      lastScrollY.current = currentScrollY;
      return;
    }

    // Significant scroll movement check to prevent twitching
    if (Math.abs(diff) > 8) {
      if (diff > 0) {
        // Scrolling down into content (swiping up) -> Hide menu
        setIsBottomNavVisible(false);
      } else {
        // Scrolling up towards top (swiping down) -> Show menu
        setIsBottomNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        const updatedUser = response.data.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
        // Notify Sidebar instantly — no logout needed after permission changes
        window.dispatchEvent(new Event('user-permissions-updated'));
      }
    } catch (err) {
      // Silently catch refresh failures
    }
  };

  useEffect(() => {
    refreshProfile();
  }, [location.pathname]);

  const handleSubscriptionSuccess = () => {
    refreshProfile();
  };

  // Determine if company subscription has expired
  const isMasterCompany = currentUser.companyId === '00000000-0000-0000-0000-000000000000';
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  
  const isSubscriptionExpired = (() => {
    // Root company and Super Admins are always exempt
    if (isMasterCompany || isSuperAdmin) return false;
    
    const { subscriptionStatus, trialEndsAt, subscriptionEndsAt } = currentUser;
    if (!subscriptionStatus) return false; // Fail-safe
    
    const now = new Date();
    if (subscriptionStatus === 'ACTIVE') {
      // If subscription ends in future, or has no expiration (perpetual license), it is active
      if (!subscriptionEndsAt || new Date(subscriptionEndsAt) > now) {
        return false;
      }
    } else if (subscriptionStatus === 'TRIAL') {
      // If trial ends in future or is unconstrained
      if (!trialEndsAt || new Date(trialEndsAt) > now) {
        return false;
      }
    }
    
    return true;
  })();

  // Determine header title based on current path
  const getHeaderTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return '';
      case '/announcements':
        return 'Company Announcements';
      case '/users':
        return 'User Directory';
      case '/leaves':
        return 'Leave Management';
      case '/attendance':
        return 'Attendance Management';
      case '/attendance-config':
        return 'Attendance Settings';
      case '/accounts':
        return 'Bank & Cash Accounts';
      case '/payment-categories':
        return 'Payment Categories';
      case '/approval-rules':
        return 'Approval Rules';
      case '/company-settings':
        return 'Company Settings';
      case '/payments':
        return 'Payments & Inflow';
      case '/loans':
        return 'Business Loans';
      case '/ledger':
        return 'Unified Ledger';
      case '/reports':
        return 'Financial Reports';
      case '/audit':
        return 'Audit History';
      case '/expenses':
        return 'Staff Expenses & Claims';
      case '/vouchers':
        return 'Vouchers Management';
      case '/salaries':
        return 'Salary Structures';
      case '/payrolls':
        return 'Payroll Management';
      case '/advances':
        return 'Employee Advances';
      case '/employees':
        return 'Employees Directory';
      case '/master-dashboard':
        return 'Master Dashboard';
      default:
        return 'Company Portal';
    }
  };

  return (
    <div className="flex w-full h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header 
          title={getHeaderTitle(location.pathname)} 
          onMenuClick={() => {
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(true);
            } else {
              window.dispatchEvent(new CustomEvent('toggle-sidebar-collapse'));
            }
          }} 
        />

        <main 
          ref={mainRef}
          onScroll={handleMainScroll}
          className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-y-auto pb-28 md:pb-8"
        >
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar - 5 Options (4 Role-specific + More) */}
        <BottomNav 
          user={currentUser} 
          onOpenSidebar={() => setIsSidebarOpen(true)} 
          isVisible={isBottomNavVisible}
        />

        {/* Render overlay modal blocking standard workspace operations if expired */}
        {isSubscriptionExpired && (
          <SubscriptionModal 
            companyName={currentUser.companyName || 'your company'} 
            onSuccess={handleSubscriptionSuccess} 
          />
        )}

        {/* Footer: Hidden on mobile devices */}
        <footer className="hidden sm:block bg-[var(--card)] text-[var(--text-secondary)] px-8 py-4 border-t border-[var(--card-border)] text-xs font-semibold mt-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-left">
              <span>© {new Date().getFullYear()} KaryaNiyantrak Financial Control Portal. All rights reserved.</span>
            </div>

            {/* Center Privacy Policy & Links */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-[var(--primary)] hover:underline font-semibold text-xs cursor-pointer bg-transparent border-0 p-0"
              >
                Privacy Policy
              </button>
              <span className="text-slate-300">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Terms of Service</a>
              <span className="text-slate-300">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Support Desk</a>
            </div>

            <div className="hidden md:block w-32"></div>
          </div>
        </footer>

        {/* Privacy Policy Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-left max-h-[85vh] flex flex-col">
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Privacy Policy</h3>
              </div>

              <div className="overflow-y-auto space-y-4 text-xs text-slate-600 pr-2">
                <p>
                  KaryaNiyantrak Financial Control Portal is committed to protecting your organizational and personal financial data.
                </p>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">1. Information Collection & Usage</h4>
                  <p>
                    We collect company profile information, financial ledger data, employee details, and attendance records solely to provide financial accounting, payroll calculations, and organizational workflow management.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">2. Data Security & Multi-Tenant Isolation</h4>
                  <p>
                    All company data is strictly isolated using cryptographic tenant scoping. Ledger records, payroll distributions, and employee personal information are encrypted in transit and at rest.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">3. Confidentiality</h4>
                  <p>
                    We do not sell, rent, or share proprietary company accounting data or employee personal documents with unauthorized third parties.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">4. Contact & Support</h4>
                  <p>
                    For questions regarding data privacy and security practices, please contact your company administrator or our support desk.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
