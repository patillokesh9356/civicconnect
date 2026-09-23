import { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  Pending:     '#f59e0b',
  Assigned:    '#3b82f6',
  'In Progress': '#8b5cf6',
  Resolved:    '#10b981',
  Rejected:    '#ef4444',
};

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const { user, API, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]         = useState(null);
  const [notifications, setNotifs] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats first — if this fails we show error
        const statsRes = await axios.get(`${API}/dashboard/stats`);
        setStats(statsRes.data);

        // Notifications — non-critical, don't block dashboard if it fails
        try {
          const notifRes = await axios.get(`${API}/notifications`);
          setNotifs(notifRes.data.notifications?.slice(0, 5) || []);
        } catch {
          setNotifs([]);
        }
      } catch (err) {
        const status = err.response?.status;
        if (status === 401) {
          // Token expired — auto logout and redirect
          logout();
          navigate('/login', { state: { message: 'Session expired. Please login again.' } });
          return;
        }
        const msg = err.response?.data?.message
          || (err.message === 'Network Error' ? 'Server is not reachable. Please check your connection.' : null)
          || `Failed to load dashboard (${err.response?.status || err.message})`;
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [API]);

  if (loading) return <LoadingSpinner fullPage text="Loading Dashboard…" />;
  if (error) return (
    <div className="page-container">
      <div className="error-card">
        <span className="error-icon">⚠️</span>
        <h3>Dashboard could not be loaded</h3>
        <p className="error-msg">{error}</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            🔄 Retry
          </button>
          <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>
            🔑 Login Again
          </button>
        </div>
      </div>
    </div>
  );

  const statCards = [
    { label: 'Total',       value: stats.total,       icon: '📋', color: 'blue'   },
    { label: 'Pending',     value: stats.pending,     icon: '⏳', color: 'yellow' },
    { label: 'In Progress', value: stats.in_progress, icon: '🔧', color: 'purple' },
    { label: 'Resolved',    value: stats.resolved,    icon: '✅', color: 'green'  },
    { label: 'Rejected',    value: stats.rejected,    icon: '❌', color: 'red'    },
  ];

  const pieData = stats.by_category?.map(c => ({ name: c.category || 'Other', value: c.count })) || [];

  const typeIcon = { submitted: '✅', status_change: '🔄', assigned: '📋', resolved: '🎉', rejected: '❌', info: 'ℹ️' };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Welcome, {user?.name} 👋</h1>
          <p className="page-subtitle">Here's your civic activity overview</p>
        </div>
        <Link to="/complaints/new" className="btn btn-primary">
          ➕ New Complaint
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map(card => (
          <div key={card.label} className={`stat-card stat-card--${card.color}`}>
            <span className="stat-icon">{card.icon}</span>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="charts-row">
        {/* Category pie */}
        {pieData.length > 0 && (
          <div className="chart-card">
            <h3>Complaints by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly bar */}
        {stats.monthly?.length > 0 && (
          <div className="chart-card">
            <h3>Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom row: Quick actions + Recent notifications */}
      <div className="bottom-row">
        {/* Quick Actions */}
        <div className="quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions-grid">
            <Link to="/complaints/new" className="quick-action">
              <span>➕</span><p>Submit Complaint</p>
            </Link>
            <Link to="/my-complaints" className="quick-action">
              <span>📋</span><p>My Complaints</p>
            </Link>
            <Link to="/profile" className="quick-action">
              <span>👤</span><p>My Profile</p>
            </Link>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="notif-card">
          <h3>Recent Notifications</h3>
          {notifications.length === 0 ? (
            <p className="empty-state">No notifications yet.</p>
          ) : (
            <ul className="notif-mini-list">
              {notifications.map(n => (
                <li key={n.id} className={`notif-mini-item ${!n.is_read ? 'unread' : ''}`}>
                  <span>{typeIcon[n.type] || 'ℹ️'}</span>
                  <div>
                    <p className="notif-mini-title">{n.title}</p>
                    <p className="notif-mini-msg">{n.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
