import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
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

// ─── Module & Action Pill Colours ─────────────────────────────────────────────

const moduleColours: Record<string, string> = {
  AUTH:        '#a78bfa',
  ACCOUNT:     '#10b981',
  TRANSACTION: '#3b82f6',
  EXPENSE:     '#f59e0b',
  SALARY:      '#ec4899',
  ADVANCE:     '#8b5cf6',
  USER:        '#0ea5e9',
  EMPLOYEE:    '#06b6d4',
};

const actionColours: Record<string, string> = {
  CREATE:    '#10b981',
  UPDATE:    '#3b82f6',
  APPROVE:   '#22c55e',
  REJECT:    '#ef4444',
  RETURN:    '#f97316',
  DISBURSE:  '#8b5cf6',
  REVERSE:   '#d97706',
  LOGIN:     '#0ea5e9',
  LOGOUT:    '#6b7280',
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
      <div className="aud-header">
        <div>
          <h1 className="aud-title">System Audit History</h1>
          <p className="aud-subtitle">Immutable security & financial transaction audit logs</p>
        </div>
        <button className="aud-btn-refresh" onClick={fetchAuditLogs}>🔄 Refresh Logs</button>
      </div>

      {/* KPI Stats */}
      <div className="aud-stats">
        <div className="aud-stat-card">
          <span className="aud-stat-label">TOTAL LOGS RECORDED</span>
          <span className="aud-stat-val">{total.toLocaleString('en-IN')}</span>
        </div>
        <div className="aud-stat-card">
          <span className="aud-stat-label">ACTIONS TODAY</span>
          <span className="aud-stat-val aud-val-green">{todayCount}</span>
        </div>
        <div className="aud-stat-card">
          <span className="aud-stat-label">AUDITED MODULES</span>
          <span className="aud-stat-val aud-val-purple">8 Core Modules</span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="aud-filters">
        <input
          type="text"
          placeholder="🔍 Search Record ID, User Email, Action..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={selectedModule} onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}>
          <option value="">— All Modules —</option>
          <option value="AUTH">AUTH</option>
          <option value="ACCOUNT">ACCOUNT</option>
          <option value="TRANSACTION">TRANSACTION</option>
          <option value="EXPENSE">EXPENSE</option>
          <option value="SALARY">SALARY</option>
          <option value="ADVANCE">ADVANCE</option>
          <option value="USER">USER</option>
          <option value="EMPLOYEE">EMPLOYEE</option>
        </select>
        <select value={selectedAction} onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}>
          <option value="">— All Actions —</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="DISBURSE">DISBURSE</option>
          <option value="REVERSE">REVERSE</option>
          <option value="LOGIN">LOGIN</option>
        </select>
      </div>

      {/* Audit Logs Table */}
      <div className="aud-table-wrapper">
        {loading ? (
          <div className="aud-loading"><div className="aud-spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="aud-empty">No audit logs matching filters.</div>
        ) : (
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
                const actColour = actionColours[log.action] || '#a78bfa';
                return (
                  <tr key={log.id} className="aud-row" onClick={() => setSelectedLog(log)}>
                    <td className="aud-time">{fmtDateTime(log.createdAt)}</td>
                    <td className="aud-user">
                      <strong>{log.user?.email || 'System'}</strong>
                    </td>
                    <td>
                      <span className="aud-badge" style={{ background: `${modColour}22`, color: modColour, border: `1px solid ${modColour}55` }}>
                        {log.module}
                      </span>
                    </td>
                    <td>
                      <span className="aud-badge" style={{ background: `${actColour}22`, color: actColour, border: `1px solid ${actColour}55` }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="aud-rec-id">{log.recordId}</td>
                    <td className="aud-ip">{log.ipAddress}</td>
                    <td>
                      <button className="aud-btn-inspect" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                        🔍 View Diff
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="aud-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>◀ Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ▶</button>
        </div>
      )}

      {/* ── Event Details Drawer Modal ────────────────────────────────────── */}
      {selectedLog && (
        <div className="aud-overlay" onClick={() => setSelectedLog(null)}>
          <div className="aud-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="aud-drawer-header">
              <h2>Audit Event Detail</h2>
              <button className="aud-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            <div className="aud-drawer-body">
              <div className="aud-meta-grid">
                <div><label>Event ID</label><span className="aud-rec-id">{selectedLog.id}</span></div>
                <div><label>Timestamp</label><span>{fmtDateTime(selectedLog.createdAt)}</span></div>
                <div><label>Operator Email</label><span>{selectedLog.user?.email || 'System'}</span></div>
                <div><label>IP Address</label><span>{selectedLog.ipAddress}</span></div>
                <div><label>Module</label><span>{selectedLog.module}</span></div>
                <div><label>Action</label><span>{selectedLog.action}</span></div>
                <div className="aud-grid-full"><label>Target Record ID</label><span className="aud-rec-id">{selectedLog.recordId}</span></div>
              </div>

              {/* Payload Inspection */}
              <div className="aud-payload-section">
                {selectedLog.oldData && (
                  <div className="aud-json-box">
                    <label className="aud-json-label text-amber">Previous State (oldData)</label>
                    <pre>{JSON.stringify(safeJsonParse(selectedLog.oldData), null, 2)}</pre>
                  </div>
                )}

                {selectedLog.newData && (
                  <div className="aud-json-box">
                    <label className="aud-json-label text-green">New State (newData)</label>
                    <pre>{JSON.stringify(safeJsonParse(selectedLog.newData), null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
