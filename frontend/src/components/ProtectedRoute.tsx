// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  /** Se informado, só esses perfis acessam; os outros voltam para /home */
  roles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
