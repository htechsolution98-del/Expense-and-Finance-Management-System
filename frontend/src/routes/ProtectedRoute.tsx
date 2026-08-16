import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  requiredPermission?: string | string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredPermission }) => {
  const token = localStorage.getItem('access_token');
  const userString = localStorage.getItem('user');

  if (!token || !userString) {
    // Redirect to login page if user is not authenticated
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userString);

  // If a specific permission is required, check if user has it
  if (requiredPermission) {
    // '*' wildcard means SUPER_ADMIN — bypass all permission guards
    // Also bypass if role is explicitly SUPER_ADMIN (double safety)
    const requiredPerms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission =
      user.role === 'SUPER_ADMIN' ||
      user.permissions?.includes('*') ||
      requiredPerms.some((p) => user.permissions?.includes(p));

    if (!hasPermission) {
      // Redirect to unauthorized / access denied page
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Render child routes if authenticated and authorized
  return <Outlet />;
};
