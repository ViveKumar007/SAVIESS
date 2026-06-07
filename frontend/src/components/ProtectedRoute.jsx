import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('accessToken');
  const userString = localStorage.getItem('user');
  
  if (!token || !userString) {
    // User is not authenticated
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userString);

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // User is authenticated but does not have the required permissions
      // Redirect to their default dashboard based on their role
      if (user.role === 'rhp') {
        return <Navigate to="/rhp-dashboard" replace />;
      } else if (user.role === 'field_officer') {
        return <Navigate to="/fo-dashboard" replace />;
      } else if (['super_admin', 'program_director', 'field_manager'].includes(user.role)) {
        return <Navigate to="/admin-dashboard" replace />;
      }
      return <Navigate to="/login" replace />;
    }

    return children;
  } catch (error) {
    console.error('ProtectedRoute check failure:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
};

export default ProtectedRoute;
