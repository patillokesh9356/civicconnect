import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || null;

  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [info, setInfo]       = useState(location.state?.message || '');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'department_officer') {
        navigate('/department', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      if (err.message === 'Network Error') {
        setError('Server is not reachable. Please check your connection.');
      } else {
        setError(err.response?.data?.message || `Login failed (${err.response?.status || err.message})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-hero">
          <span className="hero-icon">🏛️</span>
          <h1>CivicConnect</h1>
          <p>Your digital bridge between citizens and city administration.</p>
          <div className="hero-stats">
            <div className="hero-stat"><strong>5000+</strong><span>Complaints Resolved</span></div>
            <div className="hero-stat"><strong>4</strong><span>Departments</span></div>
            <div className="hero-stat"><strong>24/7</strong><span>Tracking</span></div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Welcome Back 👋</h2>
            <p>Sign in to continue</p>
          </div>

          {info  && <div className="alert alert-warning">ℹ️ {info}</div>}
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <><span className="spinner spinner-sm" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/register">Register here</Link>
          </p>

          <div className="demo-credentials">
            <p><strong>Demo Admin:</strong> admin@civicconnect.com / Admin@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
