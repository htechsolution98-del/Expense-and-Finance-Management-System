import React, { useState, useEffect, useRef } from 'react';
import { api, getBackendUrl } from '../services/api';
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
  Eye,
  Plus,
  X
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

const getSelfieUrl = (path: string) => {
  if (!path) return '';
  const cleanPath = path.replace(/\\/g, '/');
  const fileName = cleanPath.split('/').pop();
  return `${getBackendUrl()}/uploads/${fileName}`;
};

export default function AttendanceManagement() {
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const isAdmin = user && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.permissions?.includes('*'));
  const isSuperAdmin = user && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('*'));

  const [activeTab, setActiveTab] = useState<'my' | 'admin' | 'wfh'>(isAdmin ? 'admin' : 'my');
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [adminRecords, setAdminRecords] = useState<AttendanceRecord[]>([]);
  const [adminReport, setAdminReport] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  // Filters
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [adminFilterDate, setAdminFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [adminFilterType, setAdminFilterType] = useState<'ALL' | 'PRESENT' | 'LATE' | 'ABSENT'>('ALL');
  const [adminFilterMode, setAdminFilterMode] = useState<'single' | 'range'>('single');
  const [adminStartDate, setAdminStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [adminEndDate, setAdminEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Loading & Messages
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Geo-location state
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean | null>(null);
  const [myAllowWFH, setMyAllowWFH] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [viewingSelfieRecord, setViewingSelfieRecord] = useState<AttendanceRecord | null>(null);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('18:00');

  // Camera / Selfie state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'in' | 'out'>('in');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clock
  const [time, setTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setSecondsSinceRefresh((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Auto-polling: silently refresh attendance data every 30 seconds ──────────
  useEffect(() => {
    if (!isAdmin) return;
    const poll = setInterval(() => {
      fetchAdminRecords();
      fetchAdminReport();
      fetchTodayStatus();
      setLastRefresh(new Date());
      setSecondsSinceRefresh(0);
    }, 30000); // every 30s
    return () => clearInterval(poll);
  }, [adminFilterDate, adminStartDate, adminEndDate, adminFilterMode, activeTab]);

  // My attendance auto-refresh every 30s
  useEffect(() => {
    if (isAdmin) return;
    const poll = setInterval(() => {
      fetchTodayStatus();
      fetchMyHistory();
      setLastRefresh(new Date());
      setSecondsSinceRefresh(0);
    }, 30000);
    return () => clearInterval(poll);
  }, [filterMonth, filterYear]);

  // Fetch initial data
  useEffect(() => {
    fetchConfig();
    fetchTodayStatus();
    fetchMyHistory();
    if (isAdmin) {
      fetchAdminRecords();
      fetchAdminReport();
      if (activeTab === 'wfh' || activeTab === 'admin') {
        fetchEmployeesList();
      }
    }
  }, [filterMonth, filterYear, adminFilterDate, adminStartDate, adminEndDate, adminFilterMode, activeTab]);

  // Reset filter type when date changes
  useEffect(() => {
    setAdminFilterType('ALL');
  }, [adminFilterDate, adminStartDate, adminEndDate, adminFilterMode]);

  // Filter records based on selected KPI card
  const filteredRecords = adminRecords.filter((record) => {
    if (adminFilterType === 'ALL') return true;
    if (adminFilterType === 'PRESENT') return record.status !== 'ABSENT';
    if (adminFilterType === 'LATE') return record.lateBy !== null && record.lateBy > 0;
    if (adminFilterType === 'ABSENT') return record.status === 'ABSENT';
    return true;
  });

  // Pagination for admin records
  const [attPage, setAttPage] = useState(1);
  const attItemsPerPage = 10;

  // Reset to page 1 when filter changes
  useEffect(() => {
    setAttPage(1);
  }, [adminFilterType, adminFilterDate, adminStartDate, adminEndDate, adminFilterMode]);

  const attTotalPages = Math.ceil(filteredRecords.length / attItemsPerPage);
  const attIndexFirst = (attPage - 1) * attItemsPerPage;
  const attIndexLast = attIndexFirst + attItemsPerPage;
  const currentPageRecords = filteredRecords.slice(attIndexFirst, attIndexLast);

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
        setMyAllowWFH(res.data.allowWFH || false);
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
      let url = `/attendance/all`;
      if (adminFilterMode === 'single') {
        url += `?date=${adminFilterDate}`;
      } else {
        url += `?startDate=${adminStartDate}&endDate=${adminEndDate}`;
      }
      const res = await api.get(url);
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

  const downloadAttendanceCSV = () => {
    if (filteredRecords.length === 0) return;

    let csvContent = 'Date,Employee Code,Employee Name,Department,Check-In,Check-Out,Total Work,Break,Verification,Status\n';

    filteredRecords.forEach((record) => {
      const dateStr = new Date(record.date).toLocaleDateString();
      const empCode = record.employee?.employeeCode || '';
      const empName = record.employee?.name || '';
      const deptName = record.employee?.department?.name || 'General';
      const checkIn = record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      const checkOut = record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      
      const formatDurationText = (min: number | null) => {
        if (!min && min !== 0) return '--';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      };
      
      const totalWork = formatDurationText(record.totalWorkMinutes);
      const totalBreak = formatDurationText(record.totalBreakMinutes);
      const verification = record.status !== 'ABSENT' ? (record.isWithinGeofence ? 'Geofenced' : 'Geo Breach') : '--';
      const status = record.isHalfDay ? `${record.status} (Half Day)` : record.status;

      csvContent += `"${dateStr}","${empCode}","${empName}","${deptName}","${checkIn}","${checkOut}","${totalWork}","${totalBreak}","${verification}","${status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = `attendance_report_${adminFilterMode === 'single' ? adminFilterDate : `${adminStartDate}_to_${adminEndDate}`}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchEmployeesList = async () => {
    try {
      const res = await api.get('/masters/employees');
      if (res.data?.success || res.data?.status === 'success') {
        setEmployees(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleWFH = async (empId: string, currentVal: boolean) => {
    try {
      const res = await api.patch(`/attendance/employees/${empId}/wfh`, {
        allowWFH: !currentVal,
      });
      if (res.data?.success || res.data?.status === 'success') {
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === empId ? { ...emp, allowWFH: !currentVal } : emp))
        );
        setMessage({ text: res.data.message || 'WFH permission updated.', type: 'success' });
        setLastRefresh(new Date());
        setSecondsSinceRefresh(0);
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: err.response?.data?.message || 'Failed to update WFH permission.',
        type: 'error',
      });
    }
  };

  const handleManualAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await api.post('/attendance/manual', {
        employeeId: manualEmpId,
        date: manualDate,
        checkInTimeStr: manualCheckIn,
        checkOutTimeStr: manualCheckOut || null,
      });

      if (res.data?.success || res.data?.status === 'success') {
        setMessage({ text: res.data.message || 'Manual attendance processed successfully.', type: 'success' });
        setShowManualModal(false);
        setManualEmpId('');
        fetchAdminRecords();
        fetchAdminReport();
        setLastRefresh(new Date());
        setSecondsSinceRefresh(0);
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({
        text: err.response?.data?.message || 'Failed to submit manual attendance.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
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

  const formatDuration = (min: number | null | undefined) => {
    if (min === null || min === undefined) return '--';
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
            onClick={() => setActiveTab('wfh')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'wfh'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            WFH Settings
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
                      geoLoading ? 'loading' : (isWithinRadius || myAllowWFH) ? 'inside' : 'outside'
                    }`}
                  />
                  <span className="text-xs text-gray-300">
                    {geoLoading
                      ? 'Acquiring GPS location...'
                      : myAllowWFH
                      ? 'Work From Home Allowed'
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
                  disabled={actionLoading || (config?.geoFencingEnabled && !myAllowWFH && isWithinRadius === false)}
                  className="att-btn-checkin"
                >
                  <Clock className="w-8 h-8" />
                  <span>CHECK IN</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    {config?.geoFencingEnabled && !myAllowWFH && isWithinRadius === false ? 'Disabled (Outside)' : 'Arrival'}
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
                <table className="min-w-full text-left border-collapse">
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
                          {/* Check-Out */}
                          <td className="py-3.5 text-gray-300">
                            {record.checkOutTime
                              ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : (
                                <span className="text-[10px] text-amber-400 font-bold italic">
                                  {record.status === 'CHECKED_IN' ? 'In Progress...' : record.status === 'ON_BREAK' ? 'On Break...' : '--'}
                                </span>
                              )}
                          </td>
                          {/* Work Hours */}
                          <td className="py-3.5 font-medium text-indigo-300">
                            {record.totalWorkMinutes != null
                              ? formatDuration(record.totalWorkMinutes)
                              : record.checkInTime
                              ? (() => {
                                  const elapsed = Math.floor((Date.now() - new Date(record.checkInTime).getTime()) / 60000);
                                  return (
                                    <span className="text-indigo-300/70 italic text-xs">
                                      ~{formatDuration(elapsed)}
                                    </span>
                                  );
                                })()
                              : '--'}
                          </td>
                          {/* Break Duration */}
                          <td className="py-3.5 text-gray-400">
                            {(() => {
                              // Sum all completed breaks
                              const completedBreakMins = record.breaks
                                ?.filter((b) => b.breakEnd != null)
                                .reduce((acc, b) => acc + (b.durationMinutes ?? 0), 0) ?? 0;

                              if (record.status === 'ON_BREAK') {
                                // Find the active (ongoing) break
                                const activeBreak = record.breaks?.find((b) => b.breakEnd == null);
                                const activeMins = activeBreak
                                  ? Math.floor((Date.now() - new Date(activeBreak.breakStart).getTime()) / 60000)
                                  : 0;
                                const total = completedBreakMins + activeMins;
                                return (
                                  <span className="text-amber-400 italic text-xs font-medium">
                                    ~{formatDuration(total)}
                                  </span>
                                );
                              }

                              const total = record.totalBreakMinutes ?? completedBreakMins;
                              return total > 0
                                ? formatDuration(total)
                                : <span className="text-gray-600">0m</span>;
                            })()}
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
              <div
                className={`att-kpi-card flex flex-col justify-between cursor-pointer transition-all border ${
                  adminFilterType === 'PRESENT'
                    ? 'ring-2 ring-emerald-500/50 bg-emerald-50 border-emerald-500'
                    : 'border-slate-200'
                }`}
                onClick={() => setAdminFilterType(adminFilterType === 'PRESENT' ? 'ALL' : 'PRESENT')}
              >
                <span className="att-kpi-value text-emerald-650">{adminReport.summary.presentToday}</span>
                <span className="att-kpi-label">Present Today</span>
              </div>
              <div
                className={`att-kpi-card flex flex-col justify-between cursor-pointer transition-all border ${
                  adminFilterType === 'LATE'
                    ? 'ring-2 ring-amber-500/50 bg-amber-50 border-amber-500'
                    : 'border-slate-200'
                }`}
                onClick={() => setAdminFilterType(adminFilterType === 'LATE' ? 'ALL' : 'LATE')}
              >
                <span className="att-kpi-value text-amber-650">{adminReport.summary.lateToday}</span>
                <span className="att-kpi-label">Late Arrivals Today</span>
              </div>
              <div
                className={`att-kpi-card flex flex-col justify-between cursor-pointer transition-all border ${
                  adminFilterType === 'ABSENT'
                    ? 'ring-2 ring-rose-500/50 bg-rose-50 border-rose-500'
                    : 'border-slate-200'
                }`}
                onClick={() => setAdminFilterType(adminFilterType === 'ABSENT' ? 'ALL' : 'ABSENT')}
              >
                <span className="att-kpi-value text-rose-650">{adminReport.summary.absentToday}</span>
                <span className="att-kpi-label">Absent Today</span>
              </div>
              <div
                className={`att-kpi-card flex flex-col justify-between cursor-pointer transition-all border ${
                  adminFilterType === 'ALL'
                    ? 'ring-2 ring-[var(--primary)]/30 bg-[var(--primary-light)] border-[var(--primary)]'
                    : 'border-slate-200'
                }`}
                onClick={() => setAdminFilterType('ALL')}
              >
                <span className="att-kpi-value text-[var(--primary)]">{adminReport.summary.totalEmployees}</span>
                <span className="att-kpi-label">Total Strength</span>
              </div>
            </div>
          )}

          {/* Admin Record Tables */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                  All Employee Attendance
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                    Live
                  </span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2">
                  Review active logs and check GPS/Selfie details
                  <span className="text-gray-300">•</span>
                  <span className="text-[var(--text-muted)]">
                    Updated {secondsSinceRefresh < 5 ? 'just now' : `${secondsSinceRefresh}s ago`}
                  </span>
                  <button
                    onClick={() => {
                      fetchAdminRecords();
                      fetchAdminReport();
                      fetchTodayStatus();
                      setLastRefresh(new Date());
                      setSecondsSinceRefresh(0);
                    }}
                    className="text-[var(--primary)] hover:underline transition-colors cursor-pointer"
                    title="Refresh now"
                  >
                    Refresh
                  </button>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                {/* Manual Attendance Button */}
                <button
                  onClick={() => setShowManualModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                  title="Add manual attendance entry for any employee"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manual Attendance
                </button>
                {/* Export Button — Super Admin only */}
                {isSuperAdmin && (
                  <button
                    onClick={downloadAttendanceCSV}
                    disabled={filteredRecords.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                    title="Download filtered records as CSV/Excel"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                )}
                {/* Filter Mode Toggle */}
                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button
                    onClick={() => setAdminFilterMode('single')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      adminFilterMode === 'single'
                        ? 'bg-[var(--primary)] text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-850'
                    }`}
                  >
                    Single Date
                  </button>
                  <button
                    onClick={() => setAdminFilterMode('range')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      adminFilterMode === 'range'
                        ? 'bg-[var(--primary)] text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-850'
                    }`}
                  >
                    Date Range
                  </button>
                </div>

                {/* Date Input(s) */}
                {adminFilterMode === 'single' ? (
                  <input
                    type="date"
                    value={adminFilterDate}
                    onChange={(e) => setAdminFilterDate(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-800 rounded-lg text-xs px-3 py-2 outline-none focus:border-[var(--primary)]"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold mb-1">From</span>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => setAdminStartDate(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 rounded-lg text-xs px-3 py-1.5 outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[var(--text-secondary)] uppercase font-bold mb-1">To</span>
                      <input
                        type="date"
                        value={adminEndDate}
                        onChange={(e) => setAdminEndDate(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-800 rounded-lg text-xs px-3 py-1.5 outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider bg-slate-50">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Check-In</th>
                    <th className="pb-3">Check-Out</th>
                    <th className="pb-3">Total Work</th>
                    <th className="pb-3">Break</th>
                    <th className="pb-3">Verifications</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-medium">
                        No employees found matching the filter on this date.
                      </td>
                    </tr>
                  ) : (
                    currentPageRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-white/5">
                        <td className="py-3.5">
                          <div className="font-semibold text-white">{record.employee?.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {record.employee?.employeeCode} • {record.employee?.department?.name || 'General'}
                            {adminFilterMode === 'range' && ` • ${new Date(record.date).toLocaleDateString()}`}
                          </div>
                        </td>
                        <td className="py-3.5 text-gray-300">
                          {record.checkInTime
                            ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '--'}
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
                            {record.status === 'ABSENT' ? (
                              <span className="text-gray-500 font-medium text-xs">--</span>
                            ) : (
                              <>
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
                                  <button
                                    onClick={() => setViewingSelfieRecord(record)}
                                    className="bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Click to view Selfie"
                                  >
                                    <Camera className="w-2.5 h-2.5" /> Selfie
                                  </button>
                                )}
                              </>
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
                                : record.status === 'ABSENT'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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

              {/* Pagination Controls */}
              {filteredRecords.length > 0 && (
                <div className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-gray-400 font-medium">
                    Showing <span className="font-bold text-white">{attIndexFirst + 1}</span> to{' '}
                    <span className="font-bold text-white">{Math.min(attIndexLast, filteredRecords.length)}</span>{' '}
                    of <span className="font-bold text-white">{filteredRecords.length}</span> employees
                  </div>

                  {attTotalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAttPage((p) => Math.max(p - 1, 1))}
                        disabled={attPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent"
                      >
                        Previous
                      </button>

                      {Array.from({ length: attTotalPages }, (_, i) => i + 1).map((pageNum) => {
                        const isFirstOrLast = pageNum === 1 || pageNum === attTotalPages;
                        const isNearCurrent = Math.abs(pageNum - attPage) <= 1;

                        if (isFirstOrLast || isNearCurrent) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setAttPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                attPage === pageNum
                                  ? 'bg-indigo-600 text-white shadow-md border-none'
                                  : 'border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white bg-transparent'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        }

                        if (
                          (pageNum === 2 && attPage > 3) ||
                          (pageNum === attTotalPages - 1 && attPage < attTotalPages - 2)
                        ) {
                          return (
                            <span key={pageNum} className="px-1 text-gray-500 text-xs font-semibold">
                              ...
                            </span>
                          );
                        }

                        return null;
                      })}

                      <button
                        onClick={() => setAttPage((p) => Math.min(p + 1, attTotalPages))}
                        disabled={attPage === attTotalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer bg-transparent"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wfh' && isAdmin && (
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-slate-900/40">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white">Work From Home (WFH) Permissions</h3>
              <p className="text-xs text-gray-400 mt-1">
                Toggle WFH permission for individual employees. When enabled, geofencing coordinates checks are skipped.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <th className="pb-3">Employee Code</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Email & Mobile</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3 text-center">Allow WFH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500 font-medium">
                        No active employees found.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-white/5">
                        <td className="py-3.5 font-mono text-gray-300">{emp.employeeCode}</td>
                        <td className="py-3.5 font-semibold text-white">{emp.name}</td>
                        <td className="py-3.5 text-gray-400 text-xs">
                          <div>{emp.email}</div>
                          <div>{emp.mobile}</div>
                        </td>
                        <td className="py-3.5 text-gray-300">{emp.department?.name || 'General'}</td>
                        <td className="py-3.5 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={emp.allowWFH || false}
                              onChange={() => handleToggleWFH(emp.id, emp.allowWFH || false)}
                              className="sr-only peer"
                            />
                            <div className="relative w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                          </label>
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

      {showManualModal && (
        <div className="att-selfie-overlay">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Mark Manual Attendance
            </h3>
            <p className="text-xs text-gray-400">
              Create or override an attendance record manually. Office rules (late, early exit, half-day) will be computed automatically.
            </p>

            <form onSubmit={handleManualAttendanceSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-300 font-bold">Select Employee</label>
                <select
                  required
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs p-2.5 outline-none"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-300 font-bold">Select Date</label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs p-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-300 font-bold">Check-In Time</label>
                  <input
                    type="time"
                    required
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs p-2.5 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-300 font-bold">Check-Out Time (Optional)</label>
                  <input
                    type="time"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-white rounded-lg text-xs p-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Submit Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selfie Viewer Modal */}
      {viewingSelfieRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-left text-slate-800">
            <button 
              onClick={() => setViewingSelfieRecord(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Selfie Verifications — {viewingSelfieRecord.employee?.name}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Employee Code: {viewingSelfieRecord.employee?.employeeCode} | Date: {new Date(viewingSelfieRecord.date).toLocaleDateString()}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Check-In Selfie */}
              <div className="flex flex-col items-center border border-slate-100 rounded-xl p-4 bg-slate-50">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Check-In Selfie</span>
                {viewingSelfieRecord.checkInSelfie ? (
                  <>
                    <img 
                      src={getSelfieUrl(viewingSelfieRecord.checkInSelfie)} 
                      alt="Check-in Selfie" 
                      className="w-full h-64 object-cover rounded-lg border border-slate-200 shadow-sm"
                    />
                    <span className="text-xs text-slate-500 mt-2 font-medium">
                      Time: {new Date(viewingSelfieRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                    No selfie captured for check-in
                  </div>
                )}
              </div>

              {/* Check-Out Selfie */}
              <div className="flex flex-col items-center border border-slate-100 rounded-xl p-4 bg-slate-50">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Check-Out Selfie</span>
                {viewingSelfieRecord.checkOutSelfie ? (
                  <>
                    <img 
                      src={getSelfieUrl(viewingSelfieRecord.checkOutSelfie)} 
                      alt="Check-out Selfie" 
                      className="w-full h-64 object-cover rounded-lg border border-slate-200 shadow-sm"
                    />
                    <span className="text-xs text-slate-500 mt-2 font-medium">
                      Time: {viewingSelfieRecord.checkOutTime ? new Date(viewingSelfieRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </span>
                  </>
                ) : (
                  <div className="w-full h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white">
                    No selfie captured for check-out
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setViewingSelfieRecord(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
