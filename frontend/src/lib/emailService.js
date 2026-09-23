import emailjs from '@emailjs/browser';

const SERVICE_ID   = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID  = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY   = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const COLLECTOR_EMAIL = import.meta.env.VITE_COLLECTOR_EMAIL || 'collector@civicconnect.com';

/**
 * Send complaint notification email to Collector/Authority
 */
export async function sendCollectorEmail({
  complaintId,
  title,
  description,
  category,
  priority,
  location,
  latitude,
  longitude,
  citizenName,
  citizenEmail,
  aiCategory,
  aiPriority,
  aiSummary,
  aiSuggestion,
  photoUrl,
}) {
  // Google Maps link if coordinates available
  const mapLink = (latitude && longitude)
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : (location || 'Not provided');

  const templateParams = {
    to_email:       COLLECTOR_EMAIL,
    complaint_id:   `#${complaintId}`,
    complaint_title: title,
    description:    description,
    category:       category || 'Other',
    priority:       priority || 'Medium',
    location:       location || 'Not specified',
    map_link:       mapLink,
    citizen_name:   citizenName || 'Citizen',
    citizen_email:  citizenEmail || 'N/A',
    ai_category:    aiCategory  || category || 'Other',
    ai_priority:    aiPriority  || priority || 'Medium',
    ai_summary:     aiSummary   || description?.slice(0, 100),
    ai_suggestion:  aiSuggestion || 'Contact relevant department.',
    photo_url:      photoUrl || 'No photo attached',
    submitted_at:   new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
  };

  try {
    const res = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('Collector email sent:', res.status);
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false; // Don't block complaint submission if email fails
  }
}
