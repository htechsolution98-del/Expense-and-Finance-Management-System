import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, AlertCircle, X, BadgePercent, Download, Printer, Search } from 'lucide-react';
import { api } from '../services/api';

interface SalaryStructure {
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
  effectiveDate: string;
  status: string;
  employee: { id: string; name: string; employeeCode: string };
}

interface Employee { id: string; name: string }

export const SalaryStructures: React.FC = () => {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pagination & Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showUpsertModal, setShowUpsertModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editStructureId, setEditStructureId] = useState('');

  const filteredStructures = structures.filter(s => {
    // 1. Text Search Filter (checks employee name, employee code, status)
    const matchesSearch =
      s.employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employee?.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.status?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Date range filter (checks effectiveDate)
    const effectiveDateObj = new Date(s.effectiveDate);
    if (fromDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      if (effectiveDateObj < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (effectiveDateObj > end) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredStructures.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredStructures.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStructures = filteredStructures.slice(indexOfFirstItem, indexOfLastItem);

  // Form states
  const [employeeId, setEmployeeId] = useState('');
  const [basic, setBasic] = useState('0');
  const [hra, setHra] = useState('0');
  const [conveyance, setConveyance] = useState('0');
  const [medical, setMedical] = useState('0');
  const [special, setSpecial] = useState('0');
  const [pf, setPf] = useState('0');
  const [professionalTax, setProfessionalTax] = useState('200'); // standard professional tax in India is mostly Rs 200/month
  const [tds, setTds] = useState('0');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('ACTIVE');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isSuperAdmin = currentUser && currentUser.role === 'SUPER_ADMIN';

  const fetchStructures = async () => {
    setLoading(true);
    setError('');
    try {
      const [structRes, companyRes] = await Promise.all([
        api.get('/salaries/structures'),
        api.get('/company').catch(() => ({ data: { data: null } }))
      ]);
      setStructures(structRes.data.data);
      if (companyRes?.data?.data) {
        setCompanyInfo(companyRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retrieve salary structures.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/masters/employees');
      setEmployees(response.data.data);
    } catch (err) {
      console.error('Failed to load employees list', err);
    }
  };

  useEffect(() => {
    fetchStructures();
    fetchEmployees();
  }, []);

  const handleUpsertStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const payload = {
        employeeId,
        basic: parseFloat(basic) || 0,
        hra: parseFloat(hra) || 0,
        conveyance: parseFloat(conveyance) || 0,
        medical: parseFloat(medical) || 0,
        special: parseFloat(special) || 0,
        pf: parseFloat(pf) || 0,
        professionalTax: parseFloat(professionalTax) || 0,
        tds: parseFloat(tds) || 0,
        effectiveDate,
        status,
      };

      if (isEditMode && editStructureId) {
        await api.put(`/salaries/structures/${editStructureId}`, payload);
      } else {
        await api.post('/salaries/structures', payload);
      }

      setShowUpsertModal(false);
      // Reset
      setEmployeeId('');
      setBasic('0');
      setHra('0');
      setConveyance('0');
      setMedical('0');
      setSpecial('0');
      setPf('0');
      setTds('0');
      
      fetchStructures();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save salary structure.');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (struct: any) => {
    setIsEditMode(true);
    setEditStructureId(struct.id);
    setEmployeeId(struct.employeeId);
    setBasic(struct.basic.toString());
    setHra(struct.hra.toString());
    setConveyance(struct.conveyance.toString());
    setMedical(struct.medical.toString());
    setSpecial(struct.special.toString());
    setPf(struct.pf.toString());
    setProfessionalTax(struct.professionalTax.toString());
    setTds(struct.tds.toString());
    setEffectiveDate(new Date(struct.effectiveDate).toISOString().split('T')[0]);
    setStatus(struct.status);
    setShowUpsertModal(true);
  };

  const handleAddClick = () => {
    setIsEditMode(false);
    setEditStructureId('');
    setEmployeeId('');
    setBasic('0');
    setHra('0');
    setConveyance('0');
    setMedical('0');
    setSpecial('0');
    setPf('0');
    setProfessionalTax('0');
    setTds('0');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setStatus('ACTIVE');
    setShowUpsertModal(true);
  };

  const handleDeleteStructure = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this salary structure?')) return;
    try {
      await api.delete(`/salaries/structures/${id}`);
      fetchStructures();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete salary structure.');
    }
  };

  const handleToggleStatus = async (struct: SalaryStructure) => {
    try {
      const payload = {
        employeeId: struct.employeeId,
        basic: struct.basic,
        hra: struct.hra,
        conveyance: struct.conveyance,
        medical: struct.medical,
        special: struct.special,
        pf: struct.pf,
        professionalTax: struct.professionalTax,
        tds: struct.tds,
        effectiveDate: new Date(struct.effectiveDate).toISOString().split('T')[0],
        status: struct.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      };
      await api.put(`/salaries/structures/${struct.id}`, payload);
      fetchStructures();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleExportCSV = () => {
    if (filteredStructures.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Employee Code',
      'Employee Name',
      'Effective Date',
      'Basic (INR)',
      'HRA (INR)',
      'Conveyance (INR)',
      'Medical (INR)',
      'Special (INR)',
      'Gross Salary (INR)',
      'PF Deductions (INR)',
      'PT Deductions (INR)',
      'TDS Deductions (INR)',
      'Net Salary (INR)',
      'Status'
    ];

    const rows = filteredStructures.map((s) => {
      const gross = s.basic + s.hra + s.conveyance + s.medical + s.special;
      const deductions = s.pf + s.professionalTax + s.tds;
      const net = gross - deductions;

      return [
        s.employee?.employeeCode || '',
        s.employee?.name || '',
        new Date(s.effectiveDate).toLocaleDateString(),
        s.basic.toString(),
        s.hra.toString(),
        s.conveyance.toString(),
        s.medical.toString(),
        s.special.toString(),
        gross.toString(),
        s.pf.toString(),
        s.professionalTax.toString(),
        s.tds.toString(),
        net.toString(),
        s.status || ''
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')
              ? `"${escaped}"`
              : escaped;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `salary_structures_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredStructures.length === 0) {
      alert('No data to export.');
      return;
    }

    const printWindow = window.open('', '', 'width=900,height=800');
    if (!printWindow) return;

    const companyLogoUrl = companyInfo?.logo ? `http://localhost:5000/${companyInfo.logo}` : '';
    const companyNameStr = companyInfo?.name || 'COMPANY NAME';
    const companyAddressStr = companyInfo?.address || '';
    const companyPhoneStr = companyInfo?.phone ? `Ph: ${companyInfo.phone}` : '';
    const companyEmailStr = companyInfo?.email ? `Email: ${companyInfo.email}` : '';
    const companyGstinStr = companyInfo?.gstin ? `GSTIN: ${companyInfo.gstin}` : '';

    const tableRows = filteredStructures
      .map((s) => {
        const gross = s.basic + s.hra + s.conveyance + s.medical + s.special;
        const deductions = s.pf + s.professionalTax + s.tds;
        const net = gross - deductions;

        return `
          <tr>
            <td style="font-family: monospace; font-weight: bold; color: #111;">${s.employee?.employeeCode || ''}</td>
            <td>${s.employee?.name || ''}</td>
            <td>${new Date(s.effectiveDate).toLocaleDateString()}</td>
            <td style="text-align: right;">₹${gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; color: #ef4444;">₹${deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: 600; color: #10b981;">₹${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="text-align: center; font-weight: bold; font-size: 10px;">${s.status || ''}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Structures Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 30px; color: #333; margin: 0; }
            .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; color: #111; }
            .meta { font-size: 11px; color: #555; font-family: monospace; margin-top: 4px; }
            .company-info h2 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .company-info p { margin: 2px 0; font-size: 11px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f4f5f7; font-weight: bold; color: #444; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            tr:hover { background: #f9fafb; }
            @media print {
              body { padding: 0; }
              th { background: #f4f5f7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 50px; margin-bottom: 8px;" />` : ''}
              <h2>${companyNameStr}</h2>
              ${companyAddressStr ? `<p>${companyAddressStr}</p>` : ''}
              <p>${[companyPhoneStr, companyEmailStr, companyGstinStr].filter(Boolean).join(' | ')}</p>
            </div>
            <div style="text-align: right;">
              <div class="title">Salary Structures Report</div>
              <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
              <div class="meta">Date Range: ${fromDate ? new Date(fromDate).toLocaleDateString() : 'All Time'} - ${toDate ? new Date(toDate).toLocaleDateString() : 'All Time'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Effective Date</th>
                <th style="text-align: right;">Gross Monthly</th>
                <th style="text-align: right;">Deductions</th>
                <th style="text-align: right;">Net Monthly</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Salary Structures
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Define allowances and deduction parameters mapped to staff payroll items.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStructures}
            disabled={loading}
            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 font-semibold text-white text-sm shadow-lg shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Configure Salary</span>
          </button>
        </div>
      </div>

      {/* Date Filters & Exports Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
          {/* Find/Search input */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
            >
              Clear Dates
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            title="Export filtered structures to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            title="Print filtered structures to PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Salary Structures Table */}
      <div className="rounded-2xl glass-panel bg-card-dark/20 border border-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto w-full">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-[#0c101a]/40">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Effective Date</th>
                <th className="px-6 py-4">Earnings Breakdown (₹)</th>
                <th className="px-6 py-4">Deductions (₹)</th>
                <th className="px-6 py-4 text-right">Net Monthly Salary</th>
                <th className="px-6 py-4 text-center">Status</th>
                {isSuperAdmin && <th className="px-6 py-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {loading && structures.length === 0 ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td colSpan={isSuperAdmin ? 7 : 6} className="h-16 bg-white/2"></td>
                  </tr>
                ))
              ) : filteredStructures.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-slate-500 font-semibold italic bg-white">
                    {structures.length === 0
                      ? "No active salary configurations registered."
                      : "No salary structures found matching filters."}
                  </td>
                </tr>
              ) : (
                currentStructures.map((struct) => {
                  const gross = struct.basic + struct.hra + struct.conveyance + struct.medical + struct.special;
                  const deductions = struct.pf + struct.professionalTax + struct.tds;
                  const net = gross - deductions;

                  return (
                    <tr
                      key={struct.id}
                      className="hover:bg-white/2 transition-colors"
                    >
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-bold text-white block">
                          {struct.employee?.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {struct.employee?.employeeCode}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-gray-400 font-mono">
                        {new Date(struct.effectiveDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                        })}
                      </td>

                      <td className="px-6 py-4 space-y-1 max-w-xs">
                        <p className="text-gray-300 font-medium">
                          Gross: <span className="text-white font-bold">₹{gross.toLocaleString()}</span>
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Basic: {struct.basic} \| HRA: {struct.hra} \| Spl: {struct.special}
                        </p>
                      </td>

                      <td className="px-6 py-4 space-y-1">
                        <p className="text-red-400/90 font-medium">
                          Total: <span className="font-bold">₹{deductions.toLocaleString()}</span>
                        </p>
                        <p className="text-[10px] text-gray-500">
                          PF: {struct.pf} \| TDS: {struct.tds} \| PT: {struct.professionalTax}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-right font-black font-mono text-white text-sm">
                        ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => handleToggleStatus(struct)}
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${
                              struct.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                : 'bg-gray-500/10 border-gray-500/25 text-gray-500'
                            }`}
                            title={`Click to change to ${struct.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}`}
                          >
                            {struct.status}
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            struct.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                              : 'bg-gray-500/10 border-gray-500/25 text-gray-500'
                          }`}>
                            {struct.status}
                          </span>
                        )}
                      </td>

                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-center space-x-2">
                          <button
                            onClick={() => openEditModal(struct)}
                            className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded text-xs text-yellow-400 transition-colors"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(struct.id)}
                            className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 rounded text-xs text-red-400 transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredStructures.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(indexOfLastItem, filteredStructures.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredStructures.length}</span> configurations
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                >
                  Previous
                </button>

                {/* Render page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                  const isFirstOrLast = pageNumber === 1 || pageNumber === totalPages;
                  const isNearCurrent = Math.abs(pageNumber - currentPage) <= 1;

                  if (isFirstOrLast || isNearCurrent) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNumber
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 border-none'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-white'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  }

                  if (
                    (pageNumber === 2 && currentPage > 3) ||
                    (pageNumber === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <span key={pageNumber} className="px-1 text-slate-400 text-xs font-semibold">
                        ...
                      </span>
                    );
                  }

                  return null;
                })}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer bg-white"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configure Salary Modal */}
      {showUpsertModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl glass-panel-glow border border-white/10 bg-[#090d16] overflow-hidden animate-zoom-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Configure Salary Structure</h3>
              </div>
              <button
                onClick={() => setShowUpsertModal(false)}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpsertStructure} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  {formError}
                </div>
              )}

              {/* Employee Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Employee Target
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={isEditMode}
                    className={`block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees
                      .filter(emp => (isEditMode && emp.id === employeeId) || !structures.some(s => s.employeeId === emp.id && s.status === 'ACTIVE'))
                      .map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                {/* Effective Date */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl bg-[#0e1420]/80 border border-white/5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white text-sm outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="pt-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Monthly Earnings (INR)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Basic Salary</label>
                    <input
                      type="number"
                      value={basic}
                      onChange={(e) => setBasic(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">HRA</label>
                    <input
                      type="number"
                      value={hra}
                      onChange={(e) => setHra(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Conveyance</label>
                    <input
                      type="number"
                      value={conveyance}
                      onChange={(e) => setConveyance(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Medical Allowance</label>
                    <input
                      type="number"
                      value={medical}
                      onChange={(e) => setMedical(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Special Allowance</label>
                    <input
                      type="number"
                      value={special}
                      onChange={(e) => setSpecial(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="pt-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Monthly Deductions (INR)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">PF Deduction</label>
                    <input
                      type="number"
                      value={pf}
                      onChange={(e) => setPf(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">TDS (Tax Deducted)</label>
                    <input
                      type="number"
                      value={tds}
                      onChange={(e) => setTds(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420] border border-white/5 focus:border-indigo-500 text-xs text-white outline-none font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Prof Tax (PT)</label>
                    <input
                      type="number"
                      value={professionalTax}
                      disabled
                      className="block w-full px-3 py-2 rounded-lg bg-[#0e1420]/50 border border-white/5 text-xs text-gray-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowUpsertModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-650 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-98 transition-all cursor-pointer"
                >
                  {formLoading ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
