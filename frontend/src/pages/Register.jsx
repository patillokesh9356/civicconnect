import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm]         = useState({ name: '', email: '', password: '', confirm: '', phone: '', address: '' });
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep]         = useState(1); // 2-step form

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const nextStep = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.password || form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register({
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        phone:    form.phone.trim() || null,
        address:  form.address.trim() || null,
      });
      setSuccess('Registration successful! Redirecting to login…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      // Show exact backend message if available
      const msg = err.response?.data?.message
        || (err.message === 'Network Error' ? 'Server शी connection होत नाही. Backend चालू आहे का?' : null)
        || `Registration failed (${err.response?.status || 'unknown error'})`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-hero">
          <span className="hero-icon">🏛️</span>
          <h1>CivicConnect</h1>
          <p>Join thousands of citizens making their city better.</p>
          <ul className="hero-features">
            <li>✅ Submit complaints easily</li>
            <li>📍 Track location on map</li>
            <li>🔔 Real-time notifications</li>
            <li>📊 View resolution progress</li>
          </ul>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Create Account</h2>
            <p>Step {step} of 2 — {step === 1 ? 'Basic Info' : 'Contact Details'}</p>
          </div>

          {/* Progress bar */}
          <div className="step-bar">
            <div className="step-progress" style={{ width: step === 1 ? '50%' : '100%' }} />
          </div>

          {error   && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">🎉 {success}</div>}

          {step === 1 && (
            <form onSubmit={nextStep} className="auth-form">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input id="name" name="name" type="text" placeholder="Your full name"
                  value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input id="email" name="email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div className="input-with-icon">
                  <input id="password" name="password" type={showPass ? 'text' : 'password'}
                    placeholder="Min. 6 characters" value={form.password} onChange={handleChange} required />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="confirm">Confirm Password *</label>
                <input id="confirm" name="confirm" type="password" placeholder="Re-enter password"
                  value={form.confirm} onChange={handleChange} required />
              </div>
              <button type="submit" className="btn btn-primary btn-full">Next →</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="phone">Phone Number <span className="optional">(optional)</span></label>
                <input id="phone" name="phone" type="tel" placeholder="+91 XXXXX XXXXX"
                  value={form.phone} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label htmlFor="address">Address <span className="optional">(optional)</span></label>
                <textarea id="address" name="address" placeholder="Your city / area / pin code"
                  value={form.address} onChange={handleChange} rows={3} />
              </div>
              <div className="form-row">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? <><span className="spinner spinner-sm" /> Creating…</> : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
    <div className="auth-dev-credit">
      Designed &amp; Developed by <span>Lokesh Patil</span>
    </div>
    </div>
  );
}
