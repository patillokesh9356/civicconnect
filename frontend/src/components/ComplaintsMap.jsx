import { useEffect, useRef, useState } from 'react';

const CATEGORY_COLORS = {
  Road:        '#ef4444',
  Water:       '#3b82f6',
  Electricity: '#f59e0b',
  Sanitation:  '#10b981',
  Other:       '#8b5cf6',
};

const STATUS_COLORS = {
  Pending:       '#f59e0b',
  Assigned:      '#3b82f6',
  'In Progress': '#8b5cf6',
  Resolved:      '#10b981',
  Rejected:      '#ef4444',
};

export default function ComplaintsMap({ complaints = [] }) {
  const mapRef     = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);

  const withLocation = complaints.filter(c => c.latitude && c.longitude);

  // Category stats
  const catStats = {};
  withLocation.forEach(c => {
    catStats[c.category || 'Other'] = (catStats[c.category || 'Other'] || 0) + 1;
  });

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
          zoomControl: true,
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

  // Add/update markers
  useEffect(() => {
    const addMarkers = async () => {
      if (!leafletRef.current) return;
      const L   = (await import('leaflet')).default;
      const map = leafletRef.current;

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      if (withLocation.length === 0) return;

      withLocation.forEach(c => {
        const color  = CATEGORY_COLORS[c.category] || '#8b5cf6';
        const border = STATUS_COLORS[c.status]     || '#64748b';

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:26px;height:26px;
            background:${color};
            border:3px solid ${border};
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 2px 8px rgba(0,0,0,.35);
          "></div>`,
          iconSize:   [26, 26],
          iconAnchor: [13, 26],
        });

        const photoHtml = c.image_url
          ? `<img src="${c.image_url}"
               style="width:100%;max-height:110px;object-fit:cover;
                      border-radius:6px;margin-top:8px;cursor:pointer"
               onclick="window.open('${c.image_url}','_blank')" />`
          : '';

        const popup = `
          <div style="min-width:220px;font-family:system-ui,sans-serif;font-size:13px">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1e293b">
              #${c.id} — ${c.title}
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
              <span style="background:${color};color:#fff;padding:2px 8px;
                           border-radius:12px;font-size:11px;font-weight:600">
                ${c.category || 'Other'}
              </span>
              <span style="background:${border};color:#fff;padding:2px 8px;
                           border-radius:12px;font-size:11px;font-weight:600">
                ${c.status}
              </span>
              <span style="background:#f1f5f9;color:#475569;padding:2px 8px;
                           border-radius:12px;font-size:11px">
                ${c.priority || 'Medium'}
              </span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <tr>
                <td style="color:#64748b;padding:2px 0;width:80px">👤 Citizen</td>
                <td style="color:#1e293b;font-weight:500">${c.citizen_name || '—'}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:2px 0">📍 Location</td>
                <td style="color:#1e293b">${c.location || `${parseFloat(c.latitude).toFixed(4)}, ${parseFloat(c.longitude).toFixed(4)}`}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:2px 0">🏢 Dept</td>
                <td style="color:#1e293b">${c.department_name || 'Unassigned'}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:2px 0">📅 Date</td>
                <td style="color:#1e293b">${new Date(c.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            </table>
            ${c.description ? `
              <div style="margin-top:8px;padding:6px 8px;background:#f8fafc;
                          border-radius:6px;font-size:11px;color:#475569;
                          max-height:60px;overflow:hidden">
                ${c.description.slice(0, 120)}${c.description.length > 120 ? '…' : ''}
              </div>` : ''}
            ${photoHtml}
            ${c.latitude && c.longitude ? `
              <a href="https://www.google.com/maps?q=${c.latitude},${c.longitude}"
                 target="_blank"
                 style="display:inline-block;margin-top:8px;font-size:11px;
                        color:#3b82f6;text-decoration:none">
                🗺️ View on Google Maps
              </a>` : ''}
          </div>`;

        const marker = L.marker([c.latitude, c.longitude], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 300 });

        markersRef.current.push(marker);
      });

      // Fit bounds to all markers
      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.15));
      }
    };

    addMarkers();
  }, [complaints]);

  return (
    <div className="admin-map-section">
      {/* Stats bar */}
      <div className="map-legend-bar">
        <div className="map-legend-left">
          <span className="map-legend-title">🗺️ Complaint Map</span>
          <span className="map-total-badge">
            {withLocation.length} / {complaints.length} complaints have location
          </span>
        </div>
        <div className="map-legend-items">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <div key={cat} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span>{cat}</span>
              {catStats[cat] && <span className="legend-count">{catStats[cat]}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      {withLocation.length === 0 ? (
        <div className="map-empty">
          <span style={{ fontSize: '2.5rem' }}>📭</span>
          <p>No complaints with location data yet.</p>
          <small>Complaints submitted with map pin will appear here.</small>
        </div>
      ) : (
        <div ref={mapRef} className="admin-map-container" />
      )}

      {/* Status legend */}
      <div className="map-status-legend">
        <span className="legend-title">Border color = Status:</span>
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
