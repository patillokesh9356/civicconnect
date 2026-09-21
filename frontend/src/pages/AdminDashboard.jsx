import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  Pending:       '#f59e0b',
  Assigned:      '#3b82f6',
  'In Progress': '#8b5cf6',
  Resolved:      '#10b981',
  Rejected:      '#ef4444',
};

const BADGE = {
  Pending:       'badge-yellow',
  Assigned:      'badge-blue',
  'In Progress': 'badge-purple',
  Resolved:      'badge-green',
  Rejected:      'badge-red',
};

const PRIORITY_BADGE = { Low: 'badge-gray', Medium: 'badge-blue', High: 'badge-orange', Critical: 'badge-red' };

export default function AdminDashboard() {
  const { API } = useAuth();

  const [stats, setStats]           = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [departments, setDepts]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(true);
  const [tableLoading, setTLoad]    = useState(false);
  const [error, setError]           = useState('');

  // Filters
  const [filters, setFilters] = useState({ status: '', category: '', department_id: '', search: '' });

  // Modal
  const [selectedId, setSelectedId]   = useState(null);
  const [selectedCmp, setSelectedCmp] = useState(null);
  const [timeline, setTimeline]       = useState([]);
  const [modalTab, setModalTab]       = useState('details');
  const [newStatus, setNewStatus]     = useState('');
  const [statusComment, setStatusCmt] = useState('');
  const [assignDept, setAssignDept]   = useState('');
  const [actionLoading, setActLoad]   = useState(false);
  const [actionMsg, setActionMsg]     = useState('');

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, deptsRes] = await Promise.all([
          axios.get(`${API}/admin/stats`),
          axios.get(`${API}/departments`),
        ]);
        setStats(statsRes.data);
        setDepts(deptsRes.data.departments || []);
      } catch { setError('Failed to load admin data.'); }
      finally { setLoading(false); }
    };
    fetchStats();
  }, [API]);

  // Fetch complaints table
  const fetchComplaints = useCallback(async (pg = 1) => {
    setTLoad(true);
    try {
      const params = { page: pg, per_page: 15, ...filters };
      const res = await axios.get(`${API}/admin/complaints`, { params });
      setComplaints(res.data.complaints || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
      setPage(pg);
    } catch { setError('Failed to load complaints.'); }
    finally { setTLoad(false); }
  }, [API, filters]);

  useEffect(() => { fetchComplaints(1); }, [filters]);

  // Open modal
  const openModal = async (id) => {
    setSelectedId(id);
    setActionMsg('');
    try {
      const res = await axios.get(`${API}/complaints/${id}`);
      setSelectedCmp(res.data.complaint);
      setTimeline(res.data.timeline || []);
      setNewStatus(res.data.complaint.status);
      setAssignDept(res.data.complaint.department_id || '');
      setModalTab('details');
    } catch { setError('Failed to load complaint details.'); }
  };

  const closeModal = () => { setSelectedId(null); setSelectedCmp(null); setTimeline([]); setActionMsg(''); };

  // Update status
  const updateStatus = async () => {
    if (!newStatus) return;
    setActLoad(true);
    try {
      await axios.put(`${API}/admin/complaints/${selectedId}/status`, {
        status: newStatus, comment: statusComment
      });
      setActionMsg(`✅ Status updated to "${newStatus}"`);
      fetchComplaints(page);
      const res = await axios.get(`${API}/complaints/${selectedId}`);
      setSelectedCmp(res.data.complaint);
      setTimeline(res.data.timeline || []);
      setStatusCmt('');
    } catch (e) {
      setActionMsg(`❌ ${e.response?.data?.message || 'Update failed'}`);
    } finally { setActLoad(false); }
  };

  // Assign dept
  const assignDepartment = async () => {
    if (!assignDept) return;
    setActLoad(true);
    try {
      await axios.put(`${API}/admin/complaints/${selectedId}/assign`, { department_id: parseInt(assignDept) });
      setActionMsg('✅ Department assigned');
      fetchComplaints(page);
      const res = await axios.get(`${API}/complaints/${selectedId}`);
      setSelectedCmp(res.data.complaint);
      setTimeline(res.data.timeline || []);
    } catch (e) {
      setActionMsg(`❌ ${e.response?.data?.message || 'Assignment failed'}`);
    } finally { setActLoad(false); }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading Admin Dashboard…" />;

  const pieData  = stats?.by_status?.map(s => ({ name: s.status, value: s.count })) || [];
  const COLORS   = Object.values(STATUS_COLORS);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard 🛡️</h1>
          <p className="page-subtitle">Manage all civic complaints and departments</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stat cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card stat-card--blue">
            <span className="stat-icon">📋</span>
            <div><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
          </div>
          {stats.by_status?.map(s => (
            <div key={s.status} className="stat-card" style={{ borderLeftColor: STATUS_COLORS[s.status] }}>
              <span className="stat-icon">●</span>
              <div><div className="stat-value">{s.count}</div><div className="stat-label">{s.status}</div></div>
            </div>
          ))}
          <div className="stat-card stat-card--green">
            <span className="stat-icon">📈</span>
            <div><div className="stat-value">{stats.resolution_rate}%</div><div className="stat-label">Resolution Rate</div></div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-row">
        {pieData.length > 0 && (
          <div className="chart-card">
            <h3>Status Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={75} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {stats?.monthly?.length > 0 && (
          <div className="chart-card">
            <h3>Monthly Complaints</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text" placeholder="🔍 Search title, description, name…"
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className="filter-search"
        />
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {['Pending','Assigned','In Progress','Resolved','Rejected'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {['Road','Water','Electricity','Sanitation','Other'].map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.department_id} onChange={e => setFilters(f => ({ ...f, department_id: e.target.value }))}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status:'', category:'', department_id:'', search:'' })}>
          ✕ Clear
        </button>
      </div>

      {/* Complaints table */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Complaints ({total})</h3>
        </div>
        {tableLoading ? <LoadingSpinner text="Loading…" /> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#ID</th>
                  <th>Title</th>
                  <th>Citizen</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr><td colSpan={9} className="empty-row">No complaints found.</td></tr>
                ) : complaints.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td className="td-title">{c.title}</td>
                    <td>{c.citizen_name}<br /><small>{c.citizen_email}</small></td>
                    <td>{c.category || '—'}</td>
                    <td>{c.department_name || <span className="text-muted">Unassigned</span>}</td>
                    <td><span className={`badge ${BADGE[c.status] || 'badge-gray'}`}>{c.status}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[c.priority] || 'badge-gray'}`}>{c.priority}</span></td>
                    <td>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => openModal(c.id)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => fetchComplaints(page - 1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-ghost" disabled={page === totalPages} onClick={() => fetchComplaints(page + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Manage Modal */}
      {selectedId && selectedCmp && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box modal-box--lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complaint #{selectedId} — {selectedCmp.title}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* Modal tabs */}
            <div className="modal-tabs">
              {['details', 'update', 'timeline'].map(t => (
                <button key={t} className={`modal-tab ${modalTab === t ? 'active' : ''}`} onClick={() => setModalTab(t)}>
                  {t === 'details' ? '📄 Details' : t === 'update' ? '⚙️ Update' : '📅 Timeline'}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {actionMsg && <div className={`alert ${actionMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`}>{actionMsg}</div>}

              {modalTab === 'details' && (
                <div className="detail-grid">
                  <div className="detail-item"><span className="detail-label">Status</span>
                    <span className={`badge ${BADGE[selectedCmp.status]}`}>{selectedCmp.status}</span></div>
                  <div className="detail-item"><span className="detail-label">Priority</span>
                    <span className={`badge ${PRIORITY_BADGE[selectedCmp.priority]}`}>{selectedCmp.priority}</span></div>
                  <div className="detail-item"><span className="detail-label">Category</span><span>{selectedCmp.category}</span></div>
                  <div className="detail-item"><span className="detail-label">Department</span><span>{selectedCmp.department_name || 'Unassigned'}</span></div>
                  <div className="detail-item"><span className="detail-label">Citizen</span><span>{selectedCmp.citizen_name} ({selectedCmp.citizen_email})</span></div>
                  <div className="detail-item"><span className="detail-label">Location</span><span>{selectedCmp.location || '—'}</span></div>
                  <div className="detail-item detail-item--full"><span className="detail-label">Description</span><p>{selectedCmp.description}</p></div>
                  {selectedCmp.ai_summary && (
                    <div className="detail-item detail-item--full ai-box-small">
                      <span className="detail-label">🤖 AI Summary</span><p>{selectedCmp.ai_summary}</p>
                      {selectedCmp.ai_suggestion && <p className="ai-suggestion">💡 {selectedCmp.ai_suggestion}</p>}
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'update' && (
                <div className="update-section">
                  <h4>Update Status</h4>
                  <div className="form-row">
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                      {['Pending','Assigned','In Progress','Resolved','Rejected'].map(s =>
                        <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={updateStatus} disabled={actionLoading}>
                      {actionLoading ? '…' : 'Update Status'}
                    </button>
                  </div>
                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label>Comment (optional)</label>
                    <textarea rows={2} value={statusComment}
                      onChange={e => setStatusCmt(e.target.value)}
                      placeholder="Add a note about this status change…" />
                  </div>

                  <h4 style={{ marginTop: '1.5rem' }}>Assign Department</h4>
                  <div className="form-row">
                    <select value={assignDept} onChange={e => setAssignDept(e.target.value)}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                    </select>
                    <button className="btn btn-secondary" onClick={assignDepartment} disabled={actionLoading || !assignDept}>
                      {actionLoading ? '…' : 'Assign'}
                    </button>
                  </div>
                </div>
              )}

              {modalTab === 'timeline' && (
                <div className="timeline">
                  {timeline.length === 0 ? <p>No timeline entries yet.</p> : timeline.map((t, i) => (
                    <div key={t.id} className={`timeline-item ${i === timeline.length - 1 ? 'latest' : ''}`}>
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
