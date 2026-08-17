import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import '../styles/advances.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  employeeCode: string;
}

interface ApprovalStep {
  id: string;
  stepNumber: number;
  roleName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  actionAt: string | null;
  comments: string | null;
}

interface ApprovalRequest {
  id: string;
  status: string;
  currentStep: number;
  approvalSteps: ApprovalStep[];
}

interface SettlementItem {
  id: string;
  amount: number;
  description: string;
  category: { name: string };
}

interface Transaction {
  id: string;
  transactionNo?: string;
  amount: number;
  date: string;
  category: string;
  account?: { name: string };
  vouchers?: { voucherNo: string }[];
}

interface Advance {
  id: string;
  advanceNo: string;
  employeeId: string;
  employee: Employee;
  amount: number;
  purpose: string;
  dateNeeded: string;
  status: string;
  outstandingAmount: number;
  disburseAccount: { name: string } | null;
  disbursedAt: string | null;
  createdAt: string;
  settlements: SettlementItem[];
  transactions?: Transaction[];
  approvalRequest: ApprovalRequest | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  type: string;
}

// ─── Status colour map ────────────────────────────────────────────────────────

const statusMeta: Record<string, { label: string; colour: string }> = {
  DRAFT:                   { label: 'Draft',             colour: '#6b7280' },
  SUBMITTED:               { label: 'Submitted',         colour: '#3b82f6' },
  UNDER_REVIEW:            { label: 'Under Review',      colour: '#f59e0b' },
  RETURNED_FOR_CORRECTION: { label: 'Returned',          colour: '#f97316' },
  APPROVED:                { label: 'Approved',          colour: '#10b981' },
  REJECTED:                { label: 'Rejected',          colour: '#ef4444' },
  DISBURSED:               { label: 'Disbursed',         colour: '#8b5cf6' },
  SETTLEMENT_PENDING:      { label: 'Settlement Pending',colour: '#0ea5e9' },
  SETTLED:                 { label: 'Settled ✓',          colour: '#22c55e' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdvancesList() {
  const [advances, setAdvances]         = useState<Advance[]>([]);
  const [employees, setEmployees]        = useState<Employee[]>([]);
  const [accounts, setAccounts]          = useState<Account[]>([]);
  const [categories, setCategories]      = useState<ExpenseCategory[]>([]);
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState('');
  const [selected, setSelected]          = useState<Advance | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN' || currentUser.role === 'ACCOUNTS' || currentUser.role?.startsWith('ADMIN') || currentUser.role?.startsWith('ACCOUNT');
  const isStaff = !isAdmin;
  const canDisburse = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ACCOUNTS' || currentUser.role?.startsWith('ACCOUNT');

  const isUserActiveApprover = (adv: Advance) => {
    if (!adv.approvalRequest) return false;
    const req = adv.approvalRequest;
    if (req.status !== 'PENDING') return false;
    
    const activeStep = req.approvalSteps.find((s: any) => s.stepNumber === req.currentStep);
    if (!activeStep || activeStep.status !== 'PENDING') return false;

    const isMatched = currentUser.role === activeStep.roleName || 
      (activeStep.roleName === 'ACCOUNTS' && currentUser.role?.startsWith('ACCOUNT')) ||
      (activeStep.roleName === 'ADMIN' && currentUser.role?.startsWith('ADMIN')) ||
      currentUser.role === 'SUPER_ADMIN';

    return isMatched;
  };

  // Create/Edit advance modal state
  const [showCreate, setShowCreate]      = useState(false);
  const [editId, setEditId]              = useState('');
  const [newForm, setNewForm]            = useState({ employeeId: '', amount: '', purpose: '', dateNeeded: '' });
  const [creating, setCreating]          = useState(false);

  // Disburse modal state
  const [showDisburse, setShowDisburse]  = useState(false);
  const [disburseAccId, setDisburseAccId] = useState('');

  // Settle modal state
  const [showSettle, setShowSettle]      = useState(false);
  const [settleItems, setSettleItems]    = useState([{ categoryId: '', amount: '', description: '' }]);
  const [returnNow, setReturnNow]        = useState(false);
  const [returnAccIdInSettle, setReturnAccIdInSettle] = useState('');
  const [returnAmtInSettle, setReturnAmtInSettle] = useState('');

  // Return cash modal state
  const [showReturn, setShowReturn]      = useState(false);
  const [returnAccId, setReturnAccId]    = useState('');
  const [returnAmt, setReturnAmt]        = useState('');

  // Action modal state
  const [actionType, setActionType]      = useState<'approve' | 'reject' | 'return' | ''>('');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [advRes, empRes, accRes, catRes] = await Promise.all([
        api.get('/advances'),
        api.get('/masters/employees').catch(() => ({ data: { data: [] } })),
        api.get('/accounts').catch(() => ({ data: { data: [] } })),
        api.get('/expenses/categories').catch(() => ({ data: { data: [] } })),
      ]);
      setAdvances(advRes.data.data || []);
      setEmployees(empRes.data.data || []);
      setAccounts(accRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch {
      setError('Failed to load advances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh advances every 30s
  useAutoRefresh(loadAll, 30000);

  // ── Create/Edit Advance ─────────────────────────────────────────────────────
  const handleOpenEdit = (adv: Advance) => {
    setEditId(adv.id);
    setNewForm({
      employeeId: adv.employeeId,
      amount: adv.amount.toString(),
      purpose: adv.purpose,
      dateNeeded: adv.dateNeeded.split('T')[0],
    });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!newForm.employeeId || !newForm.amount || !newForm.purpose || !newForm.dateNeeded) return;
    setCreating(true);
    try {
      const payload = {
        employeeId: newForm.employeeId,
        amount: parseFloat(newForm.amount),
        purpose: newForm.purpose,
        dateNeeded: new Date(newForm.dateNeeded).toISOString(),
        submitDirectly: true,
      };

      if (editId) {
        await api.patch(`/advances/${editId}`, payload);
        await api.post(`/advances/${editId}/submit`);
      } else {
        await api.post('/advances', payload);
      }

      setShowCreate(false);
      setEditId('');
      setNewForm({ employeeId: '', amount: '', purpose: '', dateNeeded: '' });
      await loadAll();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error saving advance.');
    } finally {
      setCreating(false);
    }
  };

  // ── Workflow Action ─────────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!selected || !actionType) return;
    setActionLoading(true);
    try {
      await api.post(`/advances/${selected.id}/${actionType}`, { comments: actionComment });
      setActionType('');
      setActionComment('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || `Error: ${actionType}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Disburse ────────────────────────────────────────────────────────────────
  const handleDisburse = async () => {
    if (!selected || !disburseAccId) return;
    try {
      await api.post(`/advances/${selected.id}/disburse`, { accountId: disburseAccId });
      setShowDisburse(false);
      setDisburseAccId('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Disburse error.');
    }
  };

  // ── Settle ──────────────────────────────────────────────────────────────────
  const handleSettle = async () => {
    if (!selected) return;
    const items = settleItems.map((i) => ({
      categoryId: i.categoryId,
      amount: parseFloat(i.amount),
      description: i.description,
    }));
    try {
      const res = await api.post(`/advances/${selected.id}/settle`, { items });
      let messages: string[] = [];
      messages.push(res.data.message);

      // If user opted to return surplus immediately, call return-cash
      if (returnNow) {
        const amt = parseFloat(returnAmtInSettle || '0');
        if (!returnAccIdInSettle || !amt || amt <= 0) {
          alert('Return account or amount missing. Settlement recorded.');
        } else {
          try {
            const ret = await api.post(`/advances/${selected.id}/return-cash`, {
              accountId: returnAccIdInSettle,
              amount: amt,
            });
            messages.push(ret.data.message);
          } catch (err: any) {
            messages.push(err.response?.data?.message || 'Return cash failed.');
          }
        }
      }

      alert(messages.join('\n'));
      setShowSettle(false);
      setSettleItems([{ categoryId: '', amount: '', description: '' }]);
      setReturnNow(false);
      setReturnAccIdInSettle('');
      setReturnAmtInSettle('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      const resp = e.response?.data;
      if (resp?.errors && Array.isArray(resp.errors) && resp.errors.length) {
        const msgs = resp.errors.map((er: any) => `${er.field ? er.field + ': ' : ''}${er.message}`).join('\n');
        alert((resp.message || 'Validation failed') + '\n' + msgs);
      } else {
        alert(resp?.message || 'Settlement error.');
      }
    }
  };

  // ── Return Cash ─────────────────────────────────────────────────────────────
  const handleReturnCash = async () => {
    if (!selected || !returnAccId || !returnAmt) return;
    try {
      const res = await api.post(`/advances/${selected.id}/return-cash`, {
        accountId: returnAccId,
        amount: parseFloat(returnAmt),
      });
      alert(res.data.message);
      setShowReturn(false);
      setReturnAccId('');
      setReturnAmt('');
      await loadAll();
      setSelected(null);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Return cash error.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="adv-loading"><div className="adv-spinner" /></div>;
  if (error) return <div className="adv-error">{error}</div>;

  return (
    <div className="adv-root">
      {/* Header */}
      <div className="adv-header">
        <div>
          <h1 className="adv-title">Staff Advances</h1>
          <p className="adv-subtitle">Manage employee advance requests, disbursements and settlements</p>
        </div>
        <button className="adv-btn-primary" onClick={() => { setEditId(''); setNewForm({ employeeId: '', amount: '', purpose: '', dateNeeded: '' }); setShowCreate(true); }}>+ New Advance</button>
      </div>

      {/* Stats bar */}
      <div className="adv-stats">
        {Object.entries(statusMeta).map(([key, meta]) => {
          const count = advances.filter((a) => a.status === key).length;
          if (!count) return null;
          return (
            <div className="adv-stat-pill" key={key} style={{ borderColor: meta.colour }}>
              <span className="adv-stat-label">{meta.label}</span>
              <span className="adv-stat-count" style={{ color: meta.colour }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="adv-table-wrapper">
        {advances.length === 0 ? (
          <div className="adv-empty">No advance requests yet. Click "+ New Advance" to get started.</div>
        ) : (
          <table className="adv-table">
            <thead>
              <tr>
                <th>Advance No</th>
                <th>Employee</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Date Needed</th>
                <th>Status</th>
                <th>Outstanding</th>
                {!isStaff && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {advances.map((adv) => {
                const sm = statusMeta[adv.status] || { label: adv.status, colour: '#6b7280' };
                return (
                  <tr key={adv.id} className="adv-row" onClick={() => setSelected(adv)}>
                    <td className="adv-cell adv-no">{adv.advanceNo}</td>
                    <td className="adv-cell">{adv.employee?.name}</td>
                    <td className="adv-cell adv-amount">{fmt(adv.amount)}</td>
                    <td className="adv-cell adv-purpose">{adv.purpose}</td>
                    <td className="adv-cell">{fmtDate(adv.dateNeeded)}</td>
                    <td className="adv-cell">
                      <span className="adv-badge" style={{ background: `${sm.colour}22`, color: sm.colour, border: `1px solid ${sm.colour}55` }}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="adv-cell adv-outstanding">{adv.outstandingAmount > 0 ? fmt(adv.outstandingAmount) : '—'}</td>
                    {!isStaff && (
                      <td className="adv-cell adv-actions" onClick={(e) => e.stopPropagation()}>
                        {(adv.status === 'RETURNED_FOR_CORRECTION' || adv.status === 'DRAFT' || adv.status === 'REJECTED') && (
                          <button className="adv-act-btn adv-approve" onClick={() => handleOpenEdit(adv)}>Edit</button>
                        )}
                        {adv.status === 'UNDER_REVIEW' && isUserActiveApprover(adv) && (
                          <>
                            <button className="adv-act-btn adv-approve" onClick={() => { setSelected(adv); setActionType('approve'); }}>Approve</button>
                            <button className="adv-act-btn adv-reject" onClick={() => { setSelected(adv); setActionType('reject'); }}>Reject</button>
                            <button className="adv-act-btn adv-return" onClick={() => { setSelected(adv); setActionType('return'); }}>Return</button>
                          </>
                        )}
                        {adv.status === 'APPROVED' && canDisburse && (
                          <button className="adv-act-btn adv-disburse" onClick={() => { setSelected(adv); setShowDisburse(true); }}>Disburse</button>
                        )}
                        {adv.status === 'SETTLEMENT_PENDING' && canDisburse && (
                          <>
                            <button className="adv-act-btn adv-settle" onClick={() => { setSelected(adv); setShowSettle(true); }}>Settle</button>
                            {adv.outstandingAmount > 0 && (
                              <button className="adv-act-btn adv-returncash" onClick={() => { setSelected(adv); setShowReturn(true); }}>Return Cash</button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      {selected && !showDisburse && !showSettle && !showReturn && !actionType && (
        <div className="adv-overlay" onClick={() => setSelected(null)}>
          <div className="adv-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adv-drawer-header">
              <h2>{selected.advanceNo}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(selected.status === 'RETURNED_FOR_CORRECTION' || selected.status === 'DRAFT' || selected.status === 'REJECTED') && (
                  <button className="adv-act-btn adv-approve" onClick={() => handleOpenEdit(selected)}>Edit</button>
                )}
                <button className="adv-close" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>
            <div className="adv-drawer-body">
              <div className="adv-info-grid">
                <div><label>Employee</label><span>{selected.employee?.name} ({selected.employee?.employeeCode})</span></div>
                <div><label>Amount</label><span>{fmt(selected.amount)}</span></div>
                <div><label>Outstanding</label><span style={{ color: selected.outstandingAmount > 0 ? '#f59e0b' : '#22c55e' }}>{selected.outstandingAmount > 0 ? fmt(selected.outstandingAmount) : '₹0 (Cleared)'}</span></div>
                <div><label>Date Needed</label><span>{fmtDate(selected.dateNeeded)}</span></div>
                <div className="adv-info-full"><label>Purpose</label><span>{selected.purpose}</span></div>
                {selected.disburseAccount && (
                  <div><label>Disbursed From</label><span>{selected.disburseAccount.name}</span></div>
                )}
              </div>

              {/* Approval steps timeline */}
              {selected.approvalRequest && (
                <div className="adv-steps">
                  <h3>Approval Timeline</h3>
                  {selected.approvalRequest.approvalSteps.map((step) => (
                    <div key={step.id} className={`adv-step adv-step-${step.status.toLowerCase()}`}>
                      <div className="adv-step-dot" />
                      <div className="adv-step-content">
                        <span className="adv-step-role">{step.roleName}</span>
                        <span className="adv-step-status">{step.status}</span>
                        {step.comments && <p className="adv-step-comment">"{step.comments}"</p>}
                        {step.actionAt && <small>{fmtDate(step.actionAt)}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Settlement items and Returned Cash */}
              {( (selected.settlements && selected.settlements.length > 0) || (selected.transactions && selected.transactions.some((t: any) => t.category === 'ADVANCE_RETURN')) ) && (
                <div className="adv-settlements">
                  <h3>Settlement Items</h3>
                  
                  {selected.settlements && selected.settlements.map((s) => (
                    <div key={s.id} className="adv-settle-row">
                      <span className="adv-settle-cat">{s.category.name}</span>
                      <span className="adv-settle-desc">{s.description}</span>
                      <span className="adv-settle-amt">{fmt(s.amount)}</span>
                    </div>
                  ))}
                  
                  {selected.transactions && selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').map((t: any) => (
                    <div key={t.id} className="adv-settle-row" style={{ color: '#22c55e' }}>
                      <span className="adv-settle-cat">Cash Returned</span>
                      <span className="adv-settle-desc">Ref: {t.vouchers && t.vouchers[0] ? t.vouchers[0].voucherNo : (t.account?.name || '—')}</span>
                      <span className="adv-settle-amt">{fmt(t.amount)}</span>
                    </div>
                  ))}

                  <div className="adv-settle-total" style={{ borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Total Used:</span>
                      <span>{fmt((selected.settlements || []).reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                    {selected.transactions && selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#22c55e' }}>
                        <span>Total Returned:</span>
                        <span>{fmt(selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #334155', paddingTop: 8, marginTop: 4 }}>
                      <span>Total Accounted:</span>
                      <span>{fmt(
                        (selected.settlements || []).reduce((s, i) => s + i.amount, 0) + 
                        (selected.transactions ? selected.transactions.filter((t: any) => t.category === 'ADVANCE_RETURN').reduce((s, i) => s + i.amount, 0) : 0)
                      )}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Return Surplus form inside detail drawer */}
              {selected.outstandingAmount > 0 && selected.status === 'SETTLEMENT_PENDING' && (
                <div className="adv-inline-return" style={{ marginTop: 18 }}>
                  <h3>Return Surplus Cash</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label>Receive Into Account</label>
                      <select value={returnAccId} onChange={(e) => setReturnAccId(e.target.value)}>
                        <option value="">— Select Account —</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Return Amount (₹)</label>
                      <input type="number" min="1" max={selected.outstandingAmount} value={returnAmt} onChange={(e) => setReturnAmt(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="adv-btn-primary" onClick={handleReturnCash} disabled={!returnAccId || !returnAmt}>
                      Confirm Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Advance Modal ──────────────────────────────────────── */}
      {showCreate && (
        <div className="adv-overlay" onClick={() => setShowCreate(false)}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>{editId ? 'Edit Advance Request' : 'New Advance Request'}</h2>
              <button className="adv-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <label>Employee</label>
              <select value={newForm.employeeId} onChange={(e) => setNewForm({ ...newForm, employeeId: e.target.value })}>
                <option value="">— Select Employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                ))}
              </select>

              <label>Amount (₹)</label>
              <input type="number" min="1" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })} placeholder="e.g. 10000" />

              <label>Purpose</label>
              <input type="text" value={newForm.purpose} onChange={(e) => setNewForm({ ...newForm, purpose: e.target.value })} placeholder="e.g. Site visit expenses" />

              <label>Date Needed By</label>
              <input type="date" value={newForm.dateNeeded} onChange={(e) => setNewForm({ ...newForm, dateNeeded: e.target.value })} />

              <button className="adv-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workflow Action Modal ──────────────────────────────────────────── */}
      {actionType && selected && (
        <div className="adv-overlay" onClick={() => { setActionType(''); setActionComment(''); }}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>{actionType === 'approve' ? '✅ Approve' : actionType === 'reject' ? '❌ Reject' : '↩ Return'} — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => { setActionType(''); setActionComment(''); }}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Amount: <strong>{fmt(selected.amount)}</strong> · Employee: <strong>{selected.employee?.name}</strong></p>
              <label>Comments (optional)</label>
              <textarea rows={3} value={actionComment} onChange={(e) => setActionComment(e.target.value)} placeholder="Add remarks…" />
              <button
                className={`adv-btn-action ${actionType === 'approve' ? 'adv-btn-green' : actionType === 'reject' ? 'adv-btn-red' : 'adv-btn-orange'}`}
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing…' : actionType.charAt(0).toUpperCase() + actionType.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disburse Modal ─────────────────────────────────────────────────── */}
      {showDisburse && selected && (
        <div className="adv-overlay" onClick={() => { setShowDisburse(false); setDisburseAccId(''); }}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>💸 Disburse — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => { setShowDisburse(false); setDisburseAccId(''); }}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Disbursing <strong>{fmt(selected.amount)}</strong> to <strong>{selected.employee?.name}</strong></p>
              <label>Source Account</label>
              <select value={disburseAccId} onChange={(e) => setDisburseAccId(e.target.value)}>
                <option value="">— Select Account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>
                ))}
              </select>
              <button className="adv-btn-primary" onClick={handleDisburse} disabled={!disburseAccId}>
                Confirm Disbursement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Modal ───────────────────────────────────────────────────── */}
      {showSettle && selected && (
        <div className="adv-overlay" onClick={() => { setShowSettle(false); }}>
          <div className="adv-modal adv-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>📋 Settle Advance — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => setShowSettle(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Advance: <strong>{fmt(selected.amount)}</strong> · Outstanding: <strong>{fmt(selected.outstandingAmount)}</strong></p>
              <label>Expense Items (how the advance was used)</label>
              {settleItems.map((item, idx) => (
                <div className="adv-settle-item" key={idx}>
                  <select value={item.categoryId} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].categoryId = e.target.value;
                    setSettleItems(updated);
                  }}>
                    <option value="">— Category —</option>
                    {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].description = e.target.value;
                    setSettleItems(updated);
                  }} />
                  <input type="number" placeholder="₹ Amount" value={item.amount} onChange={(e) => {
                    const updated = [...settleItems];
                    updated[idx].amount = e.target.value;
                    setSettleItems(updated);
                  }} />
                  {settleItems.length > 1 && (
                    <button className="adv-act-btn adv-reject" onClick={() => setSettleItems(settleItems.filter((_, i) => i !== idx))}>✕</button>
                  )}
                </div>
              ))}
              <button className="adv-btn-secondary" onClick={() => setSettleItems([...settleItems, { categoryId: '', amount: '', description: '' }])}>
                + Add Item
              </button>
              <div className="adv-settle-preview">
                Total used: <strong>{fmt(settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}</strong>
                &nbsp;|&nbsp; Surplus: <strong style={{ color: '#f59e0b' }}>
                  {fmt(selected.outstandingAmount - settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))}
                </strong>
              </div>
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={returnNow} onChange={(e) => {
                    setReturnNow(e.target.checked);
                    if (e.target.checked) {
                      const used = settleItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
                      const surplus = Math.max(0, selected.outstandingAmount - used);
                      setReturnAmtInSettle(String(surplus || ''));
                    } else {
                      setReturnAccIdInSettle('');
                      setReturnAmtInSettle('');
                    }
                  }} />
                  <span style={{ fontSize: 14 }}>Return surplus now</span>
                </label>

                {returnNow && (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8 }}>
                    <div>
                      <label>Receive Into Account</label>
                      <select value={returnAccIdInSettle} onChange={(e) => setReturnAccIdInSettle(e.target.value)}>
                        <option value="">— Select Account —</option>
                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name} — {fmt(acc.currentBalance)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Return Amount (₹)</label>
                      <input type="number" min="0" max={selected.outstandingAmount} value={returnAmtInSettle} onChange={(e) => setReturnAmtInSettle(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
                    </div>
                  </div>
                )}
              </div>

              <button className="adv-btn-primary" onClick={handleSettle}>Submit Settlement</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Cash Modal ──────────────────────────────────────────────── */}
      {showReturn && selected && (
        <div className="adv-overlay" onClick={() => setShowReturn(false)}>
          <div className="adv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adv-modal-header">
              <h2>🔄 Return Surplus Cash — {selected.advanceNo}</h2>
              <button className="adv-close" onClick={() => setShowReturn(false)}>✕</button>
            </div>
            <div className="adv-modal-body">
              <p>Outstanding: <strong style={{ color: '#f59e0b' }}>{fmt(selected.outstandingAmount)}</strong></p>
              <label>Receive Into Account</label>
              <select value={returnAccId} onChange={(e) => setReturnAccId(e.target.value)}>
                <option value="">— Select Account —</option>
                {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              <label>Return Amount (₹)</label>
              <input type="number" min="1" max={selected.outstandingAmount} value={returnAmt} onChange={(e) => setReturnAmt(e.target.value)} placeholder={`Max ${fmt(selected.outstandingAmount)}`} />
              <button className="adv-btn-primary" onClick={handleReturnCash} disabled={!returnAccId || !returnAmt}>
                Confirm Cash Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
