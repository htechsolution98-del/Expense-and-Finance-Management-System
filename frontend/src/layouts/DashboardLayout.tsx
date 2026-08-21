import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      case '/loans':
        return 'Business Loans & Udhaar Ledger';
      default:
        return 'Finance Management Portal';
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
          onMenuClick={() => setIsSidebarOpen(true)} 
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-[var(--card)] text-[var(--text-secondary)] px-8 py-5 border-t border-[var(--card-border)] text-center text-xs font-semibold mt-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <span>© {new Date().getFullYear()} KaryaNiyantrak Financial Control Portal. All rights reserved.</span>
            </div>
            <div className="flex gap-4">
              <a href="#" className="text-[var(--primary)] hover:underline">Privacy Policy</a>
              <span className="text-slate-300">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Terms of Service</a>
              <span className="text-slate-300">|</span>
              <a href="#" className="text-[var(--primary)] hover:underline">Support Desk</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
