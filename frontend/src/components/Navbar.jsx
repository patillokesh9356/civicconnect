import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout, isAdmin, isOfficer, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <span className="brand-icon">🏛️</span>
          <span className="brand-text">CivicConnect</span>
        </Link>
      </div>

      {/* Hamburger */}
      <button
        className={`hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      <div className={`navbar-menu ${menuOpen ? 'is-open' : ''}`}>
        {isAuthenticated ? (
          <>
            {/* CITIZEN links */}
            {!isAdmin && !isOfficer && (
              <>
                <Link className={isActive('/dashboard')}    to="/dashboard"    onClick={() => setMenuOpen(false)}>🏠 Dashboard</Link>
                <Link className={isActive('/complaints/new')} to="/complaints/new" onClick={() => setMenuOpen(false)}>➕ Submit</Link>
                <Link className={isActive('/my-complaints')} to="/my-complaints" onClick={() => setMenuOpen(false)}>📋 My Complaints</Link>
              </>
            )}

            {/* ADMIN links */}
            {isAdmin && (
              <>
                <Link className={isActive('/admin')}          to="/admin"          onClick={() => setMenuOpen(false)}>🛡️ Admin</Link>
                <Link className={isActive('/admin/users')}    to="/admin/users"    onClick={() => setMenuOpen(false)}>👥 Users</Link>
              </>
            )}

            {/* OFFICER links */}
            {isOfficer && (
              <Link className={isActive('/department')} to="/department" onClick={() => setMenuOpen(false)}>🏢 Department</Link>
            )}

            <div className="navbar-right">
              <NotificationBell />
              <div className="user-menu">
                <button className="user-btn">
                  <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
                  <span className="user-name">{user?.name}</span>
                </button>
                <div className="user-dropdown">
                  <Link to="/profile" onClick={() => setMenuOpen(false)}>👤 Profile</Link>
                  <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="navbar-right">
            <Link className="btn btn-ghost" to="/login">Login</Link>
            <Link className="btn btn-primary" to="/register">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
