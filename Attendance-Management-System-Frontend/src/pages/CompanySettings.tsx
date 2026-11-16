import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getBackendUrl } from '../services/api';
import { Building2, Phone, Mail, MapPin, FileText, Upload, Save, CheckCircle, AlertCircle, Loader2, Key, X, Lock, LogOut } from 'lucide-react';

interface CompanyProfile {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo: string | null;
  gstin: string | null;
  timezone: string;
  currency: string;
}

export const CompanySettings: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('switch_company_id');
    navigate('/login');
  };

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

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

  const fetchCompanyProfile = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.get('/company');
      const data: CompanyProfile = response.data.data;
      setProfile(data);
      setName(data.name || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setAddress(data.address || '');
      setGstin(data.gstin || '');
      if (data.logo) {
        setLogoPreview(`${getBackendUrl()}/${data.logo}`);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load company profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('address', address);
      formData.append('gstin', gstin);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const response = await api.put('/company', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfile(response.data.data);
      if (response.data.data.logo) {
        setLogoPreview(`${getBackendUrl()}/${response.data.data.logo}?t=${Date.now()}`);
      }
      window.dispatchEvent(new Event('company-profile-updated'));
      setSuccessMsg('Company profile and logo updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update company profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Company Branding & Profile</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
              Configure company name, phone, address, and logo for printed vouchers and salary slips.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setPasswordError('');
              setPasswordSuccess('');
              setShowPasswordModal(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-500/15 text-center"
          >
            <Key className="w-4 h-4 shrink-0" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-red-600/15 text-center"
            title="Log out of your account"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Profile Form Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-3 sm:p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs sm:text-sm text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs sm:text-sm text-emerald-700">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Logo Section */}
          <div className="p-4 sm:p-6 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 sm:space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Company Logo (For Vouchers & Salary Slips)
            </label>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative group shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-400" />
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold cursor-pointer transition shadow-md shadow-emerald-500/15">
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Upload New Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                <p className="text-[11px] text-slate-500">
                  Recommended size: PNG or JPG with transparent/white background.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Company Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-800 text-sm outline-none transition-all"
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Company Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-800 text-sm outline-none transition-all"
                  placeholder="e.g. +91 9876543210"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Company Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-800 text-sm outline-none transition-all"
                  placeholder="e.g. contact@acmecorp.com"
                />
              </div>
            </div>

            {/* GSTIN / Tax ID */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                GSTIN / Tax Registration No.
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-800 text-sm outline-none transition-all"
                  placeholder="e.g. 07AAAAA0000A1Z5"
                />
              </div>
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Company Office Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-4 top-3 sm:top-3.5" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 text-slate-800 text-sm outline-none resize-none transition-all"
                  placeholder="e.g. Plot 123, Tech Park, Phase 1, New Delhi - 110001"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saveLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 text-center"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 shrink-0" />
                  <span>Save Company Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Account Security & Password Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Account Security & Password</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your administrative login credentials and update password.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setPasswordError('');
                setPasswordSuccess('');
                setShowPasswordModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-500/15 text-center"
            >
              <Key className="w-4 h-4 shrink-0" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-red-600/15 text-center"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl text-left">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <Key className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">Change Account Password</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Update your account password. Make sure it's secure.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Current Password
                  </label>
                  <input 
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none transition-colors"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none transition-colors"
                    placeholder="Enter new password (min. 6 chars)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 rounded-xl px-4 py-2.5 text-slate-800 text-sm outline-none transition-colors"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 sm:flex sm:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="w-full sm:w-auto bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-xl px-6 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-md shadow-emerald-500/20 text-center"
                >
                  {submittingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettings;
