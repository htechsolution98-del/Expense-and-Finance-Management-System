import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Building, Bell } from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { email: 'admin@company.com', role: 'SUPER_ADMIN' };

  const [companyInfo, setCompanyInfo] = useState<{ name: string; currency: string } | null>(null);

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

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--header-bg)] border-b border-[var(--header-border)] px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Dynamic Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
      </div>

      {/* Quick Menu */}
      <div className="flex items-center gap-6">
        {/* Dynamic Company Status */}
        <div 
          onClick={() => navigate('/settings')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-[var(--primary)] font-semibold shadow-inner cursor-pointer hover:bg-emerald-100 transition-colors"
          title="Go to Company Settings"
        >
          <Building className="w-3.5 h-3.5" />
          <span>
            {companyInfo?.name && companyInfo.name !== '' ? companyInfo.name : 'Set Company Name'}{' '}
            {companyInfo?.currency ? `(${companyInfo.currency})` : ''}
          </span>
        </div>

        {/* Notifications Icon Placeholder */}
        <button className="relative p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--primary)]"></span>
        </button>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* User Account / Profile */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/10">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-semibold leading-none text-slate-900">
              {user.name || user.email.split('@')[0]}
            </p>
            <p className="text-[10px] font-semibold leading-none text-[var(--primary)] mt-1 uppercase tracking-wider">
              {user.role}
            </p>
          </div>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer ml-2"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
