import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Category → marker color
const CATEGORY_COLORS = {
  Road:        '#ef4444',  // red
  Water:       '#3b82f6',  // blue
  Electricity: '#f59e0b',  // yellow
  Sanitation:  '#10b981',  // green
  Other:       '#8b5cf6',  // purple
};

// Status → circle border color
const STATUS_COLORS = {
  Pending:       '#f59e0b',
  Assigned:      '#3b82f6',
  'In Progress': '#8b5cf6',
  Resolved:      '#10b981',
  Rejected:      '#ef4444',
};

export default function ComplaintsMap({ filterStatus = '', filterCategory = '' }) {
  const { API } = useAuth();
  const mapRef      = useRef(null);
  const leafletRef  = useRef(null);
  const markersRef  = useRef([]);

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState({});
  const [selectedPin, setSelectedPin] = useState(null);

  // Fetch all complaints with location
  useEffect(() => {
    const fetch = async () => {
      try {
        const params = { per_page: 500 };
        if (filterStatus)   params.status   = filterStatus;
        if (filterCategory) params.category = filterCategory;
        const res = await axios.get(`${API}/admin/complaints`, { params });
        const all = (res.data.complaints || []).filter(
          c => c.latitude && c.longitude
        );
        setComplaints(all);

        // Stats by category
        const s = {};
        all.forEach(c => {
          s[c.category] = (s[c.category] || 0) + 1;
        });
        setStats(s);
      } catch (e) {
        console.error('Map fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [API, filterStatus, filterCategory]);

  // Init map
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || leafletRef.current) return;
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        const map = L.map(mapRef.current, {
          scrollWheelZoom: true,
          dragging: true,
        }).setView([19.0760, 72.8777], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        leafletRef.current = map;
      } catch (e) {
        console.error('Map init error:', e);
      }
    };
    initMap();
    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  // Add markers when complaints load
  useEffect(() => {
    const addMarkers = async () => {
      if (!leafletRef.current || complaints.length === 0) return;
      const L = (await import('leaflet')).default;
      const map = leafletRef.current;

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      complaints.forEach(c => {
        const color  = CATEGORY_COLORS[c.category] || '#8b5cf6';
        const border = STATUS_COLORS[c.status]     || '#64748b';

        // Custom colored circle marker
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width: 28px; height: 28px;
              background: ${color};
              border: 3px solid ${border};
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize:   [28, 28],
          iconAnchor: [14, 28],
        });

        const marker = L.marker([c.latitude, c.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:200px;font-family:sans-serif">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px">
                #${c.id} — ${c.title}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                <span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px">
                  ${c.category || 'Other'}
                </span>
                <span style="background:${border};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px">
                  ${c.status}
                </span>
              </div>
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">
                📍 ${c.location || `${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)}`}
              </div>
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">
                👤 ${c.citizen_name || 'Citizen'}
              </div>
              <div style="font-size:12px;color:#64748b">
                🏢 ${c.department_name || 'Unassigned'}
              </div>
              ${c.image_url ? `
                <img src="${c.image_url}"
                  style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-top:8px;cursor:pointer"
                  onclick="window.open('${c.image_url}','_blank')"
                />
              ` : ''}
              <div style="font-size:11px;color:#94a3b8;margin-top:6px">
                ${new Date(c.created_at).toLocaleDateString('en-IN')}
              </div>
            </div>
          `, { maxWidth: 280 });

        markersRef.current.push(marker);
      });

      // Fit map to markers
      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    };

    addMarkers();
  }, [complaints]);

  return (
    <div className="admin-map-section">
      {/* Legend + Stats */}
      <div className="map-legend-bar">
        <div className="map-legend-title">📍 Complaint Locations</div>
        <div className="map-legend-items">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span>{cat}</span>
              {stats[cat] && <span className="legend-count">({stats[cat]})</span>}
            </div>
          ))}
        </div>
        <div className="map-total-badge">
          Total on map: <strong>{complaints.length}</strong>
        </div>
      </div>

      {loading ? (
        <div className="map-loading">
          <div className="spinner" />
          <p>Loading complaint locations…</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="map-empty">
          <span>📭</span>
          <p>No complaints with location data found.</p>
          <small>Complaints submitted with map pin will appear here.</small>
        </div>
      ) : (
        <div ref={mapRef} className="admin-map-container" />
      )}

      {/* Status legend */}
      <div className="map-status-legend">
        <span className="legend-title">Border = Status:</span>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="legend-item">
            <span className="legend-ring" style={{ borderColor: color }} />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
