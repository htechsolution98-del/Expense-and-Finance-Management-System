import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  requiredPermission?: string | string[];
}

// Helper to read user from localStorage
const readUser = () => {
  const userString = localStorage.getItem('user');
  return userString ? JSON.parse(userString) : null;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredPermission }) => {
  const token = localStorage.getItem('access_token');

  // Reactive user state — re-reads from localStorage when permissions are updated
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    // Re-read user when extra permissions are saved (event dispatched by Users.tsx / DashboardLayout)
    const onPermissionsUpdated = () => setUser(readUser());
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') setUser(readUser());
    };

    window.addEventListener('user-permissions-updated', onPermissionsUpdated);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener('user-permissions-updated', onPermissionsUpdated);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific permission is required, check if user has it
  if (requiredPermission) {
    if (requiredPermission === 'SUPER_ADMIN_ONLY') {
      const isSuper = user.role === 'SUPER_ADMIN' || user.permissions?.includes('*');
      if (!isSuper) {
        return <Navigate to="/unauthorized" replace />;
      }
    } else if (requiredPermission === 'ADMIN_ONLY') {
      const isAdmin =
        user.role === 'SUPER_ADMIN' ||
        user.role === 'ADMIN' ||
        user.role === 'ACCOUNTS' ||
        user.role?.startsWith('ADMIN') ||
        user.permissions?.includes('*');
      if (!isAdmin) {
        return <Navigate to="/unauthorized" replace />;
      }
    } else {
      const requiredPerms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const hasPermission =
        user.role === 'SUPER_ADMIN' ||
        user.permissions?.includes('*') ||
        requiredPerms.some((p: string) => user.permissions?.includes(p));

      if (!hasPermission) {
        return <Navigate to="/unauthorized" replace />;
      }
    }
  }

  // Render child routes if authenticated and authorized
  return <Outlet />;
};
