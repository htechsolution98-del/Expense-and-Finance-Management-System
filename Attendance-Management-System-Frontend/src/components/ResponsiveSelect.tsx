import React, { useState, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

export interface ResponsiveSelectOption {
  value: string;
  label: string;
}

interface ResponsiveSelectProps {
  label: string;
  value: string;
  options: ResponsiveSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  dark?: boolean;
}

export const ResponsiveSelect: React.FC<ResponsiveSelectProps> = ({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
  required = false,
  dark = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <>
      {/* Desktop Standard Select (>= 640px) */}
      <div className="hidden sm:block">
        <select
          value={value}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors cursor-pointer ${
            dark
              ? 'bg-[#0e1422] border border-white/10 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500'
              : 'bg-white border border-slate-200 text-slate-900 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10'
          } ${className}`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className={dark ? 'bg-[#0e1422] text-white' : ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Trigger Button (< 640px) */}
      <div className="sm:hidden">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(true)}
          className={`w-full rounded-xl px-4 py-2.5 text-sm flex items-center justify-between outline-none transition-colors cursor-pointer text-left ${
            dark
              ? `bg-[#0e1422] border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${
                  !value ? 'text-gray-400' : 'text-white font-medium'
                }`
              : `bg-white border border-slate-200 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 ${
                  !value ? 'text-slate-400' : 'text-slate-900 font-medium'
                }`
          } ${className}`}
        >
          <span className="truncate">{selectedOption?.label || `-- Select ${label} --`}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 ml-2 ${dark ? 'text-gray-400' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* Mobile Bottom Sheet Drawer */}
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Bottom Sheet Modal */}
          <div
            className={`relative rounded-t-3xl shadow-2xl p-5 border-t max-h-[80vh] flex flex-col z-[101] animate-slide-up ${
              dark
                ? 'bg-[#0d1322] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Grab Handle */}
            <div className={`w-10 h-1.5 rounded-full mx-auto mb-3 shrink-0 ${dark ? 'bg-slate-700' : 'bg-slate-300'}`} />

            {/* Header */}
            <div className={`flex items-center justify-between pb-3 border-b shrink-0 ${dark ? 'border-white/10' : 'border-slate-100'}`}>
              <span className={`text-xs font-extrabold uppercase tracking-wider ${dark ? 'text-violet-300' : 'text-slate-800'}`}>
                {label}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  dark
                    ? 'text-gray-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto py-2 space-y-1.5 my-1 max-h-[60vh]">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-colors cursor-pointer text-left ${
                      isSelected
                        ? dark
                          ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40 shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                        : dark
                        ? 'hover:bg-white/5 text-gray-200 border border-transparent active:bg-white/10'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent active:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Check className={`w-4.5 h-4.5 shrink-0 ml-2 ${dark ? 'text-violet-400' : 'text-emerald-600'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

