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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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
      return `Shift End Time (${endTime}) must be later than Start Time (${startTime}). If shift crosses midnight, please toggle "Night Shift".`;
    }
    if (bStartM < startM || bStartM >= endM) {
      return `Break Allowed From (${breakStartTime}) is outside working hours (${startTime} - ${endTime}). Break must occur during the shift.`;
    }
    if (bEndM <= startM || bEndM > endM) {
      return `Break Allowed Until (${breakEndTime}) is outside working hours (${startTime} - ${endTime}). Break must occur during the shift.`;
    }
    if (bEndM <= bStartM) {
      return `Break Allowed Until (${breakEndTime}) must be later than Break Allowed From (${breakStartTime}).`;
    }
    const windowMinutes = bEndM - bStartM;
    if (breakDurationMinutes > windowMinutes) {
      return `Allowed Break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${breakStartTime} - ${breakEndTime}).`;
    }
  } else {
    // Night shift (crosses midnight, e.g. 23:00 to 07:00)
    const isWithinNightShift = (m: number) => m >= startM || m <= endM;
    if (!isWithinNightShift(bStartM)) {
      return `Break Allowed From (${breakStartTime}) is outside night shift hours (${startTime} - ${endTime}). Break must occur during the shift.`;
    }
    if (!isWithinNightShift(bEndM)) {
      return `Break Allowed Until (${breakEndTime}) is outside night shift hours (${startTime} - ${endTime}). Break must occur during the shift.`;
    }

    let windowMinutes = 0;
    if (bStartM >= startM && bEndM <= endM) {
      windowMinutes = (1440 - bStartM) + bEndM;
    } else if ((bStartM >= startM && bEndM >= startM) || (bStartM <= endM && bEndM <= endM)) {
      if (bEndM <= bStartM) {
        return `Break Allowed Until (${breakEndTime}) must be later than Break Allowed From (${breakStartTime}).`;
      }
      windowMinutes = bEndM - bStartM;
    } else {
      return `Break window (${breakStartTime} - ${breakEndTime}) is invalid for night shift (${startTime} - ${endTime}).`;
    }

    if (breakDurationMinutes > windowMinutes) {
      return `Allowed Break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${breakStartTime} - ${breakEndTime}).`;
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
    setShiftStartTime('09:00');
    setShiftEndTime('18:00');
    setShiftGraceMinutes(15);
    setShiftHalfDayHours(4);
    setShiftBreakMinutes(60);
    setShiftBreakStart('13:00');
    setShiftBreakEnd('14:00');
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

    // Pre-validate break timings against shift hours
    const [startH, startM] = shiftStartTime.split(':').map(Number);
    const [endH, endM] = shiftEndTime.split(':').map(Number);
    const effectiveNight = shiftIsNight || (endH * 60 + endM <= startH * 60 + startM);

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
    <div className="att-root max-w-5xl p-6 text-left">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Header */}
        <div className="border-b border-slate-100 pb-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
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
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('shifts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Company Shifts ({shifts.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Verification & Geofence
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-sm hover:shadow transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
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
                        <div className="pt-2 flex items-center gap-2 text-emerald-700 font-mono text-base font-bold">
                          <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {shift.startTime} <span className="text-slate-400 font-sans font-normal">&rarr;</span> {shift.endTime}
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
                          {shift.breakStartTime || '--'} - {shift.breakEndTime || '--'}
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
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Office Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.officeStartTime}
                    onChange={(e) => setFormData({ ...formData, officeStartTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Office End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.officeEndTime}
                    onChange={(e) => setFormData({ ...formData, officeEndTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
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
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Break Allowed From</label>
                  <input
                    type="time"
                    required
                    value={formData.breakStartTime}
                    onChange={(e) => setFormData({ ...formData, breakStartTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Time slot when break starts (e.g. 01:00 PM).</p>
                </div>
                <div className="att-config-field">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Break Allowed Until</label>
                  <input
                    type="time"
                    required
                    value={formData.breakEndTime}
                    onChange={(e) => setFormData({ ...formData, breakEndTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Time slot when break ends (e.g. 02:00 PM).</p>
                </div>
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
                        className="px-4 py-2 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        {geoLocating ? 'Locating...' : 'Set Coordinates from My Current Location'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Verification Settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SHIFT ADD / EDIT MODAL (LIGHT THEME) */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl animate-zoom-in text-left">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                {editingShift ? `Edit Shift: ${editingShift.name}` : 'Create New Operational Shift'}
              </h3>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {shiftFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{shiftFormError}</span>
                </div>
              )}

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

              {/* SECTION 2: WORKING HOURS & THRESHOLDS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
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

              {/* SECTION 3: BREAK ALLOWED WINDOW */}
              <div 
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                className="p-4 rounded-xl border border-slate-200 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Break Allowed Window</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Break Allowed From</label>
                    <input
                      type="time"
                      value={shiftBreakStart}
                      onChange={(e) => setShiftBreakStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Break Allowed Until</label>
                    <input
                      type="time"
                      value={shiftBreakEnd}
                      onChange={(e) => setShiftBreakEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Allowed Break (Mins)</label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      required
                      value={shiftBreakMinutes}
                      onChange={(e) => setShiftBreakMinutes(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Defines the permissible break time slot and maximum duration for this specific shift.
                </p>
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
                        className="px-3.5 py-1.5 border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm self-start"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        {shiftGeoLocating ? 'Locating...' : 'Set Coordinates from My Current Location'}
                      </button>
                      <span className="text-[10px] text-slate-500 italic">
                        * Leave blank to inherit the company's default office geofence.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 6: NIGHT SHIFT & DEFAULT TOGGLES */}
              <div className="space-y-2 pt-1">
                <div 
                  style={{ backgroundColor: shiftIsNight ? '#faf5ff' : '#ffffff', color: '#0f172a' }}
                  className={`p-3 rounded-xl border transition-all ${shiftIsNight ? 'border-purple-300' : 'border-slate-200'}`}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftIsNight}
                      onChange={(e) => setShiftIsNight(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-purple-600" />
                        Night Shift (Crosses Midnight)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Enables overnight handling for evening-to-morning duties (e.g. 23:00 to 07:00).
                      </span>
                    </div>
                  </label>
                </div>

                <div 
                  style={{ backgroundColor: shiftIsDefault ? '#fffbeb' : '#ffffff', color: '#0f172a' }}
                  className={`p-3 rounded-xl border transition-all ${shiftIsDefault ? 'border-amber-300' : 'border-slate-200'}`}
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
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        Set as Default Shift
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        New employees will automatically be assigned this shift by default.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShift}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingShift ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
