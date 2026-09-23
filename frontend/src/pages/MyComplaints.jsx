import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  Pending:       'badge-yellow',
  Assigned:      'badge-blue',
  'In Progress': 'badge-purple',
  Resolved:      'badge-green',
  Rejected:      'badge-red',
};

const PRIORITY_COLORS = {
  Low:      'badge-gray',
  Medium:   'badge-blue',
  High:     'badge-orange',
  Critical: 'badge-red',
};

export default function MyComplaints() {
  const { API } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);
  const [timeline, setTimeline]     = useState([]);
  const [modalLoading, setModalLoad] = useState(false);
  const [filterStatus, setFilter]   = useState('All');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await axios.get(`${API}/complaints/user`);
        setComplaints(res.data.complaints || []);
      } catch (err) {
        if (err.message === 'Network Error') {
          setError('Server is not reachable. Please check your connection.');
        } else {
          setError(
            err.response?.data?.message ||
            `Failed to load complaints (${err.response?.status || err.message})`
          );
        }
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, [API]);

  const openDetail = async (complaint) => {
    setSelected(complaint);
    setModalLoad(true);
    try {
      const res = await axios.get(`${API}/complaints/${complaint.id}`);
      setSelected(res.data.complaint);
      setTimeline(res.data.timeline || []);
    } catch {
      /* show existing data */
    } finally {
      setModalLoad(false);
    }
  };

  const closeModal = () => {
    setSelected(null);
    setTimeline([]);
  };

  const statuses = ['All', 'Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
  const filtered = filterStatus === 'All'
    ? complaints
    : complaints.filter(c => c.status === filterStatus);

  if (loading) return <LoadingSpinner fullPage text="Loading complaints…" />;

  if (error) return (
    <div className="page-container">
      <div className="error-card">
        <span className="error-icon">⚠️</span>
        <h3>Complaints load होऊ शकल्या नाहीत</h3>
        <p className="error-msg">{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          🔄 Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>My Complaints 📋</h1>
          <p className="page-subtitle">{complaints.length} total complaints</p>
        </div>
        <Link to="/complaints/new" className="btn btn-primary">➕ New Complaint</Link>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {statuses.map(s => (
          <button
            key={s}
            className={`filter-tab ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
            {s === 'All'
              ? ` (${complaints.length})`
              : ` (${complaints.filter(c => c.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Complaints list */}
      {filtered.length === 0 ? (
        <div className="empty-card">
          <span>📭</span>
          <p>No complaints found.</p>
          <Link to="/complaints/new" className="btn btn-primary">
            Submit Your First Complaint
          </Link>
        </div>
      ) : (
        <div className="complaints-list">
          {filtered.map(c => (
            <div key={c.id} className="complaint-card" onClick={() => openDetail(c)}>
              <div className="complaint-card-top">
                <div className="complaint-card-meta">
                  <span className="complaint-id">#{c.id}</span>
                  <span className={`badge ${STATUS_COLORS[c.status] || 'badge-gray'}`}>
                    {c.status}
                  </span>
                  <span className={`badge ${PRIORITY_COLORS[c.priority] || 'badge-gray'}`}>
                    {c.priority}
                  </span>
                </div>
                <span className="complaint-date">
                  {new Date(c.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
              </div>
              <h3 className="complaint-title">{c.title}</h3>
              <p className="complaint-desc">{c.description?.slice(0, 120)}…</p>
              <div className="complaint-card-footer">
                {c.category        && <span className="tag">📁 {c.category}</span>}
                {c.location        && <span className="tag">📍 {c.location}</span>}
                {c.department_name && <span className="tag">🏢 {c.department_name}</span>}
                <span className="view-detail-btn">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complaint #{selected.id}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {modalLoading ? (
              <LoadingSpinner text="Loading details…" />
            ) : (
              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className={`badge ${STATUS_COLORS[selected.status] || 'badge-gray'}`}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Priority</span>
                    <span className={`badge ${PRIORITY_COLORS[selected.priority] || 'badge-gray'}`}>
                      {selected.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Category</span>
                    <span>{selected.category || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Department</span>
                    <span>{selected.department_name || 'Not assigned'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Location</span>
                    <span>{selected.location || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Submitted On</span>
                    <span>{new Date(selected.created_at).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Description</h4>
                  <p>{selected.description}</p>
                </div>

                {/* Proof Image */}
                {selected.image_url && (
                  <div className="detail-section">
                    <h4>📷 Proof Photo</h4>
                    <div className="proof-image-box">
                      <img
                        src={selected.image_url}
                        alt="Complaint proof"
                        className="proof-image"
                        onClick={() => window.open(selected.image_url, '_blank')}
                      />
                      <p className="proof-hint">Click to view full size</p>
                    </div>
                  </div>
                )}

                {selected.ai_summary && (
                  <div className="detail-section ai-box-small">
                    <h4>🤖 AI Summary</h4>
                    <p>{selected.ai_summary}</p>
                    {selected.ai_suggestion && (
                      <p className="ai-suggestion">💡 {selected.ai_suggestion}</p>
                    )}
                  </div>
                )}

                {selected.is_duplicate && (
                  <div className="alert alert-warning">
                    ⚠️ This complaint may be a duplicate of #{selected.duplicate_of}.
                  </div>
                )}

                {timeline.length > 0 && (
                  <div className="detail-section">
                    <h4>📅 Complaint Timeline</h4>
                    <div className="timeline">
                      {timeline.map((t, i) => (
                        <div
                          key={t.id}
                          className={`timeline-item ${i === timeline.length - 1 ? 'latest' : ''}`}
                        >
                          <div className="timeline-dot" />
                          <div className="timeline-content">
                            <div className="timeline-status">
                              {t.old_status && (
                                <>
                                  <span className="badge badge-gray">{t.old_status}</span>
                                  {' → '}
                                </>
                              )}
                              <span className={`badge ${STATUS_COLORS[t.new_status] || 'badge-gray'}`}>
                                {t.new_status}
                              </span>
                            </div>
                            {t.comment && (
                              <p className="timeline-comment">{t.comment}</p>
                            )}
                            <p className="timeline-meta">
                              {t.changed_by_name || 'System'} ·{' '}
                              {new Date(t.created_at).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
