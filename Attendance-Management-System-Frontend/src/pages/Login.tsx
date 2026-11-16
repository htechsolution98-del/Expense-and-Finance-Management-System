import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Loader2,
  LogIn,
  Eye,
  EyeOff,
  X,
  KeyRound,
  AlertCircle,
  CalendarCheck,
  MapPin,
  Users,
  BarChart3
} from 'lucide-react';
import axios from 'axios';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me') === 'true';
  });
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

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Auto-fill saved email if remember me was enabled
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

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
      if (!email.trim()) {
        throw new Error('Please enter your email address or phone number.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data.data;

      // Persist remember me preferences
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
        localStorage.setItem('saved_email', email);
      } else {
        localStorage.removeItem('remember_me');
        localStorage.removeItem('saved_email');
      }

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
    <div className="min-h-screen w-full bg-[#08131d] text-[#eaf3ee] font-sans select-none">
      {/* Dynamic Keyframes & Helper Styles */}
      <style>{`
        @keyframes float-chip-1 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
          }
          50% {
            transform: translateY(-14px) rotate(0.8deg);
            box-shadow: 0 24px 38px rgba(0,0,0,0.42);
          }
        }
        @keyframes float-chip-2 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
          }
          50% {
            transform: translateY(-12px) rotate(-0.8deg);
            box-shadow: 0 22px 36px rgba(0,0,0,0.4);
          }
        }
        .animate-float-1 {
          animation: float-chip-1 3.6s ease-in-out infinite;
        }
        .animate-float-2 {
          animation: float-chip-2 4.2s ease-in-out infinite 0.6s;
        }
        @keyframes radar-ripple {
          0% {
            transform: scale(0.32);
            opacity: 0.85;
            stroke-width: 2.5px;
          }
          55% {
            opacity: 0.45;
            stroke-width: 2px;
          }
          100% {
            transform: scale(1.08);
            opacity: 0;
            stroke-width: 1px;
          }
        }
        @keyframes radar-dash-rotate {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -32; }
        }
        @keyframes radar-sweep-beam {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pin-ping {
          0% { transform: scale(0.6); opacity: 0.85; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes outside-ping {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes fence-breathe {
          0%, 100% { opacity: 0.82; }
          50% { opacity: 1; }
        }
        .animate-ripple-1 {
          transform-origin: 300px 210px;
          animation: radar-ripple 6s cubic-bezier(0.16, 1, 0.3, 1) infinite 0s;
        }
        .animate-ripple-2 {
          transform-origin: 300px 210px;
          animation: radar-ripple 6s cubic-bezier(0.16, 1, 0.3, 1) infinite 2s;
        }
        .animate-ripple-3 {
          transform-origin: 300px 210px;
          animation: radar-ripple 6s cubic-bezier(0.16, 1, 0.3, 1) infinite 4s;
        }
        .animate-sweep-beam {
          transform-origin: 300px 210px;
          animation: radar-sweep-beam 11s linear infinite;
        }
        .animate-radar-dash {
          animation: radar-dash-rotate 16s linear infinite;
        }
        .animate-fence-breathe {
          animation: fence-breathe 4.5s ease-in-out infinite;
        }
        .animate-pin-ping {
          transform-origin: center;
          transform-box: fill-box;
          animation: pin-ping 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        .animate-outside-ping {
          transform-origin: center;
          transform-box: fill-box;
          animation: outside-ping 3.6s ease-out infinite;
        }
        @keyframes mobile-radar-pulse {
          0% { transform: scale(0.5); opacity: 0.75; }
          100% { transform: scale(1.02); opacity: 0; }
        }
        @keyframes pin-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-mobile-radar-pulse {
          transform-origin: 170px 130px;
          animation: mobile-radar-pulse 4.5s ease-out infinite;
        }
        .animate-pin-bob {
          transform-box: fill-box;
          transform-origin: center;
          animation: pin-bob 3.6s ease-in-out infinite;
        }
        .login-input::placeholder {
          color: #627d98 !important;
          opacity: 1 !important;
        }
      `}</style>

      {/* ========================================================= */}
      {/* 1. DESKTOP VIEW (Screens >= 1024px) - Strictly 100vh Fits */}
      {/* ========================================================= */}
      <div className="hidden lg:grid h-screen max-h-screen w-full grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] overflow-hidden">
        {/* Left Hero Section */}
        <section className="relative bg-[#0b1b2b] overflow-hidden h-screen max-h-screen flex flex-col justify-between p-6 xl:p-10 select-none">
          {/* Brand Header with Official Logo */}
          <div className="relative z-20 flex items-center select-none">
            <img
              src="/karyaniyantrak-logo-white.png"
              alt="KaryaNiyantrak"
              className="h-20 xl:h-22 w-auto max-w-[290px] xl:max-w-[320px] object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)] transition-all"
            />
          </div>

          {/* Interactive Radar Map SVG - Perfectly Proportioned, No 100m text */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 440" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <radialGradient id="fence">
                <stop offset="0" stopColor="#22c55e" stopOpacity=".4" />
                <stop offset="1" stopColor="#22c55e" stopOpacity=".08" />
              </radialGradient>
              <linearGradient id="bd" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22c55e" />
                <stop offset="#065f46" />
              </linearGradient>
              <linearGradient id="sweepFan" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4ade80" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#22c55e" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
              <filter id="beamGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g stroke="#17324a" strokeWidth="12" strokeLinecap="round" fill="none">
              <path d="M-20 110H640M-20 210H640M-20 310H640" />
              <path d="M120 -20V460M300 -20V460M480 -20V460" />
              <path d="M-20 400L300 210L640 60" strokeWidth="6" />
            </g>
            <g fill="#10263a">
              <rect x="140" y="130" width="60" height="60" rx="8" />
              <rect x="220" y="130" width="60" height="60" rx="8" />
              <rect x="320" y="130" width="70" height="60" rx="8" />
              <rect x="410" y="130" width="50" height="60" rx="8" />
              <rect x="140" y="230" width="60" height="65" rx="8" />
              <rect x="410" y="230" width="50" height="65" rx="8" />
              <rect x="490" y="230" width="50" height="65" rx="8" />
            </g>

            {/* Rotating Radar Sweep Beam with Glow */}
            <g className="animate-sweep-beam">
              <path d="M300,210 L425,210 A125,125 0 0,0 400,132 Z" fill="url(#sweepFan)" />
              <line x1="300" y1="210" x2="425" y2="210" stroke="#86efac" strokeWidth="2.5" opacity="0.9" filter="url(#beamGlow)" />
            </g>

            {/* Outer Geofence Radius with Animated Dash-Crawl & Subtle Breathing Fill */}
            <circle
              className="animate-fence-breathe"
              cx="300"
              cy="210"
              r="125"
              fill="url(#fence)"
            />
            <circle
              className="animate-radar-dash"
              cx="300"
              cy="210"
              r="125"
              fill="none"
              stroke="#4ade80"
              strokeWidth="2"
              strokeDasharray="8 8"
            />

            {/* Continuous 3-Stage Multi-Wave Ripple Pulses */}
            <circle className="animate-ripple-1" cx="300" cy="210" r="125" fill="none" stroke="#4ade80" strokeWidth="2.5" />
            <circle className="animate-ripple-2" cx="300" cy="210" r="125" fill="none" stroke="#22c55e" strokeWidth="2" />
            <circle className="animate-ripple-3" cx="300" cy="210" r="125" fill="none" stroke="#86efac" strokeWidth="1.5" />

            {/* Static Distance Grid Rings */}
            <circle cx="300" cy="210" r="85" fill="none" stroke="#4ade80" strokeOpacity=".3" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="300" cy="210" r="45" fill="none" stroke="#4ade80" strokeOpacity=".2" strokeWidth="1.2" />

            {/* Center Office Building */}
            <g transform="translate(300 210)">
              <rect x="-28" y="-38" width="56" height="70" rx="8" fill="url(#bd)" />
              <g fill="#bbf7d0">
                <rect x="-18" y="-28" width="10" height="10" rx="2" />
                <rect x="-4" y="-28" width="10" height="10" rx="2" />
                <rect x="10" y="-28" width="10" height="10" rx="2" />
                <rect x="-18" y="-12" width="10" height="10" rx="2" />
                <rect x="-4" y="-12" width="10" height="10" rx="2" />
                <rect x="10" y="-12" width="10" height="10" rx="2" />
              </g>
              <rect x="-8" y="8" width="16" height="24" rx="2.5" fill="#0b1b2b" />
            </g>

            {/* Inside Pin Marker with Live GPS Sonar Ping */}
            <g transform="translate(342 245)">
              <circle className="animate-pin-ping" r="10" fill="none" stroke="#4ade80" strokeWidth="1.5" />
              <g className="animate-pin-bob">
                <circle r="16" fill="#4ade80" fillOpacity=".25" />
                <path d="M0 10C-7 0-10-3-10-8a10 10 0 0 1 20 0c0 5-3 8-10 18Z" fill="#fff" />
                <circle cy="-8" r="3.8" fill="#0f9d58" />
              </g>
            </g>

            {/* Outside Marker with Subtle Idle Ping */}
            <g transform="translate(440 120)">
              <circle className="animate-outside-ping" r="8" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
              <circle r="12" fill="#94a3b8" fillOpacity=".25" />
              <circle r="5" fill="#94a3b8" />
            </g>
          </svg>

          {/* Floating Callout Chip 1: Inside radius */}
          <div className="absolute left-[16%] xl:left-[18%] top-[58%] xl:top-[56%] z-10 bg-white/95 text-[#0b1b2b] rounded-2xl px-3 py-2 text-xs font-medium shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-2 animate-float-2 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0f9d58] shadow-[0_0_0_4px_rgba(15,157,88,0.25)] shrink-0" />
            <div>
              <div className="font-semibold text-xs text-[#0b1b2b]">Inside office radius</div>
              <div className="text-[10px] text-[#5b6b78] font-normal">Check-in enabled · 42 m away</div>
            </div>
          </div>

          {/* Floating Callout Chip 2: Outside radius */}
          <div className="absolute right-[20%] xl:right-[22%] top-[18%] xl:top-[20%] z-10 bg-white/95 text-[#0b1b2b] rounded-2xl px-3 py-2 text-xs font-medium shadow-[0_10px_25px_rgba(0,0,0,0.3)] flex items-center gap-2 animate-float-1 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] shadow-[0_0_0_4px_rgba(148,163,184,0.25)] shrink-0" />
            <div>
              <div className="font-semibold text-xs text-[#0b1b2b]">Outside radius</div>
              <div className="text-[10px] text-[#5b6b78] font-normal">Check-in blocked</div>
            </div>
          </div>

          {/* Vertical Wavy Curve Divider separating Left Hero and Right Form */}
          <div className="absolute top-0 right-0 bottom-0 w-12 xl:w-16 h-full pointer-events-none z-20 overflow-hidden translate-x-[1px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 1000"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M30,0 C80,200 10,380 65,550 C105,700 20,860 45,1000 L100,1000 L100,0 Z"
                fill="#10b981"
                fillOpacity="0.08"
              />
              <path
                d="M34,0 C84,200 14,380 69,550 C109,700 24,860 49,1000"
                stroke="#10b981"
                strokeOpacity="0.3"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M38,0 C88,200 18,380 73,550 C113,700 28,860 53,1000 L100,1000 L100,0 Z"
                fill="#08131d"
              />
            </svg>
          </div>

          {/* Pitch Text at Bottom */}
          <div className="relative z-20 text-white max-w-lg mt-auto pt-3 pb-1">
            <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight leading-tight mb-1 drop-shadow-md" style={{ color: '#ffffff' }}>Check in only where you work.</h2>
            <p className="text-slate-300 text-xs xl:text-sm leading-relaxed drop-shadow">Staff mark attendance from their phone, and only when they are inside the office radius you set.</p>
          </div>
        </section>

        {/* Right Form Main Area - Fits Viewport with Zero Scrolling */}
        <div className="flex items-center justify-center p-4 lg:p-6 xl:p-8 bg-[#08131d] h-screen max-h-screen relative overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-1/4 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="w-full max-w-[460px] xl:max-w-[480px] relative z-10">
            {/* Glassmorphic Box */}
            <div className="relative rounded-3xl bg-[#0c1626]/90 border border-slate-700/60 p-6 sm:p-7 xl:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl">
              {/* Top ambient highlight line */}
              <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

              <div className="mb-4">
                <h1 className="text-2xl xl:text-3xl font-extrabold tracking-tight mb-1" style={{ color: '#ffffff' }}>
                  Welcome back
                </h1>
                <p className="text-slate-300 text-xs xl:text-sm font-medium">
                  Log in to mark and manage attendance.
                </p>
              </div>

              {error && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email or phone number
                  </label>
                  <div className="relative rounded-xl bg-[#0e1f2e] border border-[#24394b] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#627d98] pointer-events-none" />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email or phone number"
                      className="w-full bg-transparent pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-[#eaf3ee] placeholder-[#627d98] outline-none login-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative rounded-xl bg-[#0e1f2e] border border-[#24394b] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#627d98] pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-transparent pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-[#eaf3ee] placeholder-[#627d98] outline-none login-input"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#627d98] hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#111c2e] border-[#1e2f47] text-emerald-600 focus:ring-emerald-500/30 accent-emerald-600 cursor-pointer"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('');
                      setShowForgotModal(true);
                    }}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer bg-transparent border-0 p-0"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 hover:shadow-emerald-600/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                  style={{ color: '#ffffff' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span style={{ color: '#ffffff' }}>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 text-white" />
                      <span style={{ color: '#ffffff' }}>Log in</span>
                    </>
                  )}
                </button>
              </form>

              {/* 4 Feature Badges with Hover Effects */}
              <div className="mt-4 pt-3.5 border-t border-slate-800/80">
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  <div className="group flex flex-col items-center text-center p-1.5 rounded-lg transition-all duration-200 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 hover:scale-105 cursor-pointer border border-transparent">
                    <CalendarCheck className="w-5 h-5 text-emerald-400 mb-1 transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white leading-tight">
                      Track<br />attendance
                    </span>
                  </div>

                  <div className="group flex flex-col items-center text-center p-1.5 rounded-lg transition-all duration-200 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 hover:scale-105 cursor-pointer border border-transparent">
                    <MapPin className="w-5 h-5 text-emerald-400 mb-1 transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white leading-tight">
                      Geo-fencing<br />and location
                    </span>
                  </div>

                  <div className="group flex flex-col items-center text-center p-1.5 rounded-lg transition-all duration-200 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 hover:scale-105 cursor-pointer border border-transparent">
                    <Users className="w-5 h-5 text-emerald-400 mb-1 transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white leading-tight">
                      Manage<br />staff
                    </span>
                  </div>

                  <div className="group flex flex-col items-center text-center p-1.5 rounded-lg transition-all duration-200 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 hover:scale-105 cursor-pointer border border-transparent">
                    <BarChart3 className="w-5 h-5 text-emerald-400 mb-1 transition-all group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white leading-tight">
                      Reports and<br />analytics
                    </span>
                  </div>
                </div>

                {/* Enterprise Security Assurance */}
                <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-lg py-1 px-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>Encrypted Attendance • 99.9% Geofence Accuracy • Tamper-proof GPS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MOBILE VIEW (Screens < 1024px) - Non-clipped Hero & Logo */}
      {/* ========================================================= */}
      <div className="lg:hidden min-h-screen w-full flex items-center justify-center p-0 sm:p-4 text-[#eaf3ee]" style={{ background: 'radial-gradient(1200px 600px at 50% -10%, #16344d, #0b1b2b)' }}>
        <div className="w-full max-w-[440px] bg-[#0e1f2e] sm:rounded-[30px] overflow-hidden shadow-2xl shadow-black/60 border border-[#24394b] flex flex-col min-h-screen sm:min-h-0">
          
          {/* Top Hero Banner with Exact Animated Radar & Wave Curve - Matches Image 1 */}
          <div className="relative h-[250px] sm:h-[260px] bg-[#0e1f2e] shrink-0 overflow-hidden">
            <svg className="w-full h-full block" viewBox="0 0 360 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="hb-mob" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#044d37" />
                  <stop offset=".55" stopColor="#0b8a52" />
                  <stop offset="1" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <rect width="360" height="250" fill="url(#hb-mob)" />
              
              {/* Street Grid */}
              <g stroke="#fff" strokeOpacity=".1" strokeWidth="8" strokeLinecap="round" fill="none">
                <path d="M-10 60H370M-10 135H370M-10 210H370M60 -10V260M165 -10V260M270 -10V260" />
              </g>
              
              {/* Radar Circles with Pulse Animation */}
              <circle cx="165" cy="135" r="105" fill="#fff" fillOpacity=".1" stroke="#bbf7d0" strokeWidth="2" strokeDasharray="6 6" />
              <circle className="animate-mobile-radar-pulse" cx="165" cy="135" r="105" fill="none" stroke="#bbf7d0" strokeWidth="2.5" />
              <circle cx="165" cy="135" r="60" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.5" />
              <circle cx="165" cy="135" r="30" fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="1" />
              
              {/* Center Office Building */}
              <g transform="translate(165 135)">
                <rect x="-24" y="-34" width="48" height="66" rx="8" fill="#0b1b2b" />
                <g fill="#86efac">
                  <rect x="-16" y="-24" width="10" height="10" rx="2" />
                  <rect x="6" y="-24" width="10" height="10" rx="2" />
                  <rect x="-16" y="-8" width="10" height="10" rx="2" />
                  <rect x="6" y="-8" width="10" height="10" rx="2" />
                </g>
                <rect x="-6" y="14" width="12" height="18" rx="2" fill="#16a34a" />
              </g>

              {/* User Location Pin */}
              <g transform="translate(118 190)">
                <g className="animate-pin-bob">
                  <circle r="16" fill="#fff" fillOpacity=".25" />
                  <path d="M0 11C-8 1-10-3-10-8a10 10 0 0 1 20 0c0 5-2 9-10 19Z" fill="#fff" />
                  <circle cy="-8" r="3.6" fill="#0f9d58" />
                </g>
              </g>

              {/* Phone Device Illustration with Check In - Prominent and Large, Matches Image 1 */}
              <g transform="translate(236 18) rotate(7.5 45 90)">
                <rect width="90" height="178" rx="18" fill="#0b1b2b" />
                <rect x="4" y="4" width="82" height="170" rx="14" fill="#fff" />
                <rect x="29" y="8" width="28" height="6" rx="3" fill="#0b1b2b" />
                <circle cx="43" cy="58" r="26" fill="#dcfce7" />
                <path d="M43 74C35 64 33 60 33 55a10 10 0 0 1 20 0c0 5-2 9-10 19Z" fill="#0f9d58" />
                <circle cx="43" cy="55" r="3.5" fill="#fff" />
                <text x="43" y="103" textAnchor="middle" fontSize="9.5" fontFamily="Outfit,sans-serif" fill="#5b6b78" fontWeight="600">Inside radius</text>
                <rect x="13" y="112" width="60" height="24" rx="12" fill="#16a34a" />
                <text x="43" y="128" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Outfit,sans-serif" fill="#fff">Check in</text>
              </g>

              {/* The Bottom Curve Wave (Fills with exact card background #0e1f2e) */}
              <path d="M0 250 V210 C80 248 175 195 260 225 C315 245 345 232 360 220 V250 Z" fill="#0e1f2e" />
            </svg>
          </div>

          {/* Form Content */}
          <div className="px-6 pt-0 pb-4 flex-1 flex flex-col justify-between">
            {/* Official Brand Logo - Prominently Sized & Crisp White on Dark Theme */}
            <div className="flex flex-col items-center justify-center pt-2 pb-3 px-2 select-none">
              <img
                src="/karyaniyantrak-logo-white.png"
                alt="KaryaNiyantrak"
                className="w-[230px] sm:w-[260px] h-auto max-h-[85px] object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email or Phone Input with Mail Icon */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a6b3] pointer-events-none" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email or phone number"
                  aria-label="Email or phone number"
                  className="w-full h-[50px] rounded-2xl bg-[#0e1f2e] border-[1.5px] border-[#24394b] text-[#eaf3ee] pl-11 pr-4 text-sm outline-none focus:border-[#4ade80] transition-colors placeholder-[#5b6b78]"
                  required
                />
              </div>

              {/* Password Input with Lock & Eye Toggle */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a6b3] pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  className="w-full h-[50px] rounded-2xl bg-[#0e1f2e] border-[1.5px] border-[#24394b] text-[#eaf3ee] pl-11 pr-11 text-sm outline-none focus:border-[#4ade80] transition-colors placeholder-[#5b6b78]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#93a6b3] hover:text-white rounded-xl transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5 pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-[#eaf3ee]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#0f9d58] cursor-pointer rounded"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-semibold text-[#0f9d58] hover:text-[#4ade80] transition-colors cursor-pointer bg-transparent border-0 p-0"
                >
                  Forgot password?
                </button>
              </div>

              {/* Log in Button with LogIn icon */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[50px] rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#065f46] hover:from-[#15803d] hover:to-[#044d37] text-white font-bold text-base flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(6,95,70,0.35)] active:translate-y-px transition-all cursor-pointer disabled:opacity-50 mt-1"
                style={{ color: '#ffffff' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span className="text-white">Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-white" />
                    <span className="text-white">Log in</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom 4 Feature Badges (Matches Image 2) */}
            <div className="bg-[#0b1824] py-3.5 px-2 grid grid-cols-4 text-center text-xs leading-snug rounded-b-2xl sm:rounded-b-[28px] mt-4 -mx-6 -mb-4">
              <div className="px-1 flex flex-col items-center gap-1.5 text-slate-300">
                <CalendarCheck className="w-6 h-6 text-[#0f9d58]" />
                <span className="text-[11px] font-medium leading-tight">
                  Track<br />attendance
                </span>
              </div>

              <div className="px-1 flex flex-col items-center gap-1.5 text-slate-300 border-l border-[#24394b]">
                <MapPin className="w-6 h-6 text-[#0f9d58]" />
                <span className="text-[11px] font-medium leading-tight">
                  Geo-fencing<br />and location
                </span>
              </div>

              <div className="px-1 flex flex-col items-center gap-1.5 text-slate-300 border-l border-[#24394b]">
                <Users className="w-6 h-6 text-[#0f9d58]" />
                <span className="text-[11px] font-medium leading-tight">
                  Manage<br />staff
                </span>
              </div>

              <div className="px-1 flex flex-col items-center gap-1.5 text-slate-300 border-l border-[#24394b]">
                <BarChart3 className="w-6 h-6 text-[#0f9d58]" />
                <span className="text-[11px] font-medium leading-tight">
                  Reports and<br />analytics
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FORGOT PASSWORD MODAL (Shared across Desktop & Mobile)  */}
      {/* ========================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-[#0e1f2e] border border-[#24394b] rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative text-left text-white max-h-[90vh] overflow-y-auto">
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
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {forgotStep === 1 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-500" />
                  Forgot Password
                </h3>
                <p className="text-xs text-slate-400 mb-6 font-normal">
                  Enter your registered email address below, and we will send you a 6-digit One-Time Password (OTP) to reset your password.
                </p>

                {forgotError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative rounded-xl bg-[#0b1624] border border-[#24394b] focus-within:border-emerald-500 transition-all">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                    style={{ color: '#ffffff' }}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span className="text-white">Sending OTP...</span>
                      </>
                    ) : (
                      <span className="text-white">Send 6-Digit OTP</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 2 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-500" />
                  Enter OTP & New Password
                </h3>
                <p className="text-xs text-slate-400 mb-6 font-normal">
                  We sent a 6-digit OTP to <span className="text-emerald-400 font-semibold">{forgotEmail}</span>. Enter it below along with your new password.
                </p>

                {forgotError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      6-Digit OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full rounded-xl bg-[#0b1624] border border-[#24394b] px-3.5 py-3 text-center text-lg tracking-widest font-mono text-emerald-400 outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative rounded-xl bg-[#0b1624] border border-[#24394b] focus-within:border-emerald-500 transition-all">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative rounded-xl bg-[#0b1624] border border-[#24394b] focus-within:border-emerald-500 transition-all">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                    style={{ color: '#ffffff' }}
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span className="text-white">Resetting Password...</span>
                      </>
                    ) : (
                      <span className="text-white">Update Password & Login</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 3 && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Password Reset Successfully!</h3>
                <p className="text-xs text-slate-300 mb-6">
                  Your password has been changed. You can now log in with your new credentials.
                </p>
                <button
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStep(1);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  style={{ color: '#ffffff' }}
                >
                  <span className="text-white">Back to Login</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
