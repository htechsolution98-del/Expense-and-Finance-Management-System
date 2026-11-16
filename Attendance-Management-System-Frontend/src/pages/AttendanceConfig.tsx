import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Save,
  Navigation,
  Plus,
  Edit2,
  Trash2,
  Moon,
  Star,
  Users,
  X,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { TimeInput12, formatTime12 } from '../components/TimeInput12';
import '../styles/attendance.css';

interface Shift {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayMinutes: number;
  breakDurationMinutes: number;
  breakStartTime: string | null;
  breakEndTime: string | null;
  selfieRequired: boolean;
  geoFencingEnabled: boolean;
  geoLat?: number | null;
  geoLng?: number | null;
  geoRadiusMeters?: number | null;
  isNightShift: boolean;
  isDefault: boolean;
  isActive: boolean;
  _count?: {
    employees: number;
  };
}

interface ShiftTemplate {
  label: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
  breakMinutes: number;
  isNight: boolean;
  graceMinutes: number;
  halfDayHours: number;
  desc: string;
}

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    label: '🌅 Morning Shift',
    name: 'Morning Shift',
    code: 'MORN',
    startTime: '06:00', // 06:00 AM
    endTime: '14:00',   // 02:00 PM
    breakStartTime: '10:00', // 10:00 AM
    breakEndTime: '10:30',   // 10:30 AM
    breakMinutes: 30,
    isNight: false,
    graceMinutes: 15,
    halfDayHours: 4,
    desc: '06:00 AM → 02:00 PM',
  },
  {
    label: '🌇 Evening Shift',
    name: 'Evening Shift',
    code: 'EVE',
    startTime: '14:00', // 02:00 PM
    endTime: '22:00',   // 10:00 PM
    breakStartTime: '18:00', // 06:00 PM
    breakEndTime: '18:30',   // 06:30 PM
    breakMinutes: 30,
    isNight: false,
    graceMinutes: 15,
    halfDayHours: 4,
    desc: '02:00 PM → 10:00 PM',
  },
  {
    label: '🌙 Night Shift',
    name: 'Night Shift',
    code: 'NIGHT',
    startTime: '22:00', // 10:00 PM
    endTime: '06:00',   // 06:00 AM next day
    breakStartTime: '02:00', // 02:00 AM
    breakEndTime: '02:30',   // 02:30 AM
    breakMinutes: 30,
    isNight: true,
    graceMinutes: 15,
    halfDayHours: 4,
    desc: '10:00 PM → 06:00 AM',
  },
  {
    label: '🏢 General Shift',
    name: 'General Shift',
    code: 'GEN',
    startTime: '09:00', // 09:00 AM
    endTime: '18:00',   // 06:00 PM
    breakStartTime: '13:00', // 01:00 PM
    breakEndTime: '14:00',   // 02:00 PM
    breakMinutes: 60,
    isNight: false,
    graceMinutes: 15,
    halfDayHours: 4,
    desc: '09:00 AM → 06:00 PM',
  },
];

