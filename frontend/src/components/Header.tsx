import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Building, Bell, Key, X, Menu } from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { email: 'admin@company.com', role: 'SUPER_ADMIN' };

  const [companyInfo, setCompanyInfo] = useState<{ name: string; currency: string } | null>(null);

  // Password change modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSubmittingPassword(true);
    try {
      const response = await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      if (response.data?.success || response.data?.status === 'success') {
        setPasswordSuccess('Password updated successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setShowPasswordModal(false), 2000);
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--header-bg)] border-b border-[var(--header-border)] px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Hamburger menu button for mobile screens */}
      {onMenuClick && (
        <button 
          onClick={onMenuClick}
          className="lg:hidden mr-4 p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Dynamic Title */}
      <div className="min-w-0 flex-1 mr-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">{title}</h1>
      </div>

      {/* Quick Menu */}
      <div className="flex items-center gap-6">
        {/* Dynamic Company Status */}
        <div 
          onClick={() => navigate('/settings')}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--primary-light)] border border-[var(--primary-light)] text-xs text-[var(--primary)] font-semibold shadow-inner cursor-pointer hover:opacity-90 transition-opacity"
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
            onClick={() => {
              setPasswordError('');
              setPasswordSuccess('');
              setShowPasswordModal(true);
            }}
            title="Change Password"
            className="p-2 text-slate-400 hover:text-[var(--primary)] rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ml-2"
          >
            <Key className="w-5 h-5" />
          </button>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer ml-2"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <button 
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--primary)]" />
              Change Password
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Update your account password. Make sure it's secure.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <input 
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="Enter new password (min. 6 chars)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-950 outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">
                  {passwordSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingPassword}
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-xl py-3 font-bold transition-colors cursor-pointer mt-2 shadow-md shadow-emerald-600/10"
              >
                {submittingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
