import { useState } from 'react';
import { roomDetails } from "./routine";
import { IconSearch, IconList, IconRoom, IconCalendar } from './icons';
import Toast from './Toast';

export default function Dashboard({ user, myBookings, setMyBookings, globalBookings, setGlobalBookings, setCurrentPage, routine }) {
  const [tab, setTab] = useState('checker');

  const [day, setDay] = useState('Saturday');
  const [time, setTime] = useState('8.30 AM - 9.50 AM');
  const [capacity, setCapacity] = useState(30);
  const [needsAC, setNeedsAC] = useState(false);
  const [needsProjector, setNeedsProjector] = useState(false);
  const [isLab, setIsLab] = useState(false);

  const [availableRooms, setAvailableRooms] = useState(null);
  const [toast, setToast] = useState(null);
  const [bookingRoom, setBookingRoom] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  const handleSearch = () => {
    const occupiedRooms = routine
      .filter(item => item.day === day && item.time === time)
      .map(item => item.room);

    const freeRooms = Object.keys(roomDetails).filter(roomName => {
      if (occupiedRooms.includes(roomName)) return false;

      const details = roomDetails[roomName];
      if (details.capacity < capacity) return false;
      if (needsAC && !details.ac) return false;
      if (needsProjector && !details.projector) return false;
      if (isLab && !details.lab) return false;

      return true;
    });

    setAvailableRooms(freeRooms);
    if (freeRooms.length === 0) {
      showToast('No rooms match your criteria. Try adjusting filters.', 'info');
    }
  };

  const confirmBooking = (roomName) => {
    setBookingRoom(roomName);
  };

  const handleBookingConfirm = () => {
    if (!bookingRoom) return;

    const bookingId = `${bookingRoom}-${day}-${time}-${user.username}-${myBookings.length}`;
    const newBooking = { room: bookingRoom, day, time, user: user.username, name: user.name || user.username, designation: user.designation, id: bookingId };
    setMyBookings([...myBookings, newBooking]);
    setGlobalBookings([...globalBookings, newBooking]);
    showToast(`${bookingRoom} booked successfully!`, 'success');
    setBookingRoom(null);
    setAvailableRooms(null);
    setCurrentPage && setCurrentPage('MyBookings');
  };

  const getRoomFeatures = (roomName) => {
    const details = roomDetails[roomName];
    if (!details) return [];
    const features = [];
    if (details.ac) features.push('AC');
    if (details.projector) features.push('Projector');
    if (details.lab) features.push('Lab');
    return features;
  };

  return (
    <div className="dashboard-container">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {bookingRoom && (
        <div className="modal-overlay" onClick={() => setBookingRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏫</div>
            <h3>Confirm Booking</h3>
            <p>Are you sure you want to book <strong>{bookingRoom}</strong> on <strong>{day}</strong> at <strong>{time}</strong>?</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setBookingRoom(null)}>Cancel</button>
              <button className="primary-btn" onClick={handleBookingConfirm}>Confirm Booking</button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'checker' ? 'active' : ''} onClick={() => setTab('checker')}>
          <span className="tab-icon"><IconSearch /></span> Find Room
        </button>
        <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>
          <span className="tab-icon"><IconList /></span> Recent Bookings
        </button>
      </div>

      {tab === 'checker' ? (
        <div className="checker-panel" key="checker">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
              <IconSearch />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Room Availability Checker</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Search for available rooms based on your requirements</p>
            </div>
          </div>
          
          <div className="filter-grid">
            <div className="form-group">
              <label htmlFor="day">Day</label>
              <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
                <option>Saturday</option>
                <option>Sunday</option>
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="time">Time Slot</label>
              <select id="time" value={time} onChange={(e) => setTime(e.target.value)}>
                <option>8.30 AM - 9.50 AM</option>
                <option>10.00 AM - 11.20 AM</option>
                <option>11.30 AM - 12.50 PM</option>
                <option>1.00 PM - 2.20 PM</option>
                <option>2.30 PM - 3.50 PM</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="capacity">Min Capacity</label>
              <input
                id="capacity"
                type="number"
                placeholder="Min Capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="1"
              />
            </div>

            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={needsAC} onChange={() => setNeedsAC(!needsAC)} /> Has AC</label>
              <label><input type="checkbox" checked={needsProjector} onChange={() => setNeedsProjector(!needsProjector)} /> Projector</label>
              <label><input type="checkbox" checked={isLab} onChange={() => setIsLab(!isLab)} /> Lab Required</label>
            </div>
          </div>

          <button onClick={handleSearch} className="primary-btn" style={{ width: '100%', justifyContent: 'center' }}>
            <span className="btn-icon"><IconSearch /></span> Check Availability
          </button>

          {availableRooms && (
            <div className="results-panel">
              <h4>Available Rooms ({availableRooms.length})</h4>
              {availableRooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <h4>No rooms found</h4>
                  <p>Try adjusting your filters or selecting a different time slot.</p>
                </div>
              ) : (
                <div className="room-list">
                  {availableRooms.map(room => (
                    <div key={room} className="room-card">
                      <div className="room-info">
                        <div className="room-icon"><IconRoom /></div>
                        <div className="room-details">
                          <h4>Room {room}</h4>
                          <p>Capacity: {roomDetails[room]?.capacity || 'N/A'}</p>
                          <div className="room-features">
                            {getRoomFeatures(room).map(f => (
                              <span key={f} className="room-feature-tag">{f}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => confirmBooking(room)} className="primary-btn small-btn">
                        Book Room
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setAvailableRooms(null)} className="secondary-btn" style={{ marginTop: '1.25rem', width: '100%' }}>
                Start Over
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="global-bookings-panel" key="others">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
              <IconCalendar />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Recent Bookings</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>See all recent room bookings</p>
            </div>
          </div>
          {globalBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><IconCalendar /></div>
              <h4>No bookings yet</h4>
              <p>Be the first to book a room!</p>
            </div>
          ) : (
            <div className="booking-list">
              {globalBookings.map((b, i) => {
                const isCurrentUser = b.user === user.username;
                return (
                  <div key={i} className={`booking-item ${isCurrentUser ? 'booking-item-mine' : ''}`}>
                    <div className="booking-info">
                      <div className="booking-icon"><IconCalendar /></div>
                      <div className="booking-details">
                        <h4>{b.name} ({b.designation}) booked Room {b.room}</h4>
                        <p>{b.day} • {b.time}</p>
                      </div>
                    </div>
                    {isCurrentUser && <span className="booking-you-badge">You</span>}
                  </div>
                );
              })}
              {globalBookings.filter(b => b.user !== user.username).length === 0 && globalBookings.length > 0 && (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>You haven't booked any rooms yet. Check back later for other users' bookings!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}