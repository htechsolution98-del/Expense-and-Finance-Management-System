import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, X, Check } from 'lucide-react';

export function formatTime12(time24?: string | null): string {
  if (!time24) return '--';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${m} ${period}`;
}

interface TimeInput12Props {
  value: string; // 24-hour format "HH:mm", e.g. "06:00", "14:00"
  onChange: (value24: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const TimeInput12: React.FC<TimeInput12Props> = ({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  className = '',
}) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Parse incoming 24h string
  const [rawH, rawM] = (value || '09:00').split(':');
  const hNum = parseInt(rawH, 10);
  const safeH = isNaN(hNum) ? 9 : hNum;
  const safeM = rawM || '00';

  const period: 'AM' | 'PM' = safeH >= 12 ? 'PM' : 'AM';
  const h12 = safeH === 0 ? 12 : safeH > 12 ? safeH - 12 : safeH;

  // Working state for mobile bottom sheet
  const [sheetH12, setSheetH12] = useState<number>(h12);
  const [sheetM, setSheetM] = useState<string>(safeM);
  const [sheetPeriod, setSheetPeriod] = useState<'AM' | 'PM'>(period);

  useEffect(() => {
    if (isSheetOpen) {
      setSheetH12(h12);
      setSheetM(safeM);
      setSheetPeriod(period);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSheetOpen, h12, safeM, period]);

  const updateTime = (newH12: number, newMStr: string, newPeriod: 'AM' | 'PM') => {
    let h24 = newH12;
    if (newPeriod === 'AM') {
      h24 = newH12 === 12 ? 0 : newH12;
    } else {
      h24 = newH12 === 12 ? 12 : newH12 + 12;
    }
    const cleanM = (newMStr || '00').padStart(2, '0').slice(0, 2);
    const finalVal = `${String(h24).padStart(2, '0')}:${cleanM}`;
    onChange(finalVal);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10) || 12;
    updateTime(val, safeM, period);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateTime(h12, e.target.value, period);
  };

  const togglePeriod = (p: 'AM' | 'PM') => {
    if (period !== p) {
      updateTime(h12, safeM, p);
    }
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesList = [
    '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
  ];

  const displayMinutes = minutesList.includes(safeM) 
    ? minutesList 
    : [...minutesList, safeM].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const applySheetSelection = (newH: number, newM: string, newP: 'AM' | 'PM') => {
    setSheetH12(newH);
    setSheetM(newM);
    setSheetPeriod(newP);
    updateTime(newH, newM, newP);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-slate-700 block">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Desktop Mode (>= 640px) */}
      <div className="hidden sm:flex items-center gap-1 p-1 bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all w-full min-w-0">
        <select
          disabled={disabled}
          value={h12}
          onChange={handleHourChange}
          className="bg-transparent text-slate-900 font-bold text-xs px-1.5 py-1 rounded-md hover:bg-slate-100 cursor-pointer outline-none shrink-0"
        >
          {hoursList.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>

        <span className="text-slate-400 font-extrabold text-xs select-none">:</span>

        <select
          disabled={disabled}
          value={safeM}
          onChange={handleMinuteChange}
          className="bg-transparent text-slate-900 font-bold text-xs px-1.5 py-1 rounded-md hover:bg-slate-100 cursor-pointer outline-none shrink-0"
        >
          {displayMinutes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <div className="flex items-center ml-auto bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('AM')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
              period === 'AM'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => togglePeriod('PM')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
              period === 'PM'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Mobile Mode Trigger Button (< 640px) */}
      <div className="sm:hidden">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsSheetOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 shadow-xs active:bg-slate-50 transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-sm tracking-wide text-slate-900 font-mono">
              {formatTime12(value)}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Mobile Bottom Sheet Drawer (< 640px) */}
      {isSheetOpen && (
        <div className="sm:hidden fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSheetOpen(false)}
          />

          {/* Bottom Sheet Drawer */}
          <div className="relative rounded-t-3xl shadow-2xl p-5 border-t max-h-[85vh] flex flex-col z-[101] bg-white border-slate-200 animate-slide-up text-left">
            {/* Drawer Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {label ? `Select ${label}` : 'Select Time'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Preview & AM/PM Selector */}
            <div className="py-4 flex items-center justify-between bg-emerald-50/60 rounded-2xl px-4 mt-3 border border-emerald-100">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Active Time</span>
                <span className="text-2xl font-extrabold text-emerald-900 font-mono">
                  {String(sheetH12).padStart(2, '0')}:{sheetM} {sheetPeriod}
                </span>
              </div>
              <div className="flex items-center bg-white p-1 rounded-xl border border-emerald-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => applySheetSelection(sheetH12, sheetM, 'AM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sheetPeriod === 'AM'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => applySheetSelection(sheetH12, sheetM, 'PM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sheetPeriod === 'PM'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Scrollable Hours & Minutes section */}
            <div className="overflow-y-auto space-y-4 py-3 flex-1">
              {/* Hours Grid */}
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Hour
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {hoursList.map((h) => {
                    const isSelected = sheetH12 === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => applySheetSelection(h, sheetM, sheetPeriod)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minutes Grid */}
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Minute
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {minutesList.map((m) => {
                    const isSelected = sheetM === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => applySheetSelection(sheetH12, m, sheetPeriod)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Confirm / Done Button */}
            <div className="pt-3 border-t border-slate-100 mt-auto">
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Done ({formatTime12(value)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Helper text on desktop */}
      <div className="hidden sm:flex text-[10px] text-slate-500 font-medium px-1 items-center justify-between">
        <span>Selected: <strong className="text-slate-800 font-semibold">{formatTime12(value)}</strong></span>
      </div>
    </div>
  );
};
