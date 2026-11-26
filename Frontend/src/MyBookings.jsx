import { useState } from 'react';
import { IconCalendar, IconClock } from './icons';
import { bookingAPI } from './api';
import Toast from './Toast';

export default function MyBookings({ bookings, setMyBookings, setGlobalBookings }) {
  const [cancelId, setCancelId] = useState(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [toast, setToast] = useState(null);

  const cancelBooking = async (id) => {
    setIsCanceling(true);
    try {
      await bookingAPI.cancelBooking(id);
      setMyBookings(prev => prev.filter(b => b.id !== id));
      if (setGlobalBookings) {
        setGlobalBookings(prev => prev.filter(b => b.id !== id));
      }
      setToast({ message: 'Booking canceled successfully.', type: 'success', id: Date.now() });
      setCancelId(null);
    } catch (err) {
      setToast({ message: err.message || 'Failed to cancel booking.', type: 'error', id: Date.now() });
      setCancelId(null);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="card-panel">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div className="icon-tile icon-tile-warning" aria-hidden="true">
          <IconCalendar />
        </div>
        <div>
          <h3 style={{ margin: 0 }}>My Bookings</h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage your current reservations</p>
        </div>
      </div>
      {bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true"><IconCalendar /></div>
          <h4>No bookings yet</h4>
          <p>Go to Find Room on the Dashboard to reserve an available classroom.</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map(b => (
            <div key={b.id} className="booking-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                  <div className="booking-icon" aria-hidden="true">
                    <IconCalendar />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 700 }}>Room {b.room}</h4>
                      <span className="booking-status-badge">Upcoming</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="inline-meta-item">
                        <IconCalendar /> {b.day}
                      </span>
                      <span className="inline-meta-item tabular-nums">
                        <IconClock /> {b.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div className="sidebar-user-avatar" aria-hidden="true">
                    {(b.name || b.user).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{b.name}</p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.designation}</p>
                  </div>
                </div>
                <button type="button" className="cancel-btn small-btn" onClick={() => setCancelId(b.id)}>
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelId && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onClick={() => setCancelId(null)}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-warning-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 id="cancel-booking-title">Cancel Booking</h3>
            <p>Cancel this classroom reservation? This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setCancelId(null)} disabled={isCanceling}>Keep Booking</button>
              <button type="button" className="cancel-btn" onClick={() => cancelBooking(cancelId)} disabled={isCanceling}>
                {isCanceling ? 'Canceling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
