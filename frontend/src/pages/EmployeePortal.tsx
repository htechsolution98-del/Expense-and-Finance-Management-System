import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import '../styles/employeePortal.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branchName: string | null;
  proofFile: string | null;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  verifiedAt: string | null;
}

interface PendingBankItem extends BankAccount {
  employee: { id: string; name: string; employeeCode: string; email: string };
}

interface EmployeeProfile {
  id: string;
  employeeCode: string;
  name: string;
  joiningDate: string;
  email: string;
  mobile: string;
  address: string;
  photo: string | null;
  status: string;
  department: { name: string } | null;
  designation: { name: string } | null;
  bankAccounts: BankAccount[];
  salaryStructures: any[];
}

interface SalarySlip {
  id: string;
  payrollId: string;
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  special: number;
  pf: number;
  professionalTax: number;
  tds: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  paidAt: string | null;
  payroll: { month: number; year: number; payrollNo: string; company?: any };
  employee?: any;
  account?: { name: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const maskAcc = (num: string) => num ? `•••• •••• ${num.slice(-4)}` : '••••';

export default function EmployeePortal() {
  const [activeTab, setActiveTab]       = useState<'profile' | 'slips' | 'claims'>('profile');
  const [profile, setProfile]            = useState<EmployeeProfile | null>(null);
  const [bankAccount, setBankAccount]    = useState<BankAccount | null>(null);
  const [pendingBanks, setPendingBanks]  = useState<PendingBankItem[]>([]);
  const [slips, setSlips]                = useState<SalarySlip[]>([]);
  const [selectedSlip, setSelectedSlip]  = useState<SalarySlip | null>(null);
  const [loading, setLoading]            = useState(true);

  // Bank Form State
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm]          = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    branchName: '',
    proofFile: '',
  });
  const [savingBank, setSavingBank]      = useState(false);

  // Profile Edit Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', address: '', photo: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Bank Action Modal State
  const [rejectModalItem, setRejectModalItem] = useState<PendingBankItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const payslipRef = useRef<HTMLDivElement>(null);

  const userString = localStorage.getItem('user');
  const currentUser = userString ? JSON.parse(userString) : { role: 'STAFF' };
  const canVerifyBank = ['ADMIN', 'SUPER_ADMIN', 'ACCOUNTS'].includes(currentUser.role);

  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const loadPortalData = useCallback(async () => {
    try {
      setLoading(true);
      const [profRes, bankRes, slipsRes, compRes] = await Promise.allSettled([
        api.get('/employees/me'),
        api.get('/employees/me/bank-account'),
        api.get('/employees/me/salary-slips'),
        api.get('/company'),
      ]);

      if (profRes.status === 'fulfilled') setProfile(profRes.value.data.data);
      if (bankRes.status === 'fulfilled') setBankAccount(bankRes.value.data.data);
      if (slipsRes.status === 'fulfilled') setSlips(slipsRes.value.data.data || []);
      if (compRes.status === 'fulfilled') setCompanyInfo(compRes.value.data.data);

      if (canVerifyBank) {
        const pendingRes = await api.get('/employees/bank-accounts/pending');
        setPendingBanks(pendingRes.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [canVerifyBank]);

  useEffect(() => { loadPortalData(); }, [loadPortalData]);

  // Open Edit Form pre-filled
  const handleOpenBankModal = () => {
    if (bankAccount) {
      setBankForm({
        bankName: bankAccount.bankName,
        accountHolder: bankAccount.accountHolder,
        accountNumber: bankAccount.accountNumber,
        ifsc: bankAccount.ifsc,
        branchName: bankAccount.branchName || '',
        proofFile: bankAccount.proofFile || '',
      });
    } else {
      setBankForm({ bankName: '', accountHolder: '', accountNumber: '', ifsc: '', branchName: '', proofFile: '' });
    }
    setShowBankModal(true);
  };

  // Submit Bank Details
  const handleSaveBank = async () => {
    if (!bankForm.bankName || !bankForm.accountHolder || !bankForm.accountNumber || !bankForm.ifsc) {
      alert('Please fill in Bank Name, Account Holder, Account Number and IFSC code.');
      return;
    }
    setSavingBank(true);
    try {
      const res = await api.post('/employees/me/bank-account', bankForm);
      alert(res.data.message || 'Bank account details submitted!');
      setShowBankModal(false);
      await loadPortalData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to submit bank details.');
    } finally {
      setSavingBank(false);
    }
  };

  // Open Profile Edit Modal
  const handleOpenProfileModal = () => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        address: profile.address || '',
        photo: profile.photo || ''
      });
      setShowProfileModal(true);
    }
  };

  // Submit Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/employees/me', profileForm);
      setShowProfileModal(false);
      await loadPortalData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Verify Bank Account (Accounts/Admin)
  const handleVerifyBank = async (id: string) => {
    try {
      await api.post(`/employees/bank-accounts/${id}/verify`);
      alert('Bank account verified!');
      await loadPortalData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error verifying bank account.');
    }
  };

  // Reject Bank Account (Accounts/Admin)
  const handleRejectBank = async () => {
    if (!rejectModalItem || !rejectionReason) return;
    try {
      await api.post(`/employees/bank-accounts/${rejectModalItem.id}/reject`, { rejectionReason });
      alert('Bank account submission rejected.');
      setRejectModalItem(null);
      setRejectionReason('');
      await loadPortalData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error rejecting bank account.');
    }
  };

  // Open Payslip detail
  const handleViewPayslip = async (slipId: string) => {
    try {
      const res = await api.get(`/employees/me/salary-slips/${slipId}`);
      setSelectedSlip(res.data.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error loading salary slip.');
    }
  };

  // Print Payslip with company branding & logo
  const handlePrintPayslip = () => {
    if (!selectedSlip) return;
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) return;

    const companyLogoUrl = companyInfo?.logo ? `http://localhost:5000/${companyInfo.logo}` : '';
    const companyNameStr = companyInfo?.name || 'COMPANY NAME';
    const companyAddressStr = companyInfo?.address || '';
    const companyPhoneStr = companyInfo?.phone ? `Ph: ${companyInfo.phone}` : '';
    const companyEmailStr = companyInfo?.email ? `Email: ${companyInfo.email}` : '';
    const companyGstinStr = companyInfo?.gstin ? `GSTIN: ${companyInfo.gstin}` : '';
    const monthName = monthNames[selectedSlip.payroll?.month];

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Payslip - ${selectedSlip.employee?.name || profile?.name} (${monthName} ${selectedSlip.payroll?.year})</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; padding: 30px; color: #222; margin: 0; }
            .payslip-box { border: 2px solid #222; padding: 25px; border-radius: 12px; }
            .header { border-bottom: 2px solid #222; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
            .emp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 20px; }
            .emp-label { font-size: 11px; text-transform: uppercase; color: #6c757d; font-weight: 700; }
            .emp-val { font-size: 14px; font-weight: 600; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #dee2e6; padding: 10px; font-size: 13px; }
            th { background: #f1f3f5; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            .total-row { font-weight: 800; background: #e9ecef; }
            .net-box { background: #e7f5ff; border: 2px solid #339af0; padding: 15px; border-radius: 8px; text-align: right; margin-bottom: 30px; }
            .net-val { font-size: 22px; font-weight: 900; color: #1971c2; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .sign-line { width: 200px; border-top: 1px dashed #495057; text-align: center; padding-top: 6px; font-size: 12px; font-weight: 600; color: #495057; }
            @media print { body { padding: 0; } .payslip-box { border: none; } }
          </style>
        </head>
        <body>
          <div class="payslip-box">
            <div class="header">
              <div style="display:flex; gap:15px; align-items:center;">
                ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height:60px; max-width:140px; object-fit:contain;" />` : ''}
                <div>
                  <h1 style="margin:0; font-size:20px; font-weight:900; text-transform:uppercase;">${companyNameStr}</h1>
                  ${companyAddressStr ? `<p style="margin:2px 0 0; font-size:11px; color:#495057;">${companyAddressStr}</p>` : ''}
                  <div style="font-size:11px; color:#495057; margin-top:2px;">
                    ${[companyPhoneStr, companyEmailStr, companyGstinStr].filter(Boolean).join(' | ')}
                  </div>
                </div>
              </div>
              <div style="text-align:right;">
                <h3 style="margin:0; font-size:16px; font-weight:800; color:#333;">SALARY PAYSLIP</h3>
                <p style="margin:3px 0 0; font-size:12px; color:#6c757d; font-weight:700;">${monthName} ${selectedSlip.payroll?.year}</p>
                <p style="margin:2px 0 0; font-size:11px; font-family:monospace; color:#868e96;">Batch: ${selectedSlip.payroll?.payrollNo || ''}</p>
              </div>
            </div>

            <div class="emp-grid">
              <div>
                <div class="emp-label">Employee Name</div>
                <div class="emp-val">${selectedSlip.employee?.name || profile?.name || ''}</div>
              </div>
              <div>
                <div class="emp-label">Employee Code</div>
                <div class="emp-val" style="font-family:monospace;">${selectedSlip.employee?.employeeCode || profile?.employeeCode || ''}</div>
              </div>
              <div>
                <div class="emp-label">Status</div>
                <div class="emp-val" style="color:${selectedSlip.status === 'PAID' ? '#2b8a3e' : '#d9480f'}; font-weight:800;">${selectedSlip.status}</div>
              </div>
              <div>
                <div class="emp-label">Payment Date</div>
                <div class="emp-val">${selectedSlip.paidAt ? new Date(selectedSlip.paidAt).toLocaleDateString() : 'Pending'}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th style="text-align:right;">Amount (₹)</th>
                  <th>Deductions</th>
                  <th style="text-align:right;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic Salary</td>
                  <td style="text-align:right;">₹${(selectedSlip.basic || 0).toLocaleString()}</td>
                  <td>Provident Fund (PF)</td>
                  <td style="text-align:right;">₹${(selectedSlip.pf || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>House Rent Allowance (HRA)</td>
                  <td style="text-align:right;">₹${(selectedSlip.hra || 0).toLocaleString()}</td>
                  <td>Professional Tax (PT)</td>
                  <td style="text-align:right;">₹${(selectedSlip.professionalTax || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Conveyance Allowance</td>
                  <td style="text-align:right;">₹${(selectedSlip.conveyance || 0).toLocaleString()}</td>
                  <td>Tax Deducted at Source (TDS)</td>
                  <td style="text-align:right;">₹${(selectedSlip.tds || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Medical Allowance</td>
                  <td style="text-align:right;">₹${(selectedSlip.medical || 0).toLocaleString()}</td>
                  <td>-</td>
                  <td style="text-align:right;">-</td>
                </tr>
                <tr>
                  <td>Special Allowance</td>
                  <td style="text-align:right;">₹${(selectedSlip.special || 0).toLocaleString()}</td>
                  <td>-</td>
                  <td style="text-align:right;">-</td>
                </tr>
                <tr class="total-row">
                  <td>Gross Earnings</td>
                  <td style="text-align:right;">₹${(selectedSlip.grossEarnings || 0).toLocaleString()}</td>
                  <td>Total Deductions</td>
                  <td style="text-align:right; color:#c92a2a;">₹${(selectedSlip.totalDeductions || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="net-box">
              <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:#1971c2;">Net Salary Payable</div>
              <div class="net-val">₹${(selectedSlip.netSalary || 0).toLocaleString()}</div>
            </div>

            <div class="footer">
              <div class="sign-line">Employee Signature</div>
              <div class="sign-line">Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  if (loading) return <div className="emp-loading"><div className="emp-spinner" /></div>;

  return (
    <div className="emp-root">
      {/* Header */}
      <div className="emp-header">
        <div>
          <h1 className="emp-title">Employee Portal</h1>
          <p className="emp-subtitle">Self-service profile, bank account verification & salary slips</p>
        </div>
        <div className="emp-user-badge">
          {profile?.photo ? (
            <img src={profile.photo} alt="Profile" className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20" />
          ) : (
            <div className="emp-avatar">{profile?.name ? profile.name.charAt(0).toUpperCase() : 'E'}</div>
          )}
          <div>
            <div className="emp-user-name">{profile?.name || 'Employee'}</div>
            <div className="emp-user-code">{profile?.employeeCode}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="emp-tabs">
        <button className={`emp-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          👤 Profile & Bank Verification
        </button>
        <button className={`emp-tab ${activeTab === 'slips' ? 'active' : ''}`} onClick={() => setActiveTab('slips')}>
          📄 Monthly Salary Slips {slips.length > 0 && <span className="emp-tab-badge">{slips.length}</span>}
        </button>
      </div>

      {/* ── TAB 1: PROFILE & BANK VERIFICATION ───────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="emp-tab-content">
          <div className="emp-grid">
            {/* Profile Info Card */}
            <div className="emp-card">
              <div className="emp-card-header">
                <h3>Personal & Employment Details</h3>
                <span className="emp-status-badge emp-status-active">ACTIVE</span>
              </div>
              <div className="emp-info-grid">
                <div><label>Full Name</label><span>{profile?.name}</span></div>
                <div><label>Employee Code</label><span className="emp-code">{profile?.employeeCode}</span></div>
                <div><label>Department</label><span>{profile?.department?.name || 'General'}</span></div>
                <div><label>Designation</label><span>{profile?.designation?.name || 'Staff'}</span></div>
                <div><label>Joining Date</label><span>{profile?.joiningDate ? fmtDate(profile.joiningDate) : '—'}</span></div>
                <div><label>Email Address</label><span>{profile?.email}</span></div>
                <div><label>Mobile Number</label><span>{profile?.mobile || '—'}</span></div>
                <div><label>Address</label><span>{profile?.address || '—'}</span></div>
              </div>
              <button className="emp-btn-secondary mt-6 w-full" onClick={handleOpenProfileModal}>
                ✏️ Edit Profile Details
              </button>
            </div>

            {/* Profile Edit Modal */}
            {showProfileModal && (
              <div className="emp-modal-overlay">
                <div className="emp-modal">
                  <div className="emp-modal-header">
                    <h3>Edit Profile Details</h3>
                    <button onClick={() => setShowProfileModal(false)}>✕</button>
                  </div>
                  <form className="emp-modal-body" onSubmit={handleUpdateProfile}>
                    <div className="emp-form-group">
                      <label>Full Name</label>
                      <input
                        type="text"
                        required
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="emp-form-group">
                      <label>Email Address <span className="text-xs font-normal text-gray-500">(Cannot be changed)</span></label>
                      <input type="email" value={profile?.email || ''} disabled className="opacity-50 cursor-not-allowed" />
                    </div>
                    
                    <div className="emp-form-group">
                      <label>Mobile Number <span className="text-xs font-normal text-gray-500">(Cannot be changed)</span></label>
                      <input type="text" value={profile?.mobile || ''} disabled className="opacity-50 cursor-not-allowed" />
                    </div>
                    
                    <div className="emp-form-group">
                      <label>Address</label>
                      <textarea
                        rows={2}
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      />
                    </div>
                    
                    <div className="emp-form-group">
                      <label>Profile Photo URL</label>
                      <input
                        type="text"
                        placeholder="https://example.com/photo.jpg"
                        value={profileForm.photo}
                        onChange={(e) => setProfileForm({ ...profileForm, photo: e.target.value })}
                      />
                    </div>
                    
                    <div className="emp-modal-actions">
                      <button type="button" className="emp-btn-secondary" onClick={() => setShowProfileModal(false)}>Cancel</button>
                      <button type="submit" className="emp-btn-primary" disabled={savingProfile}>
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Bank Account Details Card */}
            <div className="emp-card">
              <div className="emp-card-header">
                <h3>Salary Payout Bank Account</h3>
                {bankAccount && (
                  <span className={`emp-status-badge emp-bank-${bankAccount.status.toLowerCase()}`}>
                    {bankAccount.status === 'VERIFIED' ? '✓ VERIFIED' : bankAccount.status === 'REJECTED' ? '✕ REJECTED' : '⏳ PENDING REVIEW'}
                  </span>
                )}
              </div>

              {bankAccount ? (
                <div className="emp-bank-details">
                  <div className="emp-info-grid">
                    <div><label>Bank Name</label><span>{bankAccount.bankName}</span></div>
                    <div><label>Account Holder</label><span>{bankAccount.accountHolder}</span></div>
                    <div><label>Account Number</label><span className="emp-acc-num">{maskAcc(bankAccount.accountNumber)}</span></div>
                    <div><label>IFSC Code</label><span className="emp-ifsc">{bankAccount.ifsc}</span></div>
                    {bankAccount.branchName && <div><label>Branch</label><span>{bankAccount.branchName}</span></div>}
                  </div>

                  {bankAccount.status === 'REJECTED' && (
                    <div className="emp-alert emp-alert-red">
                      <strong>Rejection Reason:</strong> {bankAccount.rejectionReason}
                    </div>
                  )}

                  {bankAccount.status === 'PENDING_VERIFICATION' && (
                    <div className="emp-alert emp-alert-amber">
                      ℹ️ Bank account details submitted. Pending verification by Accounts before salary payout.
                    </div>
                  )}

                  {bankAccount.status === 'VERIFIED' && (
                    <div className="emp-alert emp-alert-green">
                      ✅ Verified for monthly salary disbursements.
                    </div>
                  )}

                  <button className="emp-btn-secondary" onClick={handleOpenBankModal}>
                    ✏️ Update Bank Details
                  </button>
                </div>
              ) : (
                <div className="emp-empty-bank">
                  <p>No bank account registered yet. Provide bank details for monthly salary payouts.</p>
                  <button className="emp-btn-primary" onClick={handleOpenBankModal}>
                    + Add Bank Account Details
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Verifications Panel for Accounts/Admin */}
          {canVerifyBank && pendingBanks.length > 0 && (
            <div className="emp-card emp-card-highlight mt-6">
              <div className="emp-card-header">
                <h3>🛡️ Pending Bank Verification Queue ({pendingBanks.length})</h3>
                <span className="emp-notice-badge">Accounts Action Required</span>
              </div>
              <div className="emp-table-wrapper">
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Bank Name</th>
                      <th>Account Holder</th>
                      <th>Account Number</th>
                      <th>IFSC</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBanks.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.employee?.name}</strong> ({item.employee?.employeeCode})</td>
                        <td>{item.bankName}</td>
                        <td>{item.accountHolder}</td>
                        <td className="emp-acc-num">{item.accountNumber}</td>
                        <td className="emp-ifsc">{item.ifsc}</td>
                        <td>
                          <div className="emp-action-btns">
                            <button className="emp-btn-green" onClick={() => handleVerifyBank(item.id)}>Approve</button>
                            <button className="emp-btn-red" onClick={() => setRejectModalItem(item)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SALARY SLIPS ─────────────────────────────────────────────── */}
      {activeTab === 'slips' && (
        <div className="emp-tab-content">
          <div className="emp-card">
            <div className="emp-card-header">
              <h3>Monthly Payslips History</h3>
              <span className="emp-subtext">Issued official salary slips</span>
            </div>

            {slips.length === 0 ? (
              <div className="emp-empty">No salary slips generated/paid yet.</div>
            ) : (
              <div className="emp-slips-grid">
                {slips.map((slip) => (
                  <div key={slip.id} className="emp-slip-card" onClick={() => handleViewPayslip(slip.id)}>
                    <div className="emp-slip-header">
                      <span className="emp-slip-month">{monthNames[slip.payroll?.month]} {slip.payroll?.year}</span>
                      <span className={`emp-slip-status ${slip.status === 'ON_HOLD' ? 'emp-slip-status-hold' : ''}`}>
                        {slip.status === 'ON_HOLD' ? 'ON HOLD ⚠️' : 'PAID ✓'}
                      </span>
                    </div>
                    <div className="emp-slip-body">
                      <div className="emp-slip-batch">{slip.payroll?.payrollNo}</div>
                      <div className="emp-slip-net">{fmt(slip.netSalary)}</div>
                      <div className="emp-slip-date">
                        {slip.status === 'ON_HOLD' 
                          ? 'Payout temporarily held by admin' 
                          : `Paid on ${slip.paidAt ? fmtDate(slip.paidAt) : '—'}`}
                      </div>
                    </div>
                    <button className="emp-slip-btn" disabled={slip.status === 'ON_HOLD'}>
                      {slip.status === 'ON_HOLD' ? 'Contact Admin' : 'View & Download Slip ➔'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bank Submission Modal ───────────────────────────────────────────── */}
      {showBankModal && (
        <div className="emp-overlay" onClick={() => setShowBankModal(false)}>
          <div className="emp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header">
              <h2>Submit Bank Account Details</h2>
              <button className="emp-close" onClick={() => setShowBankModal(false)}>✕</button>
            </div>
            <div className="emp-modal-body">
              <label>Account Holder Name</label>
              <input type="text" value={bankForm.accountHolder} onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })} placeholder="Full name as in bank" />

              <label>Bank Name</label>
              <input type="text" value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} placeholder="e.g. HDFC Bank" />

              <label>Account Number</label>
              <input type="text" value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} placeholder="e.g. 50100234567890" />

              <label>IFSC Code</label>
              <input type="text" value={bankForm.ifsc} onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" />

              <label>Branch Name (optional)</label>
              <input type="text" value={bankForm.branchName} onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })} placeholder="e.g. Connaught Place Branch" />

              <button className="emp-btn-primary" onClick={handleSaveBank} disabled={savingBank}>
                {savingBank ? 'Submitting…' : 'Submit Bank Account for Verification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Bank Modal ───────────────────────────────────────────────── */}
      {rejectModalItem && (
        <div className="emp-overlay" onClick={() => setRejectModalItem(null)}>
          <div className="emp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header">
              <h2>Reject Bank Submission</h2>
              <button className="emp-close" onClick={() => setRejectModalItem(null)}>✕</button>
            </div>
            <div className="emp-modal-body">
              <p>Rejecting submission for: <strong>{rejectModalItem.employee?.name}</strong></p>
              <label>Rejection Reason</label>
              <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Specify why this account was rejected (e.g. Name mismatch, Invalid IFSC)..." />
              <button className="emp-btn-red" onClick={handleRejectBank} disabled={!rejectionReason}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payslip View & Print Modal ──────────────────────────────────────── */}
      {selectedSlip && (
        <div className="emp-overlay" onClick={() => setSelectedSlip(null)}>
          <div className="emp-modal emp-modal-payslip" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header no-print">
              <h2>Official Payslip Statement</h2>
              <div className="emp-modal-header-actions">
                <button className="emp-btn-primary" onClick={handlePrintPayslip}>🖨️ Print / Download PDF</button>
                <button className="emp-close" onClick={() => setSelectedSlip(null)}>✕</button>
              </div>
            </div>

            {/* Printable Payslip document */}
            <div className="payslip-document" ref={payslipRef}>
              <div className="payslip-header">
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  {companyInfo?.logo && (
                    <img 
                      src={`http://localhost:5000/${companyInfo.logo}`} 
                      alt="Company Logo" 
                      style={{ maxHeight: '55px', maxWidth: '140px', objectFit: 'contain' }} 
                    />
                  )}
                  <div>
                    <h1 className="payslip-company-name" style={{ textTransform: 'uppercase' }}>
                      {companyInfo?.name || 'COMPANY NAME'}
                    </h1>
                    <p className="payslip-company-address">
                      {[companyInfo?.address, companyInfo?.phone && `Ph: ${companyInfo.phone}`, companyInfo?.email && `Email: ${companyInfo.email}`, companyInfo?.gstin && `GSTIN: ${companyInfo.gstin}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="payslip-period-badge">
                  <span>PAYSLIP</span>
                  <strong>{monthNames[selectedSlip.payroll?.month]} {selectedSlip.payroll?.year}</strong>
                </div>
              </div>

              <div className="payslip-section-title">EMPLOYEE DETAILS</div>
              <div className="payslip-meta-grid">
                <div><label>Employee Name</label><span>{selectedSlip.employee?.name}</span></div>
                <div><label>Employee ID</label><span>{selectedSlip.employee?.employeeCode}</span></div>
                <div><label>Department</label><span>{selectedSlip.employee?.department?.name || 'General'}</span></div>
                <div><label>Designation</label><span>{selectedSlip.employee?.designation?.name || 'Staff'}</span></div>
                <div><label>Payment Date</label><span>{selectedSlip.paidAt ? fmtDate(selectedSlip.paidAt) : '—'}</span></div>
                <div>
                  <label>Payment Status</label>
                  <span className={
                    selectedSlip.status === 'PAID'
                      ? 'payslip-status-paid'
                      : selectedSlip.status === 'ON_HOLD'
                      ? 'payslip-status-hold'
                      : 'payslip-status-unpaid'
                  }>
                    {selectedSlip.status === 'ON_HOLD' ? 'ON HOLD' : selectedSlip.status}
                  </span>
                </div>
              </div>

              <div className="payslip-breakdown">
                {/* Earnings Table */}
                <div className="payslip-col">
                  <div className="payslip-table-title">EARNINGS</div>
                  <table className="payslip-table">
                    <tbody>
                      <tr><td>Basic Salary</td><td className="text-right">{fmt(selectedSlip.basic)}</td></tr>
                      <tr><td>House Rent Allowance (HRA)</td><td className="text-right">{fmt(selectedSlip.hra)}</td></tr>
                      <tr><td>Conveyance Allowance</td><td className="text-right">{fmt(selectedSlip.conveyance)}</td></tr>
                      <tr><td>Medical Allowance</td><td className="text-right">{fmt(selectedSlip.medical)}</td></tr>
                      <tr><td>Special Allowance</td><td className="text-right">{fmt(selectedSlip.special)}</td></tr>
                      <tr className="payslip-total-row"><td>GROSS EARNINGS</td><td className="text-right">{fmt(selectedSlip.grossEarnings)}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions Table */}
                <div className="payslip-col">
                  <div className="payslip-table-title">DEDUCTIONS</div>
                  <table className="payslip-table">
                    <tbody>
                      <tr><td>Provident Fund (PF)</td><td className="text-right">{fmt(selectedSlip.pf)}</td></tr>
                      <tr><td>Professional Tax (PT)</td><td className="text-right">{fmt(selectedSlip.professionalTax)}</td></tr>
                      <tr><td>Tax Deducted at Source (TDS)</td><td className="text-right">{fmt(selectedSlip.tds)}</td></tr>
                      <tr className="payslip-total-row"><td>TOTAL DEDUCTIONS</td><td className="text-right">{fmt(selectedSlip.totalDeductions)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Payable Summary */}
              <div className="payslip-summary-box">
                <div>
                  <span className="payslip-net-label">NET AMOUNT DISBURSED</span>
                  <div className="payslip-net-value">{fmt(selectedSlip.netSalary)}</div>
                </div>
                <div className="payslip-utr-info">
                  <div>Paid from Account: <strong>{selectedSlip.account?.name || 'HDFC Bank'}</strong></div>
                  <div>Batch Reference: <strong>{selectedSlip.payroll?.payrollNo}</strong></div>
                </div>
              </div>

              <div className="payslip-footer">
                This is a computer-generated salary statement and requires no physical signature.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
