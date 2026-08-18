import React, { useState, useEffect } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { api } from '../services/api';
import { 
  Plus, RefreshCw, Wallet, CheckCircle, AlertCircle, X, 
  ChevronRight, Calculator, Loader2, Printer 
} from 'lucide-react';

interface PayrollBatch {
  id: string;
  payrollNo: string;
  month: number;
  year: number;
  status: string;
  slipsCount: number;
  totalNetSalary: number;
  createdAt: string;
}

interface PayrollItem {
  id: string;
  employeeId: string;
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
  lwpDays: number;
  absentDays: number;
  halfDays: number;
  unpaidDeductions: number;
  status: string;
  paidAccountId: string | null;
  paidAt: string | null;
  employee: { name: string; employeeCode: string };
  account: { name: string } | null;
}

interface Account { id: string; name: string; currentBalance: number }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayrollList: React.FC = () => {
  const [payrolls, setPayrolls] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected details
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [batchItems, setBatchItems] = useState<PayrollItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Modals & Payout sources
  const [showRunModal, setShowRunModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Batch runner inputs
  const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState('');

  // Single slip payout
  const [showSlipPayoutModal, setShowSlipPayoutModal] = useState(false);
  const [targetSlip, setTargetSlip] = useState<PayrollItem | null>(null);
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  // Full batch payout
  const [showBatchPayoutModal, setShowBatchPayoutModal] = useState(false);
  const [batchPayoutAccountId, setBatchPayoutAccountId] = useState('');
  const [batchPayoutLoading, setBatchPayoutLoading] = useState(false);
  const [batchPayoutError, setBatchPayoutError] = useState('');

  // Fetch roles
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { role: 'STAFF', permissions: [] };
  const canPay = user.permissions.includes('PAYMENT_CREATE') || user.role === 'SUPER_ADMIN';
  const canApprove = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  const fetchPayrolls = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/salaries/payrolls');
      setPayrolls(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch payroll batches.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    if (!canPay) return;
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.data);
    } catch (err) {
      console.error('Failed to load accounts list', err);
    }
  };

  const fetchBatchItems = async (batchId: string) => {
    setItemsLoading(true);
    try {
      const response = await api.get(`/salaries/payrolls/${batchId}`);
      setBatchItems(response.data.data.payrollItems);
    } catch (err) {
      console.error('Failed to fetch payroll slips list', err);
    } finally {
      setItemsLoading(false);
    }
  };

  // Company info for branded payslips
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  const fetchCompanyInfo = async () => {
    try {
      const response = await api.get('/company');
      setCompanyInfo(response.data.data);
    } catch (err) {
      console.error('Failed to load company profile', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchCompanyInfo();
  }, []);

  // Auto-refresh payrolls every 30s
  useAutoRefresh(fetchPayrolls, 30000);


  const handlePrintSlip = (item: PayrollItem) => {
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow || !selectedBatch) return;

    const companyLogoUrl = companyInfo?.logo ? `http://localhost:5000/${companyInfo.logo}` : '';
    const companyNameStr = companyInfo?.name || 'COMPANY NAME';
    const companyAddressStr = companyInfo?.address || '';
    const companyPhoneStr = companyInfo?.phone ? `Ph: ${companyInfo.phone}` : '';
    const companyEmailStr = companyInfo?.email ? `Email: ${companyInfo.email}` : '';
    const companyGstinStr = companyInfo?.gstin ? `GSTIN: ${companyInfo.gstin}` : '';
    const monthName = MONTHS[selectedBatch.month - 1];

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Payslip - ${item.employee.name} (${monthName} ${selectedBatch.year})</title>
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
                <p style="margin:3px 0 0; font-size:12px; color:#6c757d; font-weight:700;">${monthName} ${selectedBatch.year}</p>
                <p style="margin:2px 0 0; font-size:11px; font-family:monospace; color:#868e96;">Batch: ${selectedBatch.payrollNo}</p>
              </div>
            </div>

            <div class="emp-grid">
              <div>
                <div class="emp-label">Employee Name</div>
                <div class="emp-val">${item.employee.name}</div>
              </div>
              <div>
                <div class="emp-label">Employee Code</div>
                <div class="emp-val" style="font-family:monospace;">${item.employee.employeeCode}</div>
              </div>
              <div>
                <div class="emp-label">Status</div>
                <div class="emp-val" style="color:${item.status === 'PAID' ? '#2b8a3e' : '#d9480f'}; font-weight:800;">${item.status}</div>
              </div>
              <div>
                <div class="emp-label">Payment Date</div>
                <div class="emp-val">${item.paidAt ? new Date(item.paidAt).toLocaleDateString() : 'Pending'}</div>
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
                  <td style="text-align:right;">₹${(item.basic || 0).toLocaleString()}</td>
                  <td>Provident Fund (PF)</td>
                  <td style="text-align:right;">₹${(item.pf || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>House Rent Allowance (HRA)</td>
                  <td style="text-align:right;">₹${(item.hra || 0).toLocaleString()}</td>
                  <td>Professional Tax (PT)</td>
                  <td style="text-align:right;">₹${(item.professionalTax || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Conveyance Allowance</td>
                  <td style="text-align:right;">₹${(item.conveyance || 0).toLocaleString()}</td>
                  <td>Tax Deducted at Source (TDS)</td>
                  <td style="text-align:right;">₹${(item.tds || 0).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Medical Allowance</td>
                  <td style="text-align:right;">₹${(item.medical || 0).toLocaleString()}</td>
                  <td>-</td>
                  <td style="text-align:right;">-</td>
                </tr>
                <tr>
                  <td>Special Allowance</td>
                  <td style="text-align:right;">₹${(item.special || 0).toLocaleString()}</td>
                  <td>-</td>
                  <td style="text-align:right;">-</td>
                </tr>
                <tr class="total-row">
                  <td>Gross Earnings</td>
                  <td style="text-align:right;">₹${(item.grossEarnings || 0).toLocaleString()}</td>
                  <td>Total Deductions</td>
                  <td style="text-align:right; color:#c92a2a;">₹${(item.totalDeductions || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div class="net-box">
              <div style="font-size:11px; text-transform:uppercase; font-weight:800; color:#1971c2;">Net Salary Payable</div>
              <div class="net-val">₹${(item.netSalary || 0).toLocaleString()}</div>
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

  const handleBatchClick = (batch: PayrollBatch) => {
    setSelectedBatch(batch);
    fetchBatchItems(batch.id);
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunError('');
    setRunLoading(true);

    try {
      await api.post('/salaries/payrolls', {
        month: runMonth,
        year: runYear,
      });

      setShowRunModal(false);
      fetchPayrolls();
    } catch (err: any) {
      setRunError(err.response?.data?.message || 'Failed to generate payroll batch.');
    } finally {
      setRunLoading(false);
    }
  };

  const handleApprovePayroll = async () => {
    if (!selectedBatch) return;
    try {
      const response = await api.post(`/salaries/payrolls/${selectedBatch.id}/approve`);
      setSelectedBatch((prev) => prev ? { ...prev, status: response.data.data.status } : null);
      fetchPayrolls();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve payroll batch.');
    }
  };

  const handleSlipHoldToggle = async (item: PayrollItem) => {
    try {
      await api.patch(`/salaries/items/${item.id}/hold`);
      setBatchItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: i.status === 'PENDING' ? 'ON_HOLD' : 'PENDING' } : i
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle hold status.');
    }
  };

  const handleSlipPayoutClick = (slip: PayrollItem) => {
    setTargetSlip(slip);
    setPayoutAccountId('');
    setPayoutError('');
    setShowSlipPayoutModal(true);
  };

  const handleSlipPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlip || !selectedBatch) return;
    setPayoutError('');
    setPayoutLoading(true);

    try {
      await api.post(`/salaries/items/${targetSlip.id}/pay`, {
        accountId: payoutAccountId,
      });

      setShowSlipPayoutModal(false);
      fetchBatchItems(selectedBatch.id);
      fetchPayrolls();
      fetchAccounts();
    } catch (err: any) {
      setPayoutError(err.response?.data?.message || 'Salary slip settlement failed.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleBatchPayoutClick = () => {
    setBatchPayoutAccountId('');
    setBatchPayoutError('');
    setShowBatchPayoutModal(true);
  };

  const handleBatchPayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setBatchPayoutError('');
    setBatchPayoutLoading(true);

    try {
      await api.post(`/salaries/payrolls/${selectedBatch.id}/pay`, {
        accountId: batchPayoutAccountId,
      });

      setShowBatchPayoutModal(false);
      fetchBatchItems(selectedBatch.id);
      // Refresh payrolls list to get correct batch status from server
      const refreshed = await api.get('/salaries/payrolls');
      const updatedPayrolls = refreshed.data.data;
      setPayrolls(updatedPayrolls);
      // Update selectedBatch with fresh status from server
      const freshBatch = updatedPayrolls.find((p: any) => p.id === selectedBatch.id);
      if (freshBatch) setSelectedBatch(freshBatch);
      fetchAccounts();
    } catch (err: any) {
      setBatchPayoutError(err.response?.data?.message || 'Batch payroll settlement failed.');
    } finally {
      setBatchPayoutLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Employee Payroll logs
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Generate monthly salary batches, view slip allocations, and dispatch payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPayrolls}
            disabled={loading}
            className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowRunModal(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Payroll</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Payroll batches + slips inspector side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Batches Table list */}
        <div className={`rounded-2xl glass-panel bg-card-dark/20 border border-white/5 overflow-hidden shadow-xl ${
          selectedBatch ? 'lg:col-span-1' : 'lg:col-span-3'
        }`}>
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#0c101a]/40">
                  <th className="px-6 py-4">Batch ID / Date</th>
                  <th className="px-6 py-4">Period</th>
                  <th className="px-6 py-4 text-right">Slips</th>
                  <th className="px-6 py-4 text-right">Net Payroll</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  {selectedBatch && <th className="px-3 py-4"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {loading && payrolls.length === 0 ? (
                  [1, 2, 3].map((n) => (
                    <tr key={n} className="animate-pulse">
                      <td colSpan={6} className="h-16 bg-white/2"></td>
                    </tr>
                  ))
                ) : payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-semibold italic">
                      No payroll runs registered.
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => handleBatchClick(p)}
                      className={`hover:bg-white/2 transition-colors cursor-pointer ${
                        selectedBatch?.id === p.id ? 'bg-indigo-500/5' : ''
                      }`}
                    >
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-bold text-white font-mono block">
                          {p.payrollNo}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-gray-300 font-medium">
                        {MONTHS[p.month - 1]} {p.year}
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-gray-400">
                        {p.slipsCount} Slips
                      </td>

                      <td className="px-6 py-4 text-right font-black font-mono text-white text-sm">
                        ₹{p.totalNetSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize ${
                          p.status === 'DRAFT'
                            ? 'bg-gray-500/10 border-gray-500/25 text-gray-400'
                            : p.status === 'APPROVED'
                            ? 'bg-green-500/10 border-green-500/25 text-green-400'
                            : p.status === 'PAID'
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/25 text-red-400'
                        }`}>
                          {p.status.toLowerCase()}
                        </span>
                      </td>

                      {selectedBatch && (
                        <td className="px-3 py-4 text-gray-500 hover:text-white">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slips Inspector Side Panel */}
        {selectedBatch && (
          <div className="lg:col-span-2 rounded-2xl glass-panel p-6 bg-card-dark/30 border border-white/5 shadow-xl space-y-6 animate-slide-in-right relative">
            <button
              onClick={() => setSelectedBatch(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex justify-between items-start pr-8">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 block mb-1">
                  Slips Batch Inspector
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  Payroll {MONTHS[selectedBatch.month - 1]} {selectedBatch.year}
                </h2>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedBatch.payrollNo}</p>
              </div>

              {/* Action buttons (Approve / Settle Batch) */}
              <div className="flex gap-2">
                {selectedBatch.status === 'DRAFT' && canApprove && (
                  <button
                    onClick={handleApprovePayroll}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold text-xs shadow active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve Batch</span>
                  </button>
                )}

                {selectedBatch.status === 'APPROVED' && canPay && (() => {
                  const pendingCount = batchItems.filter(i => i.status === 'PENDING').length;
                  if (pendingCount === 0) return null;
                  const isPartiallyPaid = batchItems.some(i => i.status === 'PAID');
                  return (
                    <button
                      onClick={handleBatchPayoutClick}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/10 active:scale-95 transition-all cursor-pointer"
                    >
                      <Wallet className="w-4 h-4" />
                      <span>{isPartiallyPaid ? `Pay Remaining (${pendingCount})` : 'Pay Entire Batch'}</span>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Slips table */}
            <div className="border border-white/5 rounded-xl overflow-hidden bg-white/1">
              <div className="overflow-x-auto w-full">
              <table className="min-w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-bold text-gray-500 uppercase bg-[#0c101a]/30">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3 text-right">Gross Earnings</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-4 py-3 text-right font-bold">Net Salary</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {itemsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 italic">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-2" />
                        <span>Loading batch salary slips...</span>
                      </td>
                    </tr>
                  ) : batchItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-600 italic">
                        No slips generated inside this batch.
                      </td>
                    </tr>
                  ) : (
                    batchItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/1">
                        <td className="px-4 py-3">
                          <span className="font-bold text-white block">{item.employee.name}</span>
                          <span className="text-[9px] text-gray-500 font-mono block">
                            {item.employee.employeeCode}
                            {(item.absentDays > 0 || item.lwpDays > 0 || item.halfDays > 0) && (
                              <span className="text-amber-400 font-semibold ml-2">
                                (Absent: {item.absentDays}d | LWP: {item.lwpDays}d | Half: {item.halfDays}d)
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300 font-mono">
                          ₹{item.grossEarnings.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-red-400/80 font-mono">
                          ₹{item.totalDeductions.toLocaleString()}
                          {item.unpaidDeductions > 0 && (
                            <span className="text-[9px] text-rose-400 font-bold block" title="Loss of Pay">
                              -₹{item.unpaidDeductions.toLocaleString()} LOP
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-black font-mono text-white">
                          ₹{item.netSalary.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            item.status === 'PAID'
                              ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                              : item.status === 'ON_HOLD'
                                ? 'bg-orange-500/10 border border-orange-500/25 text-orange-400'
                                : 'bg-gray-500/10 border border-white/5 text-gray-400'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center space-x-2">
                          {item.status === 'PENDING' && selectedBatch.status === 'APPROVED' && canPay ? (
                            <button
                              onClick={() => handleSlipPayoutClick(item)}
                              className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                            >
                              Pay
                            </button>
                          ) : item.status === 'PAID' && item.account ? (
                            <span className="text-[9px] text-gray-500 truncate max-w-[80px] inline-block align-middle" title={`Settled from ${item.account.name}`}>
                              {item.account.name}
                            </span>
                          ) : null}

                          {canApprove && (item.status === 'PENDING' || item.status === 'ON_HOLD') && (
                            <button
                              onClick={() => handleSlipHoldToggle(item)}
                              className={`px-2 py-1 rounded border text-[9px] font-bold transition-all cursor-pointer ${
                                item.status === 'PENDING'
                                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
                                  : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
                              }`}
                            >
                              {item.status === 'PENDING' ? 'Hold' : 'Unhold'}
                            </button>
                          )}

                          <button
                            onClick={() => handlePrintSlip(item)}
                            title="Print Salary Slip"
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer inline-block align-middle"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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
      </div>

      {/* Generate Payroll Batch Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Run Monthly Payroll</h3>
              </div>
              <button
                onClick={() => setShowRunModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGeneratePayroll} className="p-6 space-y-4">
              {runError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {runError}
                </div>
              )}

              <p className="text-xs text-gray-400 leading-relaxed">
                This batch will gather all active employees holding active monthly salary configurations, generate draft pay slips, and calculate total gross and net salary targets.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Month selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Target Month
                  </label>
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(parseInt(e.target.value))}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none"
                    required
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Year selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Target Year
                  </label>
                  <select
                    value={runYear}
                    onChange={(e) => setRunYear(parseInt(e.target.value))}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none font-mono"
                    required
                  >
                    {[2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={runLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-650 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {runLoading ? 'Running Calculation...' : 'Execute Calculation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Single Slip Payout Modal */}
      {showSlipPayoutModal && targetSlip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-400" />
                <h3 className="text-lg font-bold text-white">Disburse Salary Slip</h3>
              </div>
              <button
                onClick={() => setShowSlipPayoutModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSlipPayoutSubmit} className="p-6 space-y-4">
              {payoutError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {payoutError}
                </div>
              )}

              <p className="text-xs text-gray-400 leading-relaxed">
                Settle monthly net salary for <span className="text-white font-bold">{targetSlip.employee.name}</span>.
              </p>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 flex justify-between items-baseline mb-4">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Net Payout Amount:</span>
                <span className="text-lg font-black text-white font-mono">₹{targetSlip.netSalary.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Payout Bank/Cash Account
                </label>
                <select
                  value={payoutAccountId}
                  onChange={(e) => setPayoutAccountId(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-green-500 text-white text-sm outline-none"
                  required
                >
                  <option value="">-- Select Source Account --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Bal: ₹{acc.currentBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowSlipPayoutModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={payoutLoading}
                  className="px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold shadow-lg shadow-green-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {payoutLoading ? 'Executing...' : 'Disburse Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Full Batch Payout Modal */}
      {showBatchPayoutModal && selectedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Pay Entire Payroll Batch</h3>
              </div>
              <button
                onClick={() => setShowBatchPayoutModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchPayoutSubmit} className="p-6 space-y-4">
              {batchPayoutError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {batchPayoutError}
                </div>
              )}

              <p className="text-xs text-gray-400 leading-relaxed">
                Process total payroll disburse settlement for <span className="text-white font-bold">{MONTHS[selectedBatch.month - 1]} {selectedBatch.year}</span>. This will sequentially execute bank transfers for all unpaid slips in this batch.
              </p>

              <div className="p-3 rounded-xl bg-white/2 border border-white/5 flex justify-between items-baseline mb-4">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Total Batch Net Outflow:</span>
                <span className="text-lg font-black text-white font-mono">
                  ₹{batchItems
                    .filter(item => item.status !== 'ON_HOLD' && item.status !== 'PAID')
                    .reduce((sum, item) => sum + item.netSalary, 0)
                    .toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  Debit Source Account
                </label>
                <select
                  value={batchPayoutAccountId}
                  onChange={(e) => setBatchPayoutAccountId(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 text-white text-sm outline-none"
                  required
                >
                  <option value="">-- Select Source Account --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Bal: ₹{acc.currentBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowBatchPayoutModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={batchPayoutLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-650 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {batchPayoutLoading ? 'Settling Batch...' : 'Disburse Batch Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