function calculateShiftDuration(startTime: string, endTime: string, isNight: boolean): string {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff <= 0 || isNight) {
    if (diff <= 0) diff += 1440;
  }
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours} hr${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins}m` : ''}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getBreakWindowMinutes(
  shiftStart: string,
  shiftEnd: string,
  breakStart: string | null | undefined,
  breakEnd: string | null | undefined,
  isNight: boolean
): number {
  if (!breakStart || !breakEnd) return 0;
  const startM = timeToMinutes(shiftStart);
  const endM = timeToMinutes(shiftEnd);
  const bStartM = timeToMinutes(breakStart);
  const bEndM = timeToMinutes(breakEnd);

  if (!isNight) {
    if (bEndM > bStartM) {
      return bEndM - bStartM;
    }
    return 0;
  } else {
    // Night shift crossing midnight
    if (bStartM >= startM && bEndM <= endM) {
      return (1440 - bStartM) + bEndM;
    } else if (bEndM > bStartM) {
      return bEndM - bStartM;
    }
    return 0;
  }
}

function validateShiftBreakTiming(
  startTime: string,
  endTime: string,
  breakStartTime: string | null | undefined,
  breakEndTime: string | null | undefined,
  breakDurationMinutes: number,
  isNightShift: boolean
): string | null {
  if (!breakStartTime && !breakEndTime) return null;
  if (!breakStartTime || !breakEndTime) {
    return 'Both Break Allowed From and Break Allowed Until must be provided.';
  }

  const startM = timeToMinutes(startTime);
  const endM = timeToMinutes(endTime);
  const bStartM = timeToMinutes(breakStartTime);
  const bEndM = timeToMinutes(breakEndTime);

  if (!isNightShift) {
    if (startM >= endM) {
      return `Shift End Time (${formatTime12(endTime)}) must be later than Start Time (${formatTime12(startTime)}). If shift crosses midnight, please toggle "Night Shift".`;
    }
    if (bStartM < startM || bStartM >= endM) {
      return `Break Allowed From (${formatTime12(breakStartTime)}) is outside working hours (${formatTime12(startTime)} - ${formatTime12(endTime)}). Break must occur during the shift.`;
    }
    if (bEndM <= startM || bEndM > endM) {
      return `Break Allowed Until (${formatTime12(breakEndTime)}) is outside working hours (${formatTime12(startTime)} - ${formatTime12(endTime)}). Break must occur during the shift.`;
    }
    if (bEndM <= bStartM) {
      return `Break Allowed Until (${formatTime12(breakEndTime)}) must be later than Break Allowed From (${formatTime12(breakStartTime)}).`;
    }
    const windowMinutes = bEndM - bStartM;
    if (breakDurationMinutes > windowMinutes) {
      return `Allowed Break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${formatTime12(breakStartTime)} - ${formatTime12(breakEndTime)}).`;
    }
  } else {
    // Night shift (crosses midnight, e.g. 23:00 to 07:00)
    const isWithinNightShift = (m: number) => m >= startM || m <= endM;
    if (!isWithinNightShift(bStartM)) {
      return `Break Allowed From (${formatTime12(breakStartTime)}) is outside night shift hours (${formatTime12(startTime)} - ${formatTime12(endTime)}). Break must occur during the shift.`;
    }
    if (!isWithinNightShift(bEndM)) {
      return `Break Allowed Until (${formatTime12(breakEndTime)}) is outside night shift hours (${formatTime12(startTime)} - ${formatTime12(endTime)}). Break must occur during the shift.`;
    }

    let windowMinutes = 0;
    if (bStartM >= startM && bEndM <= endM) {
      windowMinutes = (1440 - bStartM) + bEndM;
    } else if ((bStartM >= startM && bEndM >= startM) || (bStartM <= endM && bEndM <= endM)) {
      if (bEndM <= bStartM) {
        return `Break Allowed Until (${formatTime12(breakEndTime)}) must be later than Break Allowed From (${formatTime12(breakStartTime)}).`;
      }
      windowMinutes = bEndM - bStartM;
    } else {
      return `Break window (${formatTime12(breakStartTime)} - ${formatTime12(breakEndTime)}) is invalid for night shift (${formatTime12(startTime)} - ${formatTime12(endTime)}).`;
    }

    if (breakDurationMinutes > windowMinutes) {
      return `Allowed Break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${formatTime12(breakStartTime)} - ${formatTime12(breakEndTime)}).`;
    }
  }

  return null;
}

interface AttendanceConfigState {
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  breakDurationMinutes: number;
  halfDayMinutes: number;
  breakStartTime: string;
  breakEndTime: string;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusMeters: number;
  geoFencingEnabled: boolean;
  selfieRequired: boolean;
}

export default function AttendanceConfig() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'settings'>('shifts');

  // Timings & Verification Settings State
  const [formData, setFormData] = useState<AttendanceConfigState>({
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    breakDurationMinutes: 60,
    halfDayMinutes: 240,
    breakStartTime: '13:00',
    breakEndTime: '14:00',
    geoLat: null,
    geoLng: null,
    geoRadiusMeters: 200,
    geoFencingEnabled: false,
    selfieRequired: false,
  });

  // Shifts State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftFormError, setShiftFormError] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Shift Modal Form State
  const [shiftName, setShiftName] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('18:00');
  const [shiftGraceMinutes, setShiftGraceMinutes] = useState(15);
  const [shiftHalfDayHours, setShiftHalfDayHours] = useState(4);
  const [shiftBreakMinutes, setShiftBreakMinutes] = useState(60);
  const [shiftBreakStart, setShiftBreakStart] = useState('13:00');
  const [shiftBreakEnd, setShiftBreakEnd] = useState('14:00');
  const [shiftSelfieRequired, setShiftSelfieRequired] = useState(false);
  const [shiftGeoFencingEnabled, setShiftGeoFencingEnabled] = useState(false);
  const [shiftGeoLat, setShiftGeoLat] = useState<number | null>(null);
  const [shiftGeoLng, setShiftGeoLng] = useState<number | null>(null);
  const [shiftGeoRadius, setShiftGeoRadius] = useState<number>(200);
  const [shiftGeoLocating, setShiftGeoLocating] = useState(false);
  const [shiftIsNight, setShiftIsNight] = useState(false);
  const [shiftIsDefault, setShiftIsDefault] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchShifts();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/config');
      if (res.data?.status === 'success' && res.data.data) {
        setFormData({
          officeStartTime: res.data.data.officeStartTime,
          officeEndTime: res.data.data.officeEndTime,
          graceMinutes: res.data.data.graceMinutes,
          breakDurationMinutes: res.data.data.breakDurationMinutes,
          halfDayMinutes: res.data.data.halfDayMinutes || 240,
          breakStartTime: res.data.data.breakStartTime || '13:00',
          breakEndTime: res.data.data.breakEndTime || '14:00',
          geoLat: res.data.data.geoLat,
          geoLng: res.data.data.geoLng,
          geoRadiusMeters: res.data.data.geoRadiusMeters,
          geoFencingEnabled: res.data.data.geoFencingEnabled,
          selfieRequired: res.data.data.selfieRequired,
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'Failed to retrieve attendance configuration.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const res = await api.get('/attendance/shifts');
      if (res.data?.status === 'success' && res.data.data) {
        setShifts(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load shifts', err);
    } finally {
      setLoadingShifts(false);
    }
  };

  const handleGetShiftCurrentLocation = () => {
    if (navigator.geolocation) {
      setShiftGeoLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setShiftGeoLat(parseFloat(position.coords.latitude.toFixed(6)));
          setShiftGeoLng(parseFloat(position.coords.longitude.toFixed(6)));
          setShiftGeoLocating(false);
        },
        (error) => {
          console.error('Error retrieving shift geolocation:', error);
          setShiftFormError('Unable to detect current GPS location. Please check browser location permissions.');
          setShiftGeoLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setShiftFormError('Geolocation is not supported by this browser.');
    }
  };

  const openCreateShiftModal = () => {
    setEditingShift(null);
    setShiftName('');
    setShiftCode('');
    setShiftStartTime('06:00');
    setShiftEndTime('14:00');
    setShiftGraceMinutes(15);
    setShiftHalfDayHours(4);
    setShiftBreakMinutes(30);
    setShiftBreakStart('10:00');
    setShiftBreakEnd('10:30');
    setShiftSelfieRequired(false);
    setShiftGeoFencingEnabled(false);
    setShiftGeoLat(null);
    setShiftGeoLng(null);
    setShiftGeoRadius(200);
    setShiftIsNight(false);
    setShiftIsDefault(shifts.length === 0);
    setShiftFormError('');
    setShowShiftModal(true);
  };

  const applyShiftTemplate = (tpl: ShiftTemplate) => {
    setShiftName(tpl.name);
    setShiftCode(tpl.code);
    setShiftStartTime(tpl.startTime);
    setShiftEndTime(tpl.endTime);
    setShiftBreakStart(tpl.breakStartTime);
    setShiftBreakEnd(tpl.breakEndTime);
    setShiftBreakMinutes(tpl.breakMinutes);
    setShiftIsNight(tpl.isNight);
    setShiftGraceMinutes(tpl.graceMinutes);
    setShiftHalfDayHours(tpl.halfDayHours);
    setShiftFormError('');
  };

  const currentBreakWindow = getBreakWindowMinutes(
    shiftStartTime,
    shiftEndTime,
    shiftBreakStart,
    shiftBreakEnd,
    shiftIsNight
  );

  const handleUpdateBreakStart = (val: string) => {
    setShiftBreakStart(val);
    const isNight = timeToMinutes(shiftEndTime) < timeToMinutes(shiftStartTime);
    const win = getBreakWindowMinutes(shiftStartTime, shiftEndTime, val, shiftBreakEnd, isNight);
    if (win > 0) {
      setShiftBreakMinutes(win);
    }
  };

  const handleUpdateBreakEnd = (val: string) => {
    setShiftBreakEnd(val);
    const isNight = timeToMinutes(shiftEndTime) < timeToMinutes(shiftStartTime);
    const win = getBreakWindowMinutes(shiftStartTime, shiftEndTime, shiftBreakStart, val, isNight);
    if (win > 0) {
      setShiftBreakMinutes(win);
    }
  };

  const openEditShiftModal = (shift: Shift) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    setShiftCode(shift.code || '');
    setShiftStartTime(shift.startTime);
    setShiftEndTime(shift.endTime);
    setShiftGraceMinutes(shift.graceMinutes);
    setShiftHalfDayHours(shift.halfDayMinutes / 60);
    setShiftBreakMinutes(shift.breakDurationMinutes);
    setShiftBreakStart(shift.breakStartTime || '13:00');
    setShiftBreakEnd(shift.breakEndTime || '14:00');
    setShiftSelfieRequired(Boolean(shift.selfieRequired));
    setShiftGeoFencingEnabled(Boolean(shift.geoFencingEnabled));
    setShiftGeoLat(shift.geoLat ?? null);
    setShiftGeoLng(shift.geoLng ?? null);
    setShiftGeoRadius(shift.geoRadiusMeters ?? 200);
    setShiftIsNight(shift.isNightShift);
    setShiftIsDefault(shift.isDefault);
    setShiftFormError('');
    setShowShiftModal(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShift(true);
    setShiftFormError('');

    // Auto-detect night shift based on whether shift hours cross midnight
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    const effectiveNight = (endH * 60 + endM) < (startH * 60 + startM);

    const timingValidationError = validateShiftBreakTiming(
      shiftStartTime,
      shiftEndTime,
      shiftBreakStart,
      shiftBreakEnd,
      shiftBreakMinutes,
      effectiveNight
    );

    if (timingValidationError) {
      setShiftFormError(timingValidationError);
      setSavingShift(false);
      return;
    }

    if (shiftGeoFencingEnabled && (shiftGeoLat === null || shiftGeoLng === null) && (formData.geoLat === null || formData.geoLng === null)) {
      setShiftFormError('Please enter Latitude & Longitude or click "Set Coordinates from My Current Location" when Geofencing is enabled.');
      setSavingShift(false);
      return;
    }

    const payload = {
      name: shiftName.trim(),
      code: shiftCode.trim() || null,
      startTime: shiftStartTime,
      endTime: shiftEndTime,
      graceMinutes: shiftGraceMinutes,
      halfDayMinutes: Math.round(shiftHalfDayHours * 60),
      breakDurationMinutes: shiftBreakMinutes,
      breakStartTime: shiftBreakStart || null,
      breakEndTime: shiftBreakEnd || null,
      selfieRequired: shiftSelfieRequired,
      geoFencingEnabled: shiftGeoFencingEnabled,
      geoLat: shiftGeoFencingEnabled ? shiftGeoLat : null,
      geoLng: shiftGeoFencingEnabled ? shiftGeoLng : null,
      geoRadiusMeters: shiftGeoFencingEnabled ? shiftGeoRadius : 200,
      isNightShift: effectiveNight,
      isDefault: shiftIsDefault,
      isActive: true,
    };

    try {
      if (editingShift) {
        await api.put(`/attendance/shifts/${editingShift.id}`, payload);
        setMessage({ text: `Shift "${payload.name}" updated successfully.`, type: 'success' });
      } else {
        await api.post('/attendance/shifts', payload);
        setMessage({ text: `Shift "${payload.name}" created successfully.`, type: 'success' });
      }
      setShowShiftModal(false);
      fetchShifts();
    } catch (err: any) {
      setShiftFormError(err.response?.data?.message || 'Failed to save shift details.');
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (shift: Shift) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${shift.name}"? Any assigned employees will automatically fall back to the default company shift.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/attendance/shifts/${shift.id}`);
      setMessage({ text: `Shift "${shift.name}" was deleted successfully.`, type: 'success' });
      fetchShifts();
    } catch (err: any) {
      setMessage({ text: err.response?.data?.message || 'Failed to delete shift.', type: 'error' });
    }
  };

  const handleSetDefaultShift = async (shift: Shift) => {
    try {
      await api.put(`/attendance/shifts/${shift.id}`, {
        ...shift,
        isDefault: true,
      });
      setMessage({ text: `"${shift.name}" set as the default company shift.`, type: 'success' });
      fetchShifts();
    } catch (err: any) {
      setMessage({ text: 'Failed to update default shift.', type: 'error' });
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setGeoLocating(true);
      setMessage(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            geoLat: parseFloat(position.coords.latitude.toFixed(6)),
            geoLng: parseFloat(position.coords.longitude.toFixed(6)),
          }));
          setMessage({
            text: 'Office coordinates populated successfully from your current browser location!',
            type: 'success',
          });
          setGeoLocating(false);
        },
        (error) => {
          console.error(error);
          setMessage({
            text: 'Unable to retrieve location. Please check browser location permissions.',
            type: 'error',
          });
          setGeoLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setMessage({ text: 'Geolocation is not supported by this browser.', type: 'error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Validate global fallback timings
    const timingError = validateShiftBreakTiming(
      formData.officeStartTime,
      formData.officeEndTime,
      formData.breakStartTime,
      formData.breakEndTime,
      formData.breakDurationMinutes,
      false
    );
    if (timingError) {
      setMessage({ text: timingError, type: 'error' });
      setSaving(false);
      return;
    }

    if (formData.geoFencingEnabled && (formData.geoLat === null || formData.geoLng === null)) {
      setMessage({
        text: 'Please set Geofence latitude and longitude coordinates if Geofencing is enabled.',
        type: 'error',
      });
      setSaving(false);
      return;
    }

    try {
      const res = await api.put('/attendance/config', formData);
      if (res.data?.status === 'success') {
        setMessage({ text: 'Attendance configuration updated successfully.', type: 'success' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: err.response?.data?.message || 'Failed to save attendance configuration.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-500 text-sm font-semibold">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="att-root max-w-5xl p-3 sm:p-6 text-left">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-8">
        {/* Header */}
        <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Attendance Timings & Shift Management
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 ml-10">
              Configure multi-shift schedules for hospitals & 24/7 organizations, geofencing coordinates, and photo verification rules.
            </p>
          </div>

          {/* Clean Pill Tab Switcher */}
          <div className="w-full md:w-auto flex items-center p-1 sm:p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('shifts')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center min-w-0 ${
                activeTab === 'shifts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Company Shifts ({shifts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center min-w-0 ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Verification & Geofence</span>
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{message.text}</span>
          </div>
        )}

        {/* TAB 1: SHIFTS MANAGEMENT */}
        {activeTab === 'shifts' && (
          <div className="space-y-6">
            {/* Top Info Banner with Call To Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Hospital & Multi-Shift Roster</h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    Assign employees to distinct duty shifts (Morning, Evening, Night, General). Each shift defines its own start & end times, grace thresholds, and break allocations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openCreateShiftModal}
                className="w-full sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add New Shift
              </button>
            </div>

            {loadingShifts ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold">Loading operational shifts...</div>
            ) : shifts.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200">
                No shifts found. Click <strong>"Add New Shift"</strong> above to configure your first shift schedule.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    style={{ backgroundColor: shift.isDefault ? '#f0fdf4' : '#ffffff', color: '#0f172a' }}
                    className={`p-5 rounded-2xl border transition-all text-left relative ${
                      shift.isDefault
                        ? 'border-2 border-emerald-500 shadow-sm'
                        : 'border border-slate-200 hover:border-slate-300 hover:shadow-md shadow-sm'
                    }`}
                  >
                    {/* Header: Title, Badges & Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-extrabold text-slate-900">{shift.name}</h4>
                          {shift.code && (
                            <span 
                              style={{ backgroundColor: '#f1f5f9', color: '#334155' }}
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-slate-200"
                            >
                              {shift.code}
                            </span>
                          )}
                          {shift.isDefault && (
                            <span 
                              style={{ backgroundColor: '#fffbeb', color: '#b45309' }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-amber-200"
                            >
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Default
                            </span>
                          )}
                          {shift.isNightShift && (
                            <span 
                              style={{ backgroundColor: '#faf5ff', color: '#7e22ce' }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-purple-200"
                            >
                              <Moon className="w-2.5 h-2.5" /> Night Shift
                            </span>
                          )}
                          {shift.selfieRequired && (
                            <span 
                              style={{ backgroundColor: '#ecfdf5', color: '#047857' }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-emerald-200"
                              title="Selfie photo required on check-in/out"
                            >
                              <Camera className="w-2.5 h-2.5" /> Selfie Required
                            </span>
                          )}
                          {shift.geoFencingEnabled && (
                            <span 
                              style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-blue-200"
                              title="GPS geofence check enabled"
                            >
                              <MapPin className="w-2.5 h-2.5" /> Geofence
                            </span>
                          )}
                        </div>

                        {/* Working Timings */}
                        <div className="pt-2 flex items-center gap-2 text-emerald-700 font-mono text-sm sm:text-base font-bold">
                          <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {formatTime12(shift.startTime)} <span className="text-slate-400 font-sans font-normal">&rarr;</span> {formatTime12(shift.endTime)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditShiftModal(shift)}
                          title="Edit Shift"
                          style={{ backgroundColor: '#f8fafc', color: '#334155' }}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!shift.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(shift)}
                            title="Delete Shift"
                            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                            className="p-2 rounded-lg border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div 
                      style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}
                      className="mt-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-slate-200"
                    >
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Grace</span>
                        <strong className="text-slate-900 text-xs mt-0.5 block">{shift.graceMinutes}m</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Half-Day</span>
                        <strong className="text-slate-900 text-xs mt-0.5 block">{shift.halfDayMinutes / 60}h</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Break Hours</span>
                        <strong className="text-slate-900 text-xs mt-0.5 block">
                          {shift.breakStartTime ? formatTime12(shift.breakStartTime) : '--'} - {shift.breakEndTime ? formatTime12(shift.breakEndTime) : '--'}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Break Limit</span>
                        <strong className="text-slate-900 text-xs mt-0.5 block">{shift.breakDurationMinutes}m</strong>
                      </div>
                    </div>

                    {/* Footer: Assigned Staff & Default Switcher */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          <strong className="text-slate-900 font-bold">{shift._count?.employees ?? 0}</strong> Assigned Staff
                        </span>
                      </div>

                      {!shift.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultShift(shift)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer transition-colors"
                        >
                          Set as Default
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VERIFICATION & GEOFENCING SETTINGS */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
            {/* Global Fallback Timing */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Global Fallback Office Timings
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                These timings act as a company-wide fallback when an employee has no specific shift assigned.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TimeInput12
                  label="Office Start Time"
                  required
                  value={formData.officeStartTime}
                  onChange={(val) => setFormData({ ...formData, officeStartTime: val })}
                />
                <TimeInput12
                  label="Office End Time"
                  required
                  value={formData.officeEndTime}
                  onChange={(val) => setFormData({ ...formData, officeEndTime: val })}
                />
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={formData.graceMinutes}
                    onChange={(e) => setFormData({ ...formData, graceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Allowed delay minutes before marking arrival as late.</p>
                </div>
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Allowed Break Duration (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={formData.breakDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, breakDurationMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Total combined break duration allocated to employees.</p>
                </div>
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Half-Day Minimum Work Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="12"
                    required
                    value={formData.halfDayMinutes / 60}
                    onChange={(e) => setFormData({ ...formData, halfDayMinutes: Math.round(parseFloat(e.target.value) * 60) || 240 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Minimum hours an employee must work to avoid a Half Day penalty.</p>
                </div>
                <TimeInput12
                  label="Break Allowed From"
                  required
                  value={formData.breakStartTime}
                  onChange={(val) => setFormData({ ...formData, breakStartTime: val })}
                />
                <TimeInput12
                  label="Break Allowed Until"
                  required
                  value={formData.breakEndTime}
                  onChange={(val) => setFormData({ ...formData, breakEndTime: val })}
                />
              </div>
            </div>

            <hr className="border-slate-100 my-2" />

            {/* Photo Verification */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Photo-Verification Rules
                </h3>
              </div>
              <div 
                style={{ backgroundColor: formData.selfieRequired ? '#f0fdf4' : '#ffffff', color: '#0f172a' }}
                className={`p-4 rounded-xl border transition-all ${
                  formData.selfieRequired ? 'border-emerald-500 shadow-sm' : 'border-slate-200'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.selfieRequired}
                    onChange={(e) => setFormData({ ...formData, selfieRequired: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Require Selfie Verification</span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Forces employees to take a real-time front camera selfie when checking in or checking out.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-slate-100 my-2" />

            {/* Geofencing Config */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Geofencing Restrictions
                </h3>
              </div>
              <div 
                style={{ backgroundColor: formData.geoFencingEnabled ? '#f0fdf4' : '#ffffff', color: '#0f172a' }}
                className={`p-4 rounded-xl border transition-all space-y-4 ${
                  formData.geoFencingEnabled ? 'border-emerald-500 shadow-sm' : 'border-slate-200'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.geoFencingEnabled}
                    onChange={(e) => setFormData({ ...formData, geoFencingEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Enable Location-based Geofencing Check</span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Validates employee GPS coordinates are inside office boundaries during check-in/out.
                    </span>
                  </div>
                </label>

                {formData.geoFencingEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Office Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={formData.geoLat || ''}
                        onChange={(e) => setFormData({ ...formData, geoLat: parseFloat(e.target.value) || null })}
                        placeholder="e.g. 28.6139"
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Office Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={formData.geoLng || ''}
                        onChange={(e) => setFormData({ ...formData, geoLng: parseFloat(e.target.value) || null })}
                        placeholder="e.g. 77.2090"
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Allowed Radius (Meters)</label>
                      <input
                        type="number"
                        min="50"
                        max="5000"
                        required
                        value={formData.geoRadiusMeters}
                        onChange={(e) => setFormData({ ...formData, geoRadiusMeters: parseInt(e.target.value) || 200 })}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div className="md:col-span-3 flex justify-start pt-1">
                      <button
                        type="button"
                        onClick={handleGetCurrentLocation}
                        disabled={geoLocating}
                        className="w-full sm:w-auto justify-center px-4 py-2.5 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>{geoLocating ? 'Locating...' : 'Set Coordinates from My Current Location'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-sm hover:shadow transition-all flex items-center gap-2 text-center"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{saving ? 'Saving...' : 'Save Verification Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SHIFT ADD / EDIT MODAL (LIGHT THEME & RESPONSIVE) */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 bg-white overflow-hidden shadow-2xl text-left flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate pr-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{editingShift ? `Edit Shift: ${editingShift.name}` : 'Create New Operational Shift'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
              {shiftFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{shiftFormError}</span>
                </div>
              )}

              {/* QUICK SHIFT TEMPLATES (1-Click Fill) */}
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Quick 1-Click Shift Presets
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Click to set hours & breaks</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SHIFT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => applyShiftTemplate(tpl)}
                      className="p-2 text-left rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <span className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-700 block truncate">
                        {tpl.label}
                      </span>
                      <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                        {formatTime12(tpl.startTime)} - {formatTime12(tpl.endTime)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 1: SHIFT IDENTITY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Shift Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Morning Shift, ICU Shift"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Shift Code / Tag (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MORN, ICU, EVE"
                    value={shiftCode}
                    onChange={(e) => setShiftCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase font-mono"
                  />
                </div>
              </div>

              {/* SECTION 2: WORKING HOURS & THRESHOLDS (12h AM/PM) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TimeInput12
                  label="Start Time"
                  required
                  value={shiftStartTime}
                  onChange={(val) => {
                    setShiftStartTime(val);
                    const [sH, sM] = val.split(':').map(Number);
                    const [eH, eM] = shiftEndTime.split(':').map(Number);
                    if (eH * 60 + eM < sH * 60 + sM) {
                      setShiftIsNight(true);
                    } else {
                      setShiftIsNight(false);
                    }
                  }}
                />
                <TimeInput12
                  label="End Time"
                  required
                  value={shiftEndTime}
                  onChange={(val) => {
                    setShiftEndTime(val);
                    const [sH, sM] = shiftStartTime.split(':').map(Number);
                    const [eH, eM] = val.split(':').map(Number);
                    if (eH * 60 + eM < sH * 60 + sM) {
                      setShiftIsNight(true);
                    } else {
                      setShiftIsNight(false);
                    }
                  }}
                />
              </div>

              {/* LIVE SHIFT DURATION & TIMING PREVIEW */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-700">
                    Shift Hours: <strong className="text-emerald-700">{formatTime12(shiftStartTime)} → {formatTime12(shiftEndTime)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">Duration:</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                    {calculateShiftDuration(shiftStartTime, shiftEndTime, shiftIsNight)}
                  </span>
                  {shiftIsNight ? (
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center gap-1 border border-purple-200">
                      <Moon className="w-3 h-3" /> Night Shift (Crosses Midnight)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                      Day Shift
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={shiftGraceMinutes}
                    onChange={(e) => setShiftGraceMinutes(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Allowed delay before marking as late.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Half-Day Min Work (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="12"
                    required
                    value={shiftHalfDayHours}
                    onChange={(e) => setShiftHalfDayHours(parseFloat(e.target.value) || 4)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Hours worked required to avoid half-day.</p>
                </div>
              </div>

              {/* SECTION 3: BREAK ALLOWED WINDOW (12h AM/PM) */}
              <div 
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                className="p-4 rounded-xl border border-slate-200 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Break Allowed Window</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Must be during shift hours</span>
                </div>
                
                {/* 2-Column Grid so time pickers never overlap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TimeInput12
                    label="Break Allowed From"
                    value={shiftBreakStart || '10:00'}
                    onChange={handleUpdateBreakStart}
                  />
                  <TimeInput12
                    label="Break Allowed Until"
                    value={shiftBreakEnd || '10:30'}
                    onChange={handleUpdateBreakEnd}
                  />
                </div>

                {/* Allowed Break Duration on its own full-width row with presets */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Allowed Break Duration: <strong className="text-emerald-700 text-sm font-extrabold">{shiftBreakMinutes} minutes</strong>
                        {shiftBreakMinutes >= 60 && (
                          <span className="text-slate-500 font-normal text-xs ml-1">
                            ({Math.floor(shiftBreakMinutes / 60)} hr{shiftBreakMinutes % 60 > 0 ? ` ${shiftBreakMinutes % 60}m` : ''})
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Break Window: <strong className="text-slate-700">{formatTime12(shiftBreakStart)} → {formatTime12(shiftBreakEnd)}</strong> ({currentBreakWindow > 0 ? `${currentBreakWindow} mins slot` : 'Set valid times'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <input
                        type="number"
                        min="1"
                        max={currentBreakWindow > 0 ? currentBreakWindow : 180}
                        required
                        value={shiftBreakMinutes}
                        onChange={(e) => setShiftBreakMinutes(parseInt(e.target.value) || 0)}
                        className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold text-xs text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                      />
                      <span className="text-xs font-bold text-slate-600">mins</span>
                    </div>
                  </div>

                  {/* Quick Preset Chips */}
                  {currentBreakWindow > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Quick Presets:</span>
                      {[15, 30, 45, 60]
                        .filter((m) => m < currentBreakWindow)
                        .map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setShiftBreakMinutes(m)}
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              shiftBreakMinutes === m
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {m}m
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setShiftBreakMinutes(currentBreakWindow)}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          shiftBreakMinutes === currentBreakWindow
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        Full Window ({currentBreakWindow}m)
                      </button>
                    </div>
                  )}

                  {/* Immediate Inline Warning if break exceeds window */}
                  {shiftBreakMinutes > currentBreakWindow && currentBreakWindow > 0 && (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                      <span>Allowed break ({shiftBreakMinutes}m) cannot exceed the break window of {currentBreakWindow}m.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4: PHOTO-VERIFICATION RULES FOR THIS SHIFT */}
              <div 
                style={{ backgroundColor: shiftSelfieRequired ? '#f0fdf4' : '#ffffff', color: '#0f172a' }}
                className={`p-3.5 rounded-xl border transition-all ${shiftSelfieRequired ? 'border-emerald-500 shadow-sm' : 'border-slate-200'}`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shiftSelfieRequired}
                    onChange={(e) => setShiftSelfieRequired(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      Require Selfie Verification for this Shift
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Forces employees on this shift to take a live camera photo when checking in or checking out.
                    </span>
                  </div>
                </label>
              </div>

              {/* SECTION 5: GEOFENCING RESTRICTIONS FOR THIS SHIFT */}
              <div 
                style={{ backgroundColor: shiftGeoFencingEnabled ? '#f0fdf4' : '#ffffff', color: '#0f172a' }}
                className={`p-3.5 rounded-xl border transition-all ${shiftGeoFencingEnabled ? 'border-emerald-500 shadow-sm' : 'border-slate-200'}`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shiftGeoFencingEnabled}
                    onChange={(e) => setShiftGeoFencingEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Enable Location-based Geofencing Check for this Shift
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Validates employee GPS coordinates are inside hospital or department premises during check-in/out.
                    </span>
                  </div>
                </label>

                {shiftGeoFencingEnabled && (
                  <div className="pt-3.5 mt-3 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Shift Latitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder={formData.geoLat ? `Default (${formData.geoLat})` : "e.g. 28.6139"}
                          value={shiftGeoLat ?? ''}
                          onChange={(e) => setShiftGeoLat(e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Shift Longitude</label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder={formData.geoLng ? `Default (${formData.geoLng})` : "e.g. 77.2090"}
                          value={shiftGeoLng ?? ''}
                          onChange={(e) => setShiftGeoLng(e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Allowed Radius (Meters)</label>
                        <input
                          type="number"
                          min="20"
                          max="10000"
                          value={shiftGeoRadius}
                          onChange={(e) => setShiftGeoRadius(parseInt(e.target.value) || 200)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleGetShiftCurrentLocation}
                        disabled={shiftGeoLocating}
                        className="w-full sm:w-auto justify-center px-3.5 py-2 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>{shiftGeoLocating ? 'Locating...' : 'Set Coordinates from My Current Location'}</span>
                      </button>
                      <span className="text-[10px] text-slate-500 italic">
                        * Leave blank to inherit the company's default office geofence.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 6: DEFAULT SHIFT ASSIGNMENT */}
              <div className="pt-1">
                <div 
                  style={{ backgroundColor: shiftIsDefault ? '#fffbeb' : '#ffffff', color: '#0f172a' }}
                  className={`p-3 rounded-xl border transition-all ${shiftIsDefault ? 'border-amber-300 shadow-xs' : 'border-slate-200'}`}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftIsDefault}
                      onChange={(e) => setShiftIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        Set as Default Shift
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        New employees will automatically be assigned this shift by default.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Centered Action Buttons in Sticky Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[300px] max-w-sm">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="w-full px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShift}
                  className="w-full px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-center"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>{savingShift ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
