import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  Navigation
} from 'lucide-react';
import '../styles/attendance.css';

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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchConfig();
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

    // Validate Lat/Lng if geofencing is enabled
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
        <div className="text-gray-400 text-sm font-semibold">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="att-root max-w-4xl p-6">
      <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-slate-900/40">
        <div className="border-b border-white/5 pb-4 mb-6">
          <h2 className="text-lg font-bold text-white">Attendance Timings & Verification Settings</h2>
          <p className="text-xs text-gray-400 mt-1">
            Configure default working hours, grace thresholds, geofencing limits, and selfie verification rules.
          </p>
        </div>

        {message && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-semibold">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Working Timings Section */}
          <div>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Office Shift Timings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="att-config-field">
                <label>Office Start Time</label>
                <input
                  type="time"
                  required
                  value={formData.officeStartTime}
                  onChange={(e) => setFormData({ ...formData, officeStartTime: e.target.value })}
                />
              </div>
              <div className="att-config-field">
                <label>Office End Time</label>
                <input
                  type="time"
                  required
                  value={formData.officeEndTime}
                  onChange={(e) => setFormData({ ...formData, officeEndTime: e.target.value })}
                />
              </div>
              <div className="att-config-field">
                <label>Grace Period (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={formData.graceMinutes}
                  onChange={(e) => setFormData({ ...formData, graceMinutes: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-gray-500 mt-1">Allowed delay minutes before marking arrival as late.</p>
              </div>
              <div className="att-config-field">
                <label>Allowed Break Duration (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  required
                  value={formData.breakDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, breakDurationMinutes: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-gray-500 mt-1">Total combined break duration allocated to employees.</p>
              </div>
              <div className="att-config-field">
                <label>Half-Day Minimum Work Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="12"
                  required
                  value={formData.halfDayMinutes / 60}
                  onChange={(e) => setFormData({ ...formData, halfDayMinutes: Math.round(parseFloat(e.target.value) * 60) || 240 })}
                />
                <p className="text-[10px] text-gray-500 mt-1">Minimum hours an employee must work to avoid a Half Day penalty.</p>
              </div>
              <div className="att-config-field">
                <label>Break Allowed From</label>
                <input
                  type="time"
                  required
                  value={formData.breakStartTime}
                  onChange={(e) => setFormData({ ...formData, breakStartTime: e.target.value })}
                />
                <p className="text-[10px] text-gray-500 mt-1">Time slot when break starts (e.g. 01:00 PM).</p>
              </div>
              <div className="att-config-field">
                <label>Break Allowed Until</label>
                <input
                  type="time"
                  required
                  value={formData.breakEndTime}
                  onChange={(e) => setFormData({ ...formData, breakEndTime: e.target.value })}
                />
                <p className="text-[10px] text-gray-500 mt-1">Time slot when break ends (e.g. 02:00 PM).</p>
              </div>
            </div>
          </div>

          <hr className="border-white/5 my-2" />

          {/* Verification Rules (Selfie) */}
          <div>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Photo-Verification Rules
            </h3>
            <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <div className="att-config-toggle">
                <input
                  type="checkbox"
                  id="selfieRequired"
                  checked={formData.selfieRequired}
                  onChange={(e) => setFormData({ ...formData, selfieRequired: e.target.checked })}
                />
                <div>
                  <label htmlFor="selfieRequired" className="text-sm font-bold text-white cursor-pointer block">
                    Require Selfie Verification
                  </label>
                  <span className="text-xs text-gray-400 block mt-1">
                    Forces employees to take a real-time front camera selfie when checking in or checking out.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-white/5 my-2" />

          {/* Geofencing Config */}
          <div>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Geofencing Restrictions
            </h3>
            <div className="flex flex-col gap-4 bg-slate-900/60 p-4 rounded-xl border border-white/5">
              <div className="att-config-toggle">
                <input
                  type="checkbox"
                  id="geoFencingEnabled"
                  checked={formData.geoFencingEnabled}
                  onChange={(e) => setFormData({ ...formData, geoFencingEnabled: e.target.checked })}
                />
                <div>
                  <label htmlFor="geoFencingEnabled" className="text-sm font-bold text-white cursor-pointer block">
                    Enable Location-based Geofencing Check
                  </label>
                  <span className="text-xs text-gray-400 block mt-1">
                    Validates employee GPS coordinates are inside office boundaries during check-in/out.
                  </span>
                </div>
              </div>

              {formData.geoFencingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="att-config-field">
                    <label>Office Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formData.geoLat || ''}
                      onChange={(e) => setFormData({ ...formData, geoLat: parseFloat(e.target.value) || null })}
                      placeholder="e.g. 28.6139"
                    />
                  </div>
                  <div className="att-config-field">
                    <label>Office Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={formData.geoLng || ''}
                      onChange={(e) => setFormData({ ...formData, geoLng: parseFloat(e.target.value) || null })}
                      placeholder="e.g. 77.2090"
                    />
                  </div>
                  <div className="att-config-field">
                    <label>Allowed Radius (Meters)</label>
                    <input
                      type="number"
                      min="50"
                      max="5000"
                      required
                      value={formData.geoRadiusMeters}
                      onChange={(e) => setFormData({ ...formData, geoRadiusMeters: parseInt(e.target.value) || 200 })}
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-start">
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      disabled={geoLocating}
                      className="px-4 py-2 border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      {geoLocating ? 'Locating...' : 'Set Coordinates from My Location'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 border-t border-white/5 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Timing Configuration...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
