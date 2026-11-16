import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { ResponsiveSelect, type ResponsiveSelectOption } from '../components/ResponsiveSelect';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Activity,
  Layers,
  Lock,
  FileText,
  ChevronRight,
  X,
  Clock,
  User,
  Globe,
  Tag
} from 'lucide-react';
import '../styles/auditHistory.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLogItem {
  id: string;
  companyId: string;
  userId: string;
  module: string;
  recordId: string;
  action: string;
  oldData: string | null;
  newData: string | null;
  ipAddress: string;
  createdAt: string;
  user: { id: string; email: string } | null;
}

interface AuditResponse {
  logs: AuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  todayCount: number;
}

// ─── Module & Action Options & Colors ─────────────────────────────────────────

const MODULE_OPTIONS: ResponsiveSelectOption[] = [
  { value: '', label: '— All Modules —' },
  { value: 'AUTH', label: 'AUTH' },
  { value: 'ACCOUNT', label: 'ACCOUNT' },
  { value: 'TRANSACTION', label: 'TRANSACTION' },
  { value: 'EXPENSE', label: 'EXPENSE' },
  { value: 'SALARY', label: 'SALARY' },
  { value: 'ADVANCE', label: 'ADVANCE' },
  { value: 'USER', label: 'USER' },
  { value: 'EMPLOYEE', label: 'EMPLOYEE' },
];

