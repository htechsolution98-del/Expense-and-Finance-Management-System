import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const refreshProfile = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.success && response.data?.data?.user) {
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
          // Notify Sidebar instantly — no logout needed after permission changes
          window.dispatchEvent(new Event('user-permissions-updated'));
        }
      } catch (err) {
        // Silently catch refresh failures
      }
    };
    refreshProfile();
  }, [location.pathname]);

  // Determine header title based on current path
  const getHeaderTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Financial Control Dashboard';
      case '/users':
        return 'User Directory & Access Control';
      case '/expenses':
        return 'Staff Expenses & Claims';
      case '/salaries':
        return 'Payroll Management';
      case '/employees':
        return 'Employees Directory';
      case '/ledger':
        return 'Unified Ledger Transactions';
      default:
        return 'Finance Management Portal';
    }
  };

  return (
    <div className="flex w-screen min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title={getHeaderTitle(location.pathname)} />

        <main className="flex-1 p-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-[var(--footer-bg)] text-[var(--footer-text)] px-8 py-6 border-t border-slate-800 text-center text-xs font-semibold mt-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <span>© {new Date().getFullYear()} Antigravity Financial Control Portal. All rights reserved.</span>
            </div>
            <div className="flex gap-4">
              <a href="#" className="text-[var(--primary)] hover:underline">Privacy Policy</a>
              <span className="text-slate-700">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Terms of Service</a>
              <span className="text-slate-700">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Support Desk</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
