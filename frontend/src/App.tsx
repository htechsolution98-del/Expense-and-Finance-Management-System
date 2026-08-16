import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Unauthorized } from './pages/Unauthorized';
import { Accounts } from './pages/Accounts';
import { Payments } from './pages/Payments';
import { Ledger } from './pages/Ledger';
import { ExpensesList } from './pages/ExpensesList';
import { Vouchers } from './pages/Vouchers';
import { SalaryStructures } from './pages/SalaryStructures';
import { PayrollList } from './pages/PayrollList';
import AdvancesList from './pages/AdvancesList';
import EmployeePortal from './pages/EmployeePortal';
import ReportsDashboard from './pages/ReportsDashboard';
import AuditHistory from './pages/AuditHistory';
import PaymentCategories from './pages/PaymentCategories';
import ApprovalRules from './pages/ApprovalRules';
import Users from './pages/Users';
import { CompanySettings } from './pages/CompanySettings';
import LeaveManagement from './pages/LeaveManagement';
import AttendanceManagement from './pages/AttendanceManagement';
import AttendanceConfig from './pages/AttendanceConfig';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leaves" element={<LeaveManagement />} />
            <Route path="/attendance" element={<AttendanceManagement />} />
            
            {/* User & Access Management Routes */}
            <Route element={<ProtectedRoute requiredPermission="USER_VIEW" />}>
              <Route path="/users" element={<Users />} />
            </Route>

            {/* Scoped Finance Core Routes */}
            <Route element={<ProtectedRoute requiredPermission={['ACCOUNT_VIEW', 'ACCOUNT_CREATE']} />}>
              <Route path="/accounts" element={<Accounts />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission={['COMPANY_VIEW', 'PAYMENT_VIEW']} />}>
              <Route path="/payment-categories" element={<PaymentCategories />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="SUPER_ADMIN_ONLY" />}>
              <Route path="/approval-rules" element={<ApprovalRules />} />
              <Route path="/company-settings" element={<CompanySettings />} />
              <Route path="/attendance-config" element={<AttendanceConfig />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission={['PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_APPROVE']} />}>
              <Route path="/payments" element={<Payments />} />
            </Route>
            
            <Route element={<ProtectedRoute requiredPermission="SUPER_ADMIN_ONLY" />}>
              <Route path="/ledger" element={<Ledger />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="REPORT_VIEW" />}>
              <Route path="/reports" element={<ReportsDashboard />} />
              <Route path="/audit" element={<AuditHistory />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission={['EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_APPROVE']} />}>
              <Route path="/expenses" element={<ExpensesList />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission={['PAYMENT_VIEW', 'PAYMENT_CREATE']} />}>
              <Route path="/vouchers" element={<Vouchers />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission={['SALARY_VIEW', 'SALARY_CREATE']} />}>
              <Route path="/salaries" element={<SalaryStructures />} />
            </Route>
            <Route element={<ProtectedRoute requiredPermission="SALARY_VIEW" />}>
              <Route path="/payrolls" element={<PayrollList />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission={['ADVANCE_VIEW', 'ADVANCE_CREATE', 'ADVANCE_APPROVE']} />}>
              <Route path="/advances" element={<AdvancesList />} />
            </Route>

            <Route path="/employees" element={<EmployeePortal />} />

            {/* Catch-all redirecting to dashboard inside dashboard layout */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        {/* Catch-all global redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