const ACTION_OPTIONS: ResponsiveSelectOption[] = [
  { value: '', label: '— All Actions —' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'APPROVE', label: 'APPROVE' },
  { value: 'REJECT', label: 'REJECT' },
  { value: 'DISBURSE', label: 'DISBURSE' },
  { value: 'REVERSE', label: 'REVERSE' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
];

const moduleColours: Record<string, string> = {
  AUTH:        '#7c3aed',
  ACCOUNT:     '#059669',
  TRANSACTION: '#2563eb',
  EXPENSE:     '#d97706',
  SALARY:      '#db2777',
  ADVANCE:     '#7c3aed',
  USER:        '#0284c7',
  EMPLOYEE:    '#0891b2',
};

const actionColours: Record<string, string> = {
  CREATE:    '#059669',
  UPDATE:    '#2563eb',
  APPROVE:   '#16a34a',
  REJECT:    '#dc2626',
  RETURN:    '#ea580c',
  DISBURSE:  '#7c3aed',
  REVERSE:   '#b45309',
  LOGIN:     '#0284c7',
  LOGOUT:    '#4b5563',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function safeJsonParse(jsonStr: string | null) {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return jsonStr;
  }
}

export default function AuditHistory() {
  const [logs, setLogs]             = useState<AuditLogItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);

  // Filters
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [search, setSearch]                 = useState('');

  // Selected Log Drawer
  const [selectedLog, setSelectedLog]       = useState<AuditLogItem | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedModule) params.append('module', selectedModule);
      if (selectedAction) params.append('action', selectedAction);
      if (search) params.append('search', search);
      params.append('page', page.toString());
      params.append('limit', '30');

      const res = await api.get(`/reports/audit-logs?${params.toString()}`);
      const resData: AuditResponse = res.data.data;

      setLogs(resData.logs || []);
      setTotal(resData.pagination.total || 0);
      setTotalPages(resData.pagination.totalPages || 1);
      setTodayCount(resData.todayCount || 0);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedModule, selectedAction, search, page]);

  useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

  // Auto-refresh audit logs every 30s
  useAutoRefresh(fetchAuditLogs, 30000, [selectedModule, selectedAction, search, page]);

  return (
    <div className="aud-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700 shrink-0 border border-purple-100">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span>System Audit History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 ml-11 sm:ml-0">
            Immutable security & financial transaction audit logs
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAuditLogs}
          className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-purple-700 font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-purple-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* KPI Stats - 2 of 2 Pair Grid on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Card 1: Total Logs */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Logs Recorded
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-mono block">
            {total.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Card 2: Actions Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Actions Today
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 tracking-tight font-mono block">
            {todayCount}
          </span>
        </div>

        {/* Card 3: Audited Modules */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Audited Modules
            </span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <span className="text-base sm:text-xl font-extrabold text-purple-600 tracking-tight block">
            8 Core Modules
          </span>
        </div>

        {/* Card 4: Audit Integrity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              Audit Integrity
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
          </div>
          <span className="text-base sm:text-xl font-extrabold text-blue-600 tracking-tight block">
            100% Immutable
          </span>
        </div>
      </div>

      {/* Filter Controls Bar - Responsive with Bottom Sheet on Mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Record ID, Email, Action..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs sm:text-sm placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 transition-all shadow-xs"
          />
        </div>

        {/* Module Dropdown (Opens as Bottom Sheet on Mobile) */}
        <div>
          <ResponsiveSelect
            label="Module"
            value={selectedModule}
            options={MODULE_OPTIONS}
            onChange={(val) => { setSelectedModule(val); setPage(1); }}
            className="text-xs sm:text-sm font-medium shadow-xs"
          />
        </div>

        {/* Action Dropdown (Opens as Bottom Sheet on Mobile) */}
        <div>
          <ResponsiveSelect
            label="Action"
            value={selectedAction}
            options={ACTION_OPTIONS}
            onChange={(val) => { setSelectedAction(val); setPage(1); }}
            className="text-xs sm:text-sm font-medium shadow-xs"
          />
        </div>
      </div>

      {/* Audit Logs Content */}
      {loading ? (
        <div className="aud-loading"><div className="aud-spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-xs">
          No audit logs matching current filters.
        </div>
      ) : (
        <>
          {/* Mobile Card List (< 640px) */}
          <div className="sm:hidden space-y-3">
            {logs.map((log) => {
              const modColour = moduleColours[log.module] || '#6b7280';
              const actColour = actionColours[log.action] || '#7c3aed';
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs active:bg-slate-50 transition-all cursor-pointer space-y-2.5 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 truncate block">
                        {log.user?.email || 'System'}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                        {fmtDateTime(log.createdAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                      className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer hover:bg-purple-100"
                    >
                      <span>Diff</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-slate-100">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${modColour}15`, color: modColour, border: `1px solid ${modColour}35` }}
                    >
                      {log.module}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${actColour}15`, color: actColour, border: `1px solid ${actColour}35` }}
                    >
                      {log.action}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 truncate ml-auto">
                      #{log.recordId}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop & Tablet Table (>= 640px) */}
          <div className="hidden sm:block aud-table-wrapper">
            <table className="aud-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User / Operator</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Record ID</th>
                  <th>IP Address</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const modColour = moduleColours[log.module] || '#6b7280';
                  const actColour = actionColours[log.action] || '#7c3aed';
                  return (
                    <tr key={log.id} className="aud-row" onClick={() => setSelectedLog(log)}>
                      <td className="aud-time">{fmtDateTime(log.createdAt)}</td>
                      <td className="aud-user">
                        <strong>{log.user?.email || 'System'}</strong>
                      </td>
                      <td>
                        <span
                          className="aud-badge"
                          style={{ background: `${modColour}15`, color: modColour, border: `1px solid ${modColour}35` }}
                        >
                          {log.module}
                        </span>
                      </td>
                      <td>
                        <span
                          className="aud-badge"
                          style={{ background: `${actColour}15`, color: actColour, border: `1px solid ${actColour}35` }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="aud-rec-id">{log.recordId}</td>
                      <td className="aud-ip">{log.ipAddress}</td>
                      <td>
                        <button
                          type="button"
                          className="aud-btn-inspect"
                          onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        >
                          View Diff
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="aud-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>◀ Previous</button>
          <span className="font-semibold">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ▶</button>
        </div>
      )}

      {/* ── Event Details Drawer Modal ────────────────────────────────────── */}
      {selectedLog && (
        <div className="aud-overlay animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div className="aud-drawer text-left flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="aud-drawer-header shrink-0">
              <h2 className="flex items-center gap-2 text-slate-900 font-extrabold">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <span>Audit Event Detail</span>
              </h2>
              <button
                type="button"
                className="aud-close p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
                onClick={() => setSelectedLog(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aud-drawer-body flex-1 overflow-y-auto">
              <div className="aud-meta-grid">
                <div>
                  <label className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" /> Event ID
                  </label>
                  <span className="aud-rec-id">{selectedLog.id}</span>
                </div>
                <div>
                  <label className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Timestamp
                  </label>
                  <span>{fmtDateTime(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <label className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Operator Email
                  </label>
                  <span>{selectedLog.user?.email || 'System'}</span>
                </div>
                <div>
                  <label className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400" /> IP Address
                  </label>
                  <span className="font-mono text-slate-600">{selectedLog.ipAddress}</span>
                </div>
                <div>
                  <label>Module</label>
                  <span className="font-bold text-purple-700">{selectedLog.module}</span>
                </div>
                <div>
                  <label>Action</label>
                  <span className="font-bold text-emerald-700">{selectedLog.action}</span>
                </div>
                <div className="aud-grid-full">
                  <label>Target Record ID</label>
                  <span className="aud-rec-id">{selectedLog.recordId}</span>
                </div>
              </div>

              {/* Payload Inspection */}
              <div className="aud-payload-section">
                {selectedLog.oldData && (
                  <div className="aud-json-box">
                    <label className="aud-json-label text-amber-600 font-bold">
                      Previous State (oldData)
                    </label>
                    <pre className="bg-white p-3 rounded-lg border border-amber-200 text-xs font-mono">
                      {JSON.stringify(safeJsonParse(selectedLog.oldData), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newData && (
                  <div className="aud-json-box">
                    <label className="aud-json-label text-emerald-600 font-bold">
                      New State (newData)
                    </label>
                    <pre className="bg-white p-3 rounded-lg border border-emerald-200 text-xs font-mono">
                      {JSON.stringify(safeJsonParse(selectedLog.newData), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Centered Close Button */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-center shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full sm:w-auto sm:min-w-[200px] py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/20 transition-all cursor-pointer text-center"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
