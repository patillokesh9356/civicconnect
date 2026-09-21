import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const BADGE = {
  Pending:       'badge-yellow',
  Assigned:      'badge-blue',
  'In Progress': 'badge-purple',
  Resolved:      'badge-green',
  Rejected:      'badge-red',
};

export default function DepartmentDashboard() {
  const { user, API } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filterStatus, setFilter]   = useState('');
  const [selected, setSelected]     = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [newStatus, setNewStatus]   = useState('');
  const [comment, setComment]       = useState('');
  const [actionLoading, setActLoad] = useState(false);
  const [actionMsg, setActionMsg]   = useState('');

  const fetchComplaints = async (status = '') => {
    setLoading(true);
    try {
      const params = status ? { status } : {};
      const res = await axios.get(`${API}/department/complaints`, { params });
      setComplaints(res.data.complaints || []);
    } catch {
      setError('Failed to load department complaints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const openDetail = async (c) => {
    setSelected(c);
    setNewStatus(c.status);
    setActionMsg('');
    try {
      const res = await axios.get(`${API}/complaints/${c.id}`);
      setSelected(res.data.complaint);
      setTimeline(res.data.timeline || []);
    } catch { /* show existing */ }
  };

  const closeDetail = () => { setSelected(null); setTimeline([]); setActionMsg(''); };

  const updateStatus = async () => {
    if (!newStatus) return;
    setActLoad(true);
    try {
      await axios.put(`${API}/department/complaints/${selected.id}/status`, {
        status: newStatus, comment
      });
      setActionMsg(`✅ Status updated to "${newStatus}"`);
      fetchComplaints(filterStatus);
      const res = await axios.get(`${API}/complaints/${selected.id}`);
      setSelected(res.data.complaint);
      setTimeline(res.data.timeline || []);
      setComment('');
    } catch (e) {
      setActionMsg(`❌ ${e.response?.data?.message || 'Update failed'}`);
    } finally { setActLoad(false); }
  };

  const STATUSES = ['', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

  const counts = {
    total:       complaints.length,
    in_progress: complaints.filter(c => c.status === 'In Progress').length,
    resolved:    complaints.filter(c => c.status === 'Resolved').length,
    pending:     complaints.filter(c => c.status === 'Assigned' || c.status === 'Pending').length,
  };

  if (loading && !selected) return <LoadingSpinner fullPage text="Loading Department Dashboard…" />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Department Dashboard 🏢</h1>
          <p className="page-subtitle">Officer: {user?.name} · Managing assigned complaints</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-card--blue"><span className="stat-icon">📋</span>
          <div><div className="stat-value">{counts.total}</div><div className="stat-label">Total</div></div></div>
        <div className="stat-card stat-card--yellow"><span className="stat-icon">⏳</span>
          <div><div className="stat-value">{counts.pending}</div><div className="stat-label">Assigned/Pending</div></div></div>
        <div className="stat-card stat-card--purple"><span className="stat-icon">🔧</span>
          <div><div className="stat-value">{counts.in_progress}</div><div className="stat-label">In Progress</div></div></div>
        <div className="stat-card stat-card--green"><span className="stat-icon">✅</span>
          <div><div className="stat-value">{counts.resolved}</div><div className="stat-label">Resolved</div></div></div>
      </div>

      {/* Filter */}
      <div className="filter-tabs">
        {STATUSES.map(s => (
          <button
            key={s || 'all'}
            className={`filter-tab ${filterStatus === s ? 'active' : ''}`}
            onClick={() => { setFilter(s); fetchComplaints(s); }}
          >
            {s || 'All'} ({s === '' ? complaints.length : complaints.filter(c => c.status === s).length})
          </button>
        ))}
      </div>

      {/* Complaints list */}
      {complaints.length === 0 ? (
        <div className="empty-card">
          <span>📭</span>
          <p>No complaints assigned to your department.</p>
        </div>
      ) : (
        <div className="complaints-list">
          {complaints.map(c => (
            <div key={c.id} className="complaint-card" onClick={() => openDetail(c)}>
              <div className="complaint-card-top">
                <div className="complaint-card-meta">
                  <span className="complaint-id">#{c.id}</span>
                  <span className={`badge ${BADGE[c.status] || 'badge-gray'}`}>{c.status}</span>
                </div>
                <span className="complaint-date">
                  {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h3 className="complaint-title">{c.title}</h3>
              <p className="complaint-desc">{c.description?.slice(0, 120)}…</p>
              <div className="complaint-card-footer">
                {c.category && <span className="tag">📁 {c.category}</span>}
                {c.location  && <span className="tag">📍 {c.location}</span>}
                <span className="tag">👤 {c.citizen_name}</span>
                <span className="view-detail-btn">Manage →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail & Update Modal */}
      {selected && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complaint #{selected.id}</h2>
              <button className="modal-close" onClick={closeDetail}>✕</button>
            </div>
            <div className="modal-body">
              {actionMsg && <div className={`alert ${actionMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{actionMsg}</div>}

              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Status</span>
                  <span className={`badge ${BADGE[selected.status]}`}>{selected.status}</span></div>
                <div className="detail-item"><span className="detail-label">Priority</span>
                  <span>{selected.priority}</span></div>
                <div className="detail-item"><span className="detail-label">Citizen</span>
                  <span>{selected.citizen_name}</span></div>
                <div className="detail-item"><span className="detail-label">Location</span>
                  <span>{selected.location || '—'}</span></div>
                <div className="detail-item detail-item--full"><span className="detail-label">Description</span>
                  <p>{selected.description}</p></div>
              </div>

              {/* Update */}
              <div className="update-section">
                <h4>Update Status</h4>
                <div className="form-row">
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    {['In Progress', 'Resolved', 'Rejected'].map(s =>
                      <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={updateStatus} disabled={actionLoading}>
                    {actionLoading ? '…' : 'Update'}
                  </button>
                </div>
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Comment</label>
                  <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Add a note…" />
                </div>
              </div>

              {/* Timeline */}
              {timeline.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4>📅 Timeline</h4>
                  <div className="timeline">
                    {timeline.map((t, i) => (
                      <div key={t.id} className={`timeline-item ${i === timeline.length-1 ? 'latest' : ''}`}>
                        <div className="timeline-dot" />
                        <div className="timeline-content">
                          <div className="timeline-status">
                            {t.old_status && <><span className="badge badge-gray">{t.old_status}</span> → </>}
                            <span className={`badge ${BADGE[t.new_status] || 'badge-gray'}`}>{t.new_status}</span>
                          </div>
                          {t.comment && <p className="timeline-comment">{t.comment}</p>}
                          <p className="timeline-meta">{t.changed_by_name || 'System'} · {new Date(t.created_at).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
