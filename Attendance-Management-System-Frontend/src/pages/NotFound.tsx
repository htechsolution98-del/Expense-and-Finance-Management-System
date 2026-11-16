import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LogIn } from 'lucide-react';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = Boolean(localStorage.getItem('access_token') && localStorage.getItem('user'));

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080b11] overflow-hidden px-4 select-none">
      {/* Background glowing decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center">
        {/* 404 Icon Badge */}
        <div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 mb-6">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        {/* Message Card */}
        <div className="rounded-2xl p-6 sm:p-8 bg-[#0c1626]/90 border border-slate-700/60 shadow-2xl backdrop-blur-xl">
          <div className="inline-block px-3 py-1 mb-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            404 • Error
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Page Not Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            The page you are looking for doesn't exist, has been removed, or the link may be broken.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Go to Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

