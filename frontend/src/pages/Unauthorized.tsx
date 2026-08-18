import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#080b11] overflow-hidden px-4">
      {/* Background glowing decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-red-500/5 blur-[120px] animate-pulse-slow"></div>

      <div className="w-full max-w-md z-10 text-center">
        {/* Warning Icon */}
        <div className="inline-flex w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 items-center justify-center text-red-500 shadow-lg shadow-red-500/10 mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Message Card */}
        <div className="glass-panel rounded-2xl p-8 bg-card-dark/40 border-red-500/20">
          <h2 className="text-2xl font-extrabold tracking-tight text-white mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            You do not have the required permissions to access this page. Please contact your system administrator if you believe this is an error.
          </p>

          <button
            onClick={() => navigate('/')}
            className="mt-8 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-gray-800 to-gray-700 text-white font-semibold shadow-md hover:from-gray-750 hover:to-gray-650 active:scale-98 transition-all cursor-pointer border border-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
