import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, RefreshCw, AlertCircle, X, BadgePercent } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUpsertModal, setShowUpsertModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editStructureId, setEditStructureId] = useState('');

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
      const response = await api.get('/salaries/structures');
      setStructures(response.data.data);
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Salary Structures
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Define allowances and deduction parameters mapped to staff payroll items.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStructures}
            disabled={loading}
            className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
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
              ) : structures.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-gray-500 font-semibold italic">
                    No active salary configurations registered.
                  </td>
                </tr>
              ) : (
                structures.map((struct) => {
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
