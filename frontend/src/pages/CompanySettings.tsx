import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Building2, Phone, Mail, MapPin, FileText, Upload, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

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
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
        setLogoPreview(`http://localhost:5000/${data.logo}`);
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
        setLogoPreview(`http://localhost:5000/${response.data.data.logo}?t=${Date.now()}`);
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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Company Branding & Profile</h1>
            <p className="text-sm text-gray-400 mt-1">
              Configure company name, phone, address, and logo for printed vouchers and salary slips.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form Card */}
      <div className="bg-[#121826]/90 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-sm text-emerald-400">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Logo Section */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/5 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
              Company Logo (For Vouchers & Salary Slips)
            </label>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 bg-black/40 flex items-center justify-center overflow-hidden relative group">
                {logoPreview ? (
                  <img src={logoPreview} alt="Company Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <Building2 className="w-8 h-8 text-gray-600" />
                )}
              </div>

              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs font-bold cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>Upload New Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </label>
                <p className="text-[11px] text-gray-500">
                  Recommended size: PNG or JPG with transparent/white background.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Company Name *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/10 focus:border-indigo-500 text-white text-sm outline-none"
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Company Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/10 focus:border-indigo-500 text-white text-sm outline-none"
                  placeholder="e.g. +91 9876543210"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Company Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/10 focus:border-indigo-500 text-white text-sm outline-none"
                  placeholder="e.g. contact@acmecorp.com"
                />
              </div>
            </div>

            {/* GSTIN / Tax ID */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                GSTIN / Tax Registration No.
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/10 focus:border-indigo-500 text-white text-sm outline-none"
                  placeholder="e.g. 07AAAAA0000A1Z5"
                />
              </div>
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Company Office Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/10 focus:border-indigo-500 text-white text-sm outline-none resize-none"
                  placeholder="e.g. Plot 123, Tech Park, Phase 1, New Delhi - 110001"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={saveLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Company Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
