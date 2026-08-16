import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Settings,
  User,
  Calendar,
  Play,
  Square,
  Download,
  Search,
  RefreshCw,
  Eye
} from 'lucide-react';
import '../styles/attendance.css';

interface Break {
  id: string;
  breakStart: string;
  breakEnd: string | null;
  durationMinutes: number | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkInSelfie: string | null;
  checkOutSelfie: string | null;
  status: string;
  lateBy: number | null;
  earlyExitBy: number | null;
  isWithinGeofence: boolean;
  isHalfDay: boolean;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  breaks: Break[];
  employee?: {
    name: string;
    employeeCode: string;
    department?: { name: string };
  };
}

interface AttendanceConfig {
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  breakDurationMinutes: number;
  breakStartTime?: string;
  breakEndTime?: string;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusMeters: number;
  geoFencingEnabled: boolean;
  selfieRequired: boolean;
}

export default function AttendanceManagement() {
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('*'));

  const [activeTab, setActiveTab] = useState<'my' | 'admin'>(isAdmin ? 'admin' : 'my');
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [adminRecords, setAdminRecords] = useState<AttendanceRecord[]>([]);
  const [adminReport, setAdminReport] = useState<any | null>(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [adminFilterDate, setAdminFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // Loading & Messages
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Geo-location state
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);

  // Camera / Selfie state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'in' | 'out'>('in');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchConfig();
    fetchTodayStatus();
    fetchMyHistory();
    if (isAdmin) {
      fetchAdminRecords();
      fetchAdminReport();
    }
  }, [filterMonth, filterYear, adminFilterDate, activeTab]);

  // Geolocation watch
  useEffect(() => {
    if (navigator.geolocation) {
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setGeoLoading(false);
        },
        (error) => {
          console.error('Error getting location', error);
          setGeoLoading(false);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Calculate local distance to determine geofence client-side
  useEffect(() => {
    if (coords && config && config.geoFencingEnabled && config.geoLat && config.geoLng) {
      const dist = haversineDistance(
        config.geoLat,
        config.geoLng,
        coords.latitude,
        coords.longitude
      );
      setIsWithinRadius(dist <= config.geoRadiusMeters);
    } else {
      setIsWithinRadius(null);
    }
  }, [coords, config]);

  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchConfig = async () => {
    try {
      const res = await api.get('/attendance/config');
      if (res.data?.status === 'success') {
        setConfig(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const res = await api.get('/attendance/today');
      if (res.data?.status === 'success') {
        setTodayRecord(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyHistory = async () => {
    try {
      const res = await api.get(`/attendance/my?month=${filterMonth}&year=${filterYear}`);
      if (res.data?.status === 'success') {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminRecords = async () => {
    try {
      const res = await api.get(`/attendance/all?date=${adminFilterDate}`);
      if (res.data?.status === 'success') {
        setAdminRecords(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminReport = async () => {
    try {
      const res = await api.get(`/attendance/report?month=${filterMonth}&year=${filterYear}`);
      if (res.data?.status === 'success') {
        setAdminReport(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Camera Management
  const startCamera = async (mode: 'in' | 'out') => {
    setCameraMode(mode);
    setCapturedPhoto(null);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting camera', err);
      setMessage({ text: 'Unable to access camera. Please check permissions.', type: 'error' });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
      }
    }
  };

  // Convert base64 DataURL to file blob
  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Check In/Out flow
  const handleCheckInOut = async (mode: 'in' | 'out') => {
    // If mobile web or config requires selfie, open camera first
    const isMobile = window.innerWidth <= 768;
    if ((config?.selfieRequired || isMobile) && !capturedPhoto) {
      startCamera(mode);
      return;
    }

    setActionLoading(true);
    setMessage(null);

    const formData = new FormData();
    if (coords) {
      formData.append('latitude', coords.latitude.toString());
      formData.append('longitude', coords.longitude.toString());
    }

    if (capturedPhoto) {
      const blob = dataURLtoBlob(capturedPhoto);
      formData.append('selfie', blob, 'selfie.jpg');
    }

    try {
      const endpoint = mode === 'in' ? '/attendance/check-in' : '/attendance/check-out';
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.status === 'success') {
        setMessage({ text: res.data.message, type: 'success' });
        stopCamera();
        setCapturedPhoto(null);
        fetchTodayStatus();
        fetchMyHistory();
      }
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || `Failed to check ${mode}.`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBreak = async (action: 'start' | 'end') => {
    setActionLoading(true);
    setMessage(null);
    try {
      const endpoint = action === 'start' ? '/attendance/break/start' : '/attendance/break/end';
      const res = await api.post(endpoint);
      if (res.data?.status === 'success') {
        setMessage({ text: res.data.message, type: 'success' });
        fetchTodayStatus();
        fetchMyHistory();
      }
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || `Failed to ${action} break.`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDuration = (min: number | null) => {
    if (!min) return '--';
    const hrs = Math.floor(min / 60);
    const mins = min % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="att-root p-6">
      {/* Tab Selectors */}
      {isAdmin && (
        <div className="flex gap-4 mb-6 border-b border-white/5 pb-4">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            Attendance Dashboard
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'my'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            My Attendance
          </button>
        </div>
      )}

      {/* Global Alerts */}
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

      {/* ══════════════════════════════════════════════════════════════════════════════
          TAB: MY ATTENDANCE
          ══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'my' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main check-in panel */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="att-action-panel">
              {/* Clock Widget */}
              <div>
                <div className="att-clock">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                <div className="att-clock-date">
                  {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {/* Geofence verification status */}
              {config?.geoFencingEnabled && (
                <div className="att-geo-status">
                  <div
                    className={`att-geo-dot ${
                      geoLoading ? 'loading' : isWithinRadius ? 'inside' : 'outside'
                    }`}
                  />
                  <span className="text-xs text-gray-300">
                    {geoLoading
                      ? 'Acquiring GPS location...'
                      : isWithinRadius
                      ? 'Within Office Geofence'
                      : 'Outside Geofence'}
                  </span>
                </div>
              )}

              {/* Check-In/Out Circle Button */}
              {!todayRecord || todayRecord.status === 'CHECKED_OUT' ? (
                <button
                  onClick={() => handleCheckInOut('in')}
                  disabled={actionLoading || (config?.geoFencingEnabled && isWithinRadius === false)}
                  className="att-btn-checkin"
                >
                  <Clock className="w-8 h-8" />
                  <span>CHECK IN</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    {config?.geoFencingEnabled && isWithinRadius === false ? 'Disabled (Outside)' : 'Arrival'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => handleCheckInOut('out')}
                  disabled={actionLoading || todayRecord.status === 'ON_BREAK'}
                  className="att-btn-checkout"
                >
                  <Clock className="w-8 h-8" />
                  <span>CHECK OUT</span>
                  <span className="text-[10px] opacity-75 font-normal">Departure</span>
                </button>
              )}

              {/* Break Button */}
              {todayRecord && todayRecord.status !== 'CHECKED_OUT' && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => handleBreak(todayRecord.status === 'ON_BREAK' ? 'end' : 'start')}
                    className={`att-btn-break ${todayRecord.status === 'ON_BREAK' ? 'active' : ''}`}
                    disabled={actionLoading}
                  >
                    {todayRecord.status === 'ON_BREAK' ? (
                      <span className="flex items-center gap-2">
                        <Square className="w-4 h-4" /> End Break
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Play className="w-4 h-4" /> Start Break
                      </span>
                    )}
                  </button>
                  <span className="text-xs text-gray-400 font-medium">
                    Allowed Break: {config?.breakDurationMinutes || 60} mins
                  </span>
                  {config?.breakStartTime && config?.breakEndTime && (
                    <span className="text-[10px] text-amber-400 font-semibold">
                      Allowed Slot: {config.breakStartTime} - {config.breakEndTime}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Today's Timeline / Details */}
            {todayRecord && (
              <div className="att-timeline">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Today's Timeline</h4>
                <div className="att-timeline-item">
                  <div className="att-timeline-dot checkin" />
                  <div className="att-timeline-time">
                    {new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="att-timeline-label">Checked In</div>
                </div>

                {todayRecord.breaks.map((b) => (
                  <React.Fragment key={b.id}>
                    <div className="att-timeline-line" />
                    <div className="att-timeline-item">
                      <div className="att-timeline-dot break" />
                      <div className="att-timeline-time">
                        {new Date(b.breakStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="att-timeline-label">
                        Break started {b.breakEnd ? `(Duration: ${b.durationMinutes} mins)` : '(Ongoing)'}
                      </div>
                    </div>
                  </React.Fragment>
                ))}

                {todayRecord.checkOutTime && (
                  <>
                    <div className="att-timeline-line" />
                    <div className="att-timeline-item">
                      <div className="att-timeline-dot checkout" />
                      <div className="att-timeline-time">
                        {new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="att-timeline-label">Checked Out</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* History Panel */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-900/40">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Attendance Log</h3>
                  <p className="text-xs text-gray-400 mt-1">Review check-in history for this month</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs px-3 py-2 outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs px-3 py-2 outline-none"
                  >
                    {[2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Check-In</th>
                      <th className="pb-3">Check-Out</th>
                      <th className="pb-3">Work Hours</th>
                      <th className="pb-3">Break Duration</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-500 font-medium">
                          No logs found for this period.
                        </td>
                      </tr>
                    ) : (
                      history.map((record) => (
                        <tr key={record.id} className="hover:bg-white/5">
                          <td className="py-3.5 font-semibold text-white">
                            {new Date(record.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-3.5 text-gray-300">
                            {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {record.lateBy && (
                              <span className="text-[10px] text-amber-400 font-bold ml-2">
                                (+{record.lateBy}m late)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-gray-300">
                            {record.checkOutTime
                              ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '--'}
                          </td>
                          <td className="py-3.5 font-medium text-indigo-300">
                            {formatDuration(record.totalWorkMinutes)}
                          </td>
                          <td className="py-3.5 text-gray-400">
                            {formatDuration(record.totalBreakMinutes)}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                record.status === 'CHECKED_OUT'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : record.status === 'ON_BREAK'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              }`}
                            >
                              {record.status}
                            </span>
                            {record.isHalfDay && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Half Day
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════
          TAB: ADMIN DASHBOARD
          ══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'admin' && (
        <div className="flex flex-col gap-6">
          {/* KPI Dashboard Cards */}
          {adminReport && (
            <div className="att-kpi-grid">
              <div className="att-kpi-card flex flex-col justify-between">
                <span className="att-kpi-value text-emerald-400">{adminReport.summary.presentToday}</span>
                <span className="att-kpi-label">Present Today</span>
              </div>
              <div className="att-kpi-card flex flex-col justify-between">
                <span className="att-kpi-value text-amber-400">{adminReport.summary.lateToday}</span>
                <span className="att-kpi-label">Late Arrivals Today</span>
              </div>
              <div className="att-kpi-card flex flex-col justify-between">
                <span className="att-kpi-value text-rose-400">{adminReport.summary.absentToday}</span>
                <span className="att-kpi-label">Absent Today</span>
              </div>
              <div className="att-kpi-card flex flex-col justify-between">
                <span className="att-kpi-value text-indigo-400">{adminReport.summary.totalEmployees}</span>
                <span className="att-kpi-label">Total Strength</span>
              </div>
            </div>
          )}

          {/* Admin Record Tables */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-900/40">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">All Employee Attendance</h3>
                <p className="text-xs text-gray-400 mt-1">Review active logs and check GPS/Selfie details</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={adminFilterDate}
                  onChange={(e) => setAdminFilterDate(e.target.value)}
                  className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs px-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Check-In</th>
                    <th className="pb-3">Check-Out</th>
                    <th className="pb-3">Total Work</th>
                    <th className="pb-3">Break</th>
                    <th className="pb-3">Verifications</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {adminRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-medium">
                        No employees checked in on this date.
                      </td>
                    </tr>
                  ) : (
                    adminRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-white/5">
                        <td className="py-3.5">
                          <div className="font-semibold text-white">{record.employee?.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {record.employee?.employeeCode} • {record.employee?.department?.name || 'General'}
                          </div>
                        </td>
                        <td className="py-3.5 text-gray-300">
                          {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {record.lateBy && (
                            <span className="text-[10px] text-rose-400 font-bold ml-2">
                              (+{record.lateBy}m late)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 text-gray-300">
                          {record.checkOutTime
                            ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '--'}
                          {record.earlyExitBy && (
                            <span className="text-[10px] text-amber-400 font-bold ml-2">
                              ({record.earlyExitBy}m early)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 font-medium text-indigo-300">
                          {formatDuration(record.totalWorkMinutes)}
                        </td>
                        <td className="py-3.5 text-gray-400">
                          {formatDuration(record.totalBreakMinutes)}
                        </td>
                        <td className="py-3.5">
                          <div className="flex gap-2">
                            {/* GPS Status */}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                record.isWithinGeofence
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                              title={`In: ${record.checkInLat},${record.checkInLng}`}
                            >
                              {record.isWithinGeofence ? 'Geofenced' : 'Geo Breach'}
                            </span>
                            {/* Selfie Status */}
                            {(record.checkInSelfie || record.checkOutSelfie) && (
                              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                                <Camera className="w-2.5 h-2.5" /> Selfie
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              record.status === 'CHECKED_OUT'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : record.status === 'ON_BREAK'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {record.status}
                          </span>
                          {record.isHalfDay && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Half Day
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════
          SELFIE CAMERA OVERLAY
          ══════════════════════════════════════════════════════════════════════════════ */}
      {showCamera && (
        <div className="att-selfie-overlay">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-400" />
              Capture Selfie Verification
            </h3>
            <p className="text-xs text-gray-400 text-center">
              Please align your face inside the circle to mark your attendance.
            </p>

            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured Selfie" className="att-selfie-video" />
            ) : (
              <video ref={videoRef} autoPlay playsInline className="att-selfie-video" />
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="att-selfie-actions w-full justify-center">
              {capturedPhoto ? (
                <>
                  <button
                    onClick={() => setCapturedPhoto(null)}
                    className="px-4 py-2 bg-slate-800 text-gray-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
                  >
                    Retake
                  </button>
                  <button
                    onClick={() => handleCheckInOut(cameraMode)}
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    {actionLoading ? 'Saving...' : 'Submit Attendance'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 bg-slate-800 text-gray-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Capture Frame
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
