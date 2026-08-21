import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, X, KeyRound } from 'lucide-react';
import axios from 'axios';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

  // Forgot Password modal states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: forgotEmail,
      });
      if (response.data?.success) {
        setForgotStep(2);
      } else {
        setForgotError(response.data?.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      setForgotError(
        err.response?.data?.message || 'No active account found with this email.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        email: forgotEmail,
        otp,
        newPassword,
      });
      if (response.data?.success) {
        setForgotStep(3);
      } else {
        setForgotError(response.data?.message || 'Failed to reset password. Please try again.');
      }
    } catch (err: any) {
      setForgotError(
        err.response?.data?.message || 'Invalid or expired OTP. Please check and try again.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Basic client-side validation
      if (!email.trim()) {
        throw new Error('Please enter your email address or phone number.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      // Real login endpoint call
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data.data;

      // Save tokens and user details in localStorage
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));

      navigate('/');
    } catch (err: any) {
      const serverMessage = err.response?.data?.message || err.message || 'Authentication failed.';
      setError(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080b11] overflow-hidden px-4">
      {/* Background radial gradients for glowing aesthetic */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-500/10 blur-[120px] animate-pulse-slow"></div>

      <div className="w-full max-w-md z-10">
        {/* Brand / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center font-black text-white text-2xl tracking-wider shadow-lg shadow-indigo-500/25 mb-4">
            Ω
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            Finance & HR Portal
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            Company Management & Financial Control Center
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel-glow rounded-2xl p-8 bg-card-dark/40">
          <h3 className="text-lg font-bold text-white mb-6">Sign In</h3>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email or Phone Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Email or Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all outline-none"
                  placeholder="name@acme.com or +91 987..."
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer bg-transparent border-0 outline-none p-0"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600 hover:shadow-indigo-500/30 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl p-6 shadow-2xl relative text-left text-white">
            <button 
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
                setForgotEmail('');
                setOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setForgotError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {forgotStep === 1 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-500" />
                  Forgot Password
                </h3>
                <p className="text-xs text-gray-400 mb-6 font-normal">
                  Enter your registered email address below, and we will send you a 6-digit One-Time Password (OTP) to reset your password.
                </p>

                {forgotError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="block w-full pl-10 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Send OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 2 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-500" />
                  Reset Password
                </h3>
                <p className="text-xs text-gray-400 mb-6 font-normal">
                  We have sent a 6-digit OTP to <strong>{forgotEmail}</strong>. Please enter the OTP and your new password to complete the reset.
                </p>

                {forgotError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
                    {forgotError}
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* OTP Code */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      6-Digit OTP
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="block w-full px-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm text-center font-bold tracking-widest transition-all outline-none"
                    />
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-4 py-3 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-gray-500 text-sm transition-all outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Resetting Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 3 && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <ArrowRight className="w-6 h-6 rotate-[-45deg]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Password Reset Successfully!
                </h3>
                <p className="text-xs text-gray-400 mb-6 font-normal">
                  Your password has been reset. You can now close this window and log in with your new password.
                </p>
                <button
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStep(1);
                    setForgotEmail('');
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setForgotError('');
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Close & Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
