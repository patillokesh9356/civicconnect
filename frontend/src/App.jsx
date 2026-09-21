import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Login           from './pages/Login';
import Register        from './pages/Register';
import Dashboard       from './pages/Dashboard';
import SubmitComplaint from './pages/SubmitComplaint';
import MyComplaints    from './pages/MyComplaints';
import AdminDashboard  from './pages/AdminDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';

function HomeRedirect() {
  const { isAuthenticated, isAdmin, isOfficer } = useAuth();
  if (!isAuthenticated)  return <Navigate to="/login" replace />;
  if (isAdmin)           return <Navigate to="/admin" replace />;
  if (isOfficer)         return <Navigate to="/department" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Auth pages (login/register) वर Footer दाखवायचा नाही
const AUTH_ROUTES = ['/login', '/register'];

function AppLayout({ children }) {
  const location = useLocation();
  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">{children}</main>
      {!isAuthPage && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<HomeRedirect />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Citizen */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/complaints/new" element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <SubmitComplaint />
              </ProtectedRoute>
            } />
            <Route path="/my-complaints" element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <MyComplaints />
              </ProtectedRoute>
            } />

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Department Officer */}
            <Route path="/department" element={
              <ProtectedRoute allowedRoles={['department_officer']}>
                <DepartmentDashboard />
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}
