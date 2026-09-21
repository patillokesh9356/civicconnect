import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <span className="brand-icon">🏛️</span>
          <span className="brand-text">CivicConnect</span>
          <p className="footer-tagline">Your voice, your city.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h5>Citizens</h5>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
            <Link to="/complaints/new">Submit Complaint</Link>
            <Link to="/my-complaints">Track Complaints</Link>
          </div>
          <div className="footer-col">
            <h5>Departments</h5>
            <p>🛣️ Road Department</p>
            <p>💧 Water Department</p>
            <p>⚡ Electricity Department</p>
            <p>🗑️ Sanitation Department</p>
          </div>
          <div className="footer-col">
            <h5>Contact</h5>
            <p>📧 support@civicconnect.com</p>
            <p>📞 1800-XXX-XXXX (Toll Free)</p>
            <p>🕐 Mon–Sat, 9AM–6PM</p>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} CivicConnect. Built for better governance.</p>
        <p className="footer-dev">
          Designed &amp; Developed by <span className="dev-name">Lokesh Patil</span>
        </p>
      </div>
    </footer>
  );
}
