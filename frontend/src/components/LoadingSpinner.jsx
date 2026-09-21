export default function LoadingSpinner({ text = 'Loading…', fullPage = false }) {
  if (fullPage) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>{text}</p>
      </div>
    );
  }
  return (
    <div className="loading-inline">
      <div className="spinner spinner-sm" />
      <span>{text}</span>
    </div>
  );
}
