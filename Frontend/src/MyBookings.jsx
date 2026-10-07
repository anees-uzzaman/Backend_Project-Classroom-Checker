import { useState } from 'react';
import { IconCalendar } from './icons';

export default function MyBookings({ bookings, setMyBookings, setGlobalBookings }) {
  const [cancelId, setCancelId] = useState(null);

  const cancelBooking = (id) => {
    setMyBookings(bookings.filter(b => b.id !== id));
    if (setGlobalBookings) {
      setGlobalBookings((prev) => prev.filter((b) => b.id !== id));
    }
    setCancelId(null);
  };

  return (
    <div className="card-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <IconCalendar />
        </div>
        <div>
          <h3 style={{ margin: 0 }}>My Bookings</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage your current reservations</p>
        </div>
      </div>
      {bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconCalendar /></div>
          <h4>No bookings yet</h4>
          <p>Head to the dashboard to find and book available rooms.</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map(b => (
            <div key={b.id} className="booking-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: 0 }}>
                  <div className="booking-icon">
                    <IconCalendar />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 700, letterSpacing: '-0.01em' }}>Room {b.room}</h4>
                      <span className="booking-status-badge">Upcoming</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <span style={{ fontSize: '0.9rem' }}>📅</span> {b.day}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        <span style={{ fontSize: '0.9rem' }}>🕐</span> {b.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                    {(b.name || b.user).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{b.name}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.designation}</p>
                  </div>
                </div>
                <button className="cancel-btn small-btn" onClick={() => setCancelId(b.id)}>
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelId && (
        <div className="modal-overlay" onClick={() => setCancelId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-warning-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>Cancel Booking</h3>
            <p>Are you sure you want to cancel this booking? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setCancelId(null)}>Keep Booking</button>
              <button className="cancel-btn" onClick={() => cancelBooking(cancelId)}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}