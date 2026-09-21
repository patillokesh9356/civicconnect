import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { API, isAuthenticated } = useAuth();
  const [notifs, setNotifs]       = useState([]);
  const [unread, setUnread]       = useState(0);
  const [open, setOpen]           = useState(false);
  const dropRef                   = useRef(null);

  const fetchNotifs = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifs(res.data.notifications || []);
      setUnread(res.data.unread_count || 0);
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`);
      setUnread(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* */ }
  };

  const typeIcon = { submitted: '✅', status_change: '🔄', assigned: '📋', resolved: '🎉', rejected: '❌', info: 'ℹ️' };

  if (!isAuthenticated) return null;

  return (
    <div className="notif-bell" ref={dropRef}>
      <button className="bell-btn" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <h4>Notifications</h4>
            {unread > 0 && (
              <button className="mark-read-btn" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <p className="no-notif">No notifications yet</p>
            ) : (
              notifs.slice(0, 10).map(n => (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                  <span className="notif-icon">{typeIcon[n.type] || 'ℹ️'}</span>
                  <div className="notif-content">
                    <p className="notif-title">{n.title}</p>
                    <p className="notif-msg">{n.message}</p>
                    <p className="notif-time">
                      {new Date(n.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
