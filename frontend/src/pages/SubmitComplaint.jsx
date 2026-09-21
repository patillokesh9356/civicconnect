import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Road', 'Water', 'Electricity', 'Sanitation', 'Other'];

export default function SubmitComplaint() {
  const { API } = useAuth();
  const navigate = useNavigate();
  const mapRef   = useRef(null);
  const leafletRef = useRef(null);
  const markerRef  = useRef(null);

  const [form, setForm] = useState({
    title: '', description: '', category: '', location: '',
    latitude: null, longitude: null,
  });
  const [ai, setAi]             = useState(null);
  const [aiLoading, setAiLoad]  = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Init Leaflet map
  useEffect(() => {
    const initMap = async () => {
      if (mapRef.current && !leafletRef.current) {
        try {
          const L = (await import('leaflet')).default;
          await import('leaflet/dist/leaflet.css');

          // Fix default marker icons
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });

          const map = L.map(mapRef.current, {
            // Trackpad / touch gesture settings
            scrollWheelZoom:   true,   // mouse wheel = zoom
            touchZoom:         true,   // 2-finger pinch = zoom
            dragging:          true,   // 1-finger / click+drag = pan
            tap:               false,  // disable tap-to-click (prevents ghost clicks)
            tapTolerance:      15,
            bounceAtZoomLimits: false,
            // Trackpad 2-finger pan support
            trackResize: true,
          }).setView([19.0760, 72.8777], 12);

          // Trackpad: 2-finger swipe = pan (not zoom)
          // Override wheel behavior: only zoom on Ctrl+scroll or pinch
          map.on('load', () => {
            const container = map.getContainer();
            container.addEventListener('wheel', (e) => {
              // 2-finger trackpad scroll without Ctrl = pan the map
              if (!e.ctrlKey) {
                e.stopPropagation();
                map.panBy([e.deltaX, e.deltaY], { animate: false });
              }
              // With Ctrl = zoom (default Leaflet behavior)
            }, { passive: false });
          });

          // Fire load event manually
          map.fireEvent('load');
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
          }).addTo(map);

          map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (markerRef.current) markerRef.current.remove();
            markerRef.current = L.marker([lat, lng]).addTo(map)
              .bindPopup(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup();
            setForm(prev => ({
              ...prev,
              latitude: lat,
              longitude: lng,
              location: prev.location || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            }));
          });

          leafletRef.current = map;
          setMapReady(true);
        } catch (e) {
          console.error('Map init error', e);
        }
      }
    };
    initMap();
    return () => {
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }
    };
  }, []);

  // Get user location
  const getUserLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        if (leafletRef.current) {
          const L = (await import('leaflet')).default;
          leafletRef.current.setView([lat, lng], 15);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = L.marker([lat, lng]).addTo(leafletRef.current)
            .bindPopup('📍 Your location').openPopup();
        }
        setForm(prev => ({
          ...prev, latitude: lat, longitude: lng,
          location: prev.location || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        }));
      },
      () => alert('Could not get location.')
    );
  };

  // Debounced AI analyze
  const analyzeWithAI = async (title, description) => {
    if (!title && !description) { setAi(null); return; }
    setAiLoad(true);
    try {
      const res = await axios.post(`${API}/ai/analyze`, { title, description });
      setAi(res.data);
      if (!form.category) setForm(prev => ({ ...prev, category: res.data.category }));
    } catch { /* silent */ }
    finally { setAiLoad(false); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBlurAnalyze = () => {
    if (form.title.length > 5 || form.description.length > 10) {
      analyzeWithAI(form.title, form.description);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/complaints`, form);
      setSuccess(`✅ Complaint #${res.data.complaint_id} submitted successfully!`);
      setTimeout(() => navigate('/my-complaints'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyAI = () => {
    if (!ai) return;
    setForm(prev => ({ ...prev, category: ai.category }));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Submit Complaint 📝</h1>
          <p className="page-subtitle">Describe your civic issue and we'll route it to the right department</p>
        </div>
      </div>

      {error   && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="complaint-layout">
        {/* Form */}
        <div className="complaint-form-card">
          <form onSubmit={handleSubmit} className="complaint-form">
            <div className="form-group">
              <label htmlFor="title">Complaint Title *</label>
              <input
                id="title" name="title" type="text"
                placeholder="e.g. Large potholes on MG Road near HDFC Bank"
                value={form.title} onChange={handleChange}
                onBlur={handleBlurAnalyze} required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <textarea
                id="description" name="description" rows={5}
                placeholder="Describe the issue in detail. What happened? Since when? How serious is it?"
                value={form.description} onChange={handleChange}
                onBlur={handleBlurAnalyze} required
              />
            </div>

            {/* AI Suggestions */}
            {aiLoading && (
              <div className="ai-loading">
                <span className="spinner spinner-sm" /> Analyzing with AI…
              </div>
            )}
            {ai && !aiLoading && (
              <div className="ai-box">
                <div className="ai-box-header">
                  <span>🤖 AI Analysis</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={applyAI}>Apply</button>
                </div>
                <div className="ai-grid">
                  <div className="ai-item">
                    <span className="ai-label">Category</span>
                    <span className="ai-value badge-category">{ai.category}</span>
                  </div>
                  <div className="ai-item">
                    <span className="ai-label">Priority</span>
                    <span className={`ai-value badge-priority priority-${ai.priority?.toLowerCase()}`}>{ai.priority}</span>
                  </div>
                </div>
                <div className="ai-item">
                  <span className="ai-label">Summary</span>
                  <p className="ai-summary">{ai.summary}</p>
                </div>
                <div className="ai-suggestion">
                  💡 <strong>Suggestion:</strong> {ai.suggestion}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group form-group--half">
                <label htmlFor="category">Category</label>
                <select id="category" name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group form-group--half">
                <label htmlFor="location">Location Description</label>
                <input
                  id="location" name="location" type="text"
                  placeholder="Area, landmark, address…"
                  value={form.location} onChange={handleChange}
                />
              </div>
            </div>

            {form.latitude && form.longitude && (
              <div className="coords-badge">
                📍 Selected: {form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading
                ? <><span className="spinner spinner-sm" /> Submitting…</>
                : '📤 Submit Complaint'}
            </button>
          </form>
        </div>

        {/* Map */}
        <div className="map-card">
          <div className="map-card-header">
            <h3>📍 Select Location on Map</h3>
            <button type="button" className="btn btn-sm btn-ghost" onClick={getUserLocation}>
              🎯 Use My Location
            </button>
          </div>
          <div ref={mapRef} className="leaflet-container-custom" />
        </div>
      </div>
    </div>
  );
}
