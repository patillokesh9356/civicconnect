import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * allowedRoles: array of role strings e.g. ['admin'] or ['citizen'] or null (any authenticated)
 */
export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to role-appropriate home
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'department_officer') return <Navigate to="/department" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
