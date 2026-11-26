import { useState, useMemo } from 'react';
import { roomDetails as defaultRoomDetails } from "./routine";
import { IconSearch, IconList, IconRoom, IconCalendar } from './icons';
import { bookingAPI, authAPI } from './api';
import {
  ACADEMIC_DAYS,
  TIME_SLOTS,
  matchesStudentSection,
  sortRoutineEntries,
  normalizeRoomKey
} from './routineParser';
import Toast from './Toast';
import DayRoutineGrid from './DayRoutineGrid';

export default function Dashboard({
  user,
  setUser,
  myBookings,
  setMyBookings,
  globalBookings,
  setGlobalBookings,
  setCurrentPage,
  routine,
  roomDetails: propRoomDetails
}) {
  const roomDetails = propRoomDetails && Object.keys(propRoomDetails).length > 0
    ? propRoomDetails
    : defaultRoomDetails;

  const isTeacher = user && user.designation === 'Teacher';
  const isAdmin = user && user.designation === 'Admin';
  const isStudent = !isTeacher && !isAdmin;

  // Primary view tab
  const [tab, setTab] = useState('myRoutine');

  // Input states if student/teacher hasn't set their section/code yet
  const [inputSection, setInputSection] = useState('');
  const [inputFaculty, setInputFaculty] = useState('');
  const [isSavingPref, setIsSavingPref] = useState(false);

  // Admin filter states (Only admins can switch sections or faculties)
  const [adminSection, setAdminSection] = useState('5B');
  const [adminFaculty, setAdminFaculty] = useState('SDS');
  const [adminViewMode, setAdminViewMode] = useState('section'); // 'section' | 'faculty'

  // Room Checker state
  const [day, setDay] = useState('Saturday');
  const [time, setTime] = useState('8.30 AM - 9.50 AM');
  const [capacity, setCapacity] = useState(30);
  const [needsAC, setNeedsAC] = useState(false);
  const [needsProjector, setNeedsProjector] = useState(false);
  const [isLab, setIsLab] = useState(false);

  const [availableRooms, setAvailableRooms] = useState(null);
  const [toast, setToast] = useState(null);
  const [bookingRoom, setBookingRoom] = useState(null);

  const userSection = (user && user.section ? user.section.trim().toUpperCase() : '');
  const userFaculty = (user && user.facultyCode ? user.facultyCode.trim().toUpperCase() : '');

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  // Filter routine strictly according to user's assigned section or faculty code
  const userRoutine = useMemo(() => {
    let filtered = [];
    if (isStudent) {
      if (!userSection) return [];
      filtered = routine.filter(r => matchesStudentSection(r.section, userSection));
    } else if (isTeacher) {
      if (!userFaculty) return [];
      filtered = routine.filter(r => r.faculty && r.faculty.trim().toUpperCase() === userFaculty);
    } else {
      // Admin: View selected section or faculty
      if (adminViewMode === 'section') {
        filtered = routine.filter(r => matchesStudentSection(r.section, adminSection));
      } else {
        filtered = routine.filter(r => r.faculty && r.faculty.trim().toUpperCase() === adminFaculty.toUpperCase());
      }
    }

    return sortRoutineEntries(filtered);
  }, [routine, isStudent, isTeacher, userSection, userFaculty, adminSection, adminFaculty, adminViewMode]);

  // Admin distinct lists
  const distinctSections = useMemo(() => {
    return Array.from(new Set(routine.map(r => r.section).filter(Boolean))).sort();
  }, [routine]);

  const distinctFaculties = useMemo(() => {
    return Array.from(new Set(routine.map(r => r.faculty).filter(Boolean))).sort();
  }, [routine]);

  // Handle first-time section assignment for student
  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!inputSection.trim()) return;
    setIsSavingPref(true);
    try {
      const res = await authAPI.updateProfile({ section: inputSection.trim().toUpperCase() });
      if (res && res.user && setUser) {
        setUser(res.user);
      }
      showToast(`Section ${inputSection.trim().toUpperCase()} set successfully!`, 'success');
      setInputSection('');
    } catch (err) {
      showToast(err.message || 'Failed to save section', 'error');
    } finally {
      setIsSavingPref(false);
    }
  };

  // Handle first-time faculty code assignment for teacher
  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    if (!inputFaculty.trim()) return;
    setIsSavingPref(true);
    try {
      const res = await authAPI.updateProfile({ facultyCode: inputFaculty.trim().toUpperCase() });
      if (res && res.user && setUser) {
        setUser(res.user);
      }
      showToast(`Faculty code ${inputFaculty.trim().toUpperCase()} set successfully!`, 'success');
      setInputFaculty('');
    } catch (err) {
      showToast(err.message || 'Failed to save faculty code', 'error');
    } finally {
      setIsSavingPref(false);
    }
  };

  // Room checker handlers
  const handleSearch = () => {
    const occupiedKeys = new Set(
      routine
        .filter(item => item.day === day && item.time === time)
        .map(item => normalizeRoomKey(item.room))
    );

    const bookedKeys = new Set(
      (globalBookings || [])
        .filter(b => b.day === day && b.time === time)
        .map(b => normalizeRoomKey(b.room))
    );

    const minCap = Number(capacity) || 1;

    const freeRooms = Object.keys(roomDetails).filter(roomName => {
      if (/^(online|tba)$/i.test(roomName.trim())) return false;
      const key = normalizeRoomKey(roomName);
      if (occupiedKeys.has(key) || bookedKeys.has(key)) return false;

      const details = roomDetails[roomName];
      if (!details) return false;
      if (details.capacity < minCap) return false;
      if (needsAC && !details.ac) return false;
      if (needsProjector && !details.projector) return false;
      if (isLab && !details.lab) return false;

      return true;
    }).sort();

    setAvailableRooms(freeRooms);
    if (freeRooms.length === 0) {
      showToast('No rooms match your criteria. Try adjusting filters.', 'info');
    }
  };

  const confirmBooking = (roomName) => {
    setBookingRoom(roomName);
  };

  const handleBookingConfirm = async () => {
    if (!bookingRoom) return;

    const bookingId = `${bookingRoom}-${day}-${time}-${user.username}-${Date.now()}`;
    const newBooking = {
      room: bookingRoom,
      day,
      time,
      user: user.username,
      name: user.name || user.username,
      designation: user.designation,
      id: bookingId
    };

    try {
      const res = await bookingAPI.createBooking(newBooking);
      const savedBooking = (res && res.booking) ? res.booking : newBooking;

      setMyBookings(prev => [savedBooking, ...prev]);
      setGlobalBookings(prev => [savedBooking, ...prev]);
      showToast(`Room ${bookingRoom} booked successfully!`, 'success');
      setBookingRoom(null);
      setAvailableRooms(null);
      setCurrentPage && setCurrentPage('MyBookings');
    } catch (err) {
      showToast(err.message || `Failed to book Room ${bookingRoom}`, 'error');
      setBookingRoom(null);
    }
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
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          onClick={() => setBookingRoom(null)}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-primary-icon" aria-hidden="true">
              <IconRoom />
            </div>
            <h3 id="booking-modal-title">Confirm Booking</h3>
            <p>Book <strong>Room {bookingRoom}</strong> on <strong>{day}</strong> at <strong>{time}</strong>?</p>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setBookingRoom(null)}>Cancel</button>
              <button type="button" className="primary-btn" onClick={handleBookingConfirm}>Confirm Booking</button>
            </div>
          </div>
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="tabs" role="tablist" aria-label="Dashboard sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'myRoutine'}
          className={tab === 'myRoutine' ? 'active' : ''}
          onClick={() => setTab('myRoutine')}
        >
          <span className="tab-icon" aria-hidden="true"><IconCalendar /></span>
          {isStudent
            ? `My Routine${userSection ? ` (Sec ${userSection})` : ''}`
            : isTeacher
            ? `My Classes${userFaculty ? ` (${userFaculty})` : ''}`
            : 'Schedule Explorer'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'checker'}
          className={tab === 'checker' ? 'active' : ''}
          onClick={() => setTab('checker')}
        >
          <span className="tab-icon" aria-hidden="true"><IconSearch /></span> Find Room
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'others'}
          className={tab === 'others' ? 'active' : ''}
          onClick={() => setTab('others')}
        >
          <span className="tab-icon" aria-hidden="true"><IconList /></span> Recent Bookings
        </button>
      </div>

      {/* TAB 1: Role-Tailored Per-Day Routine */}
      {tab === 'myRoutine' && (
        <div className="tailored-routine-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Card */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div className={`icon-tile ${isTeacher ? 'icon-tile-warning' : ''}`} aria-hidden="true">
                  <IconCalendar />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    {isStudent && (userSection ? `Class Routine — Section ${userSection}` : 'Class Routine')}
                    {isTeacher && (userFaculty ? `Teaching Schedule — Faculty ${userFaculty}` : 'Teaching Schedule')}
                    {isAdmin && `Schedule Explorer (${adminViewMode === 'section' ? `Section ${adminSection}` : `Faculty ${adminFaculty}`})`}
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {isStudent && userSection && `Daily timetable for Section ${userSection}`}
                    {isTeacher && userFaculty && `Assigned classes and rooms for ${userFaculty}`}
                    {isAdmin && 'Inspect schedules by section or faculty'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {isStudent && userSection && (
                  <span className="user-chip badge-solid-primary" style={{ padding: '0.38rem 0.85rem', fontSize: '0.82rem' }}>
                    Section {userSection}
                  </span>
                )}
                {isTeacher && userFaculty && (
                  <span className="user-chip badge-warning" style={{ padding: '0.38rem 0.85rem', fontSize: '0.82rem' }}>
                    Faculty {userFaculty}
                  </span>
                )}
                {/* Admin Selectors */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="styled-input"
                      aria-label="Schedule filter mode"
                      value={adminViewMode}
                      onChange={(e) => setAdminViewMode(e.target.value)}
                      style={{ width: 'auto', minHeight: '38px', fontSize: '0.85rem' }}
                    >
                      <option value="section">Section</option>
                      <option value="faculty">Faculty</option>
                    </select>
                    {adminViewMode === 'section' ? (
                      <select
                        className="styled-input"
                        aria-label="Select section"
                        value={adminSection}
                        onChange={(e) => setAdminSection(e.target.value)}
                        style={{ width: 'auto', minHeight: '38px', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        {distinctSections.map(s => <option key={s} value={s}>Sec {s}</option>)}
                      </select>
                    ) : (
                      <select
                        className="styled-input"
                        aria-label="Select faculty"
                        value={adminFaculty}
                        onChange={(e) => setAdminFaculty(e.target.value)}
                        style={{ width: 'auto', minHeight: '38px', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        {distinctFaculties.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* If Student has no section configured yet */}
            {isStudent && !userSection && (
              <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Set Your Section
                </h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Enter your assigned section (e.g. <strong>5B</strong> or <strong>6A</strong>) to load your routine:
                </p>
                <form onSubmit={handleSaveSection} style={{ display: 'flex', gap: '0.75rem', maxWidth: '360px' }}>
                  <input
                    type="text"
                    className="styled-input"
                    placeholder="e.g. 5B"
                    value={inputSection}
                    onChange={(e) => setInputSection(e.target.value.toUpperCase())}
                    style={{ flex: 1, textTransform: 'uppercase', fontWeight: 700 }}
                    required
                  />
                  <button type="submit" className="primary-btn small-btn" disabled={isSavingPref}>
                    {isSavingPref ? 'Saving...' : 'Save Section'}
                  </button>
                </form>
              </div>
            )}

            {/* If Teacher has no faculty code configured yet */}
            {isTeacher && !userFaculty && (
              <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Set Your Faculty Code
                </h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Enter your teacher code / initials (e.g. <strong>SDS</strong> or <strong>ABM</strong>) to view your assigned classes:
                </p>
                <form onSubmit={handleSaveFaculty} style={{ display: 'flex', gap: '0.75rem', maxWidth: '360px' }}>
                  <input
                    type="text"
                    className="styled-input"
                    placeholder="e.g. SDS"
                    value={inputFaculty}
                    onChange={(e) => setInputFaculty(e.target.value.toUpperCase())}
                    style={{ flex: 1, textTransform: 'uppercase', fontWeight: 700 }}
                    required
                  />
                  <button type="submit" className="primary-btn small-btn" disabled={isSavingPref}>
                    {isSavingPref ? 'Saving...' : 'Save Code'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Per-Day Horizontal Routine Grid (Every day rendered in one go) */}
          {((isStudent && userSection) || (isTeacher && userFaculty) || isAdmin) && (
            <>
              {userRoutine.length === 0 ? (
                <div className="card-panel">
                  <div className="empty-state" style={{ padding: '2.5rem' }}>
                    <div className="empty-state-icon"><IconCalendar /></div>
                    <h4>No classes scheduled</h4>
                    <p>
                      No classes are currently scheduled for {isStudent ? `Section ${userSection}` : isTeacher ? `Faculty ${userFaculty}` : 'this selection'}.
                    </p>
                  </div>
                </div>
              ) : (
                <DayRoutineGrid
                  entries={userRoutine}
                  isTeacher={isTeacher}
                  isAdmin={isAdmin}
                  days={ACADEMIC_DAYS}
                  showOffDays={true}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Room Availability Checker */}
      {tab === 'checker' && (
        <div className="checker-panel" key="checker">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div className="icon-tile" aria-hidden="true">
              <IconSearch />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Room Availability Checker</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Search for open classrooms matching your requirements</p>
            </div>
          </div>
          
          <div className="filter-grid">
            <div className="form-group">
              <label htmlFor="day">Day</label>
              <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
                {ACADEMIC_DAYS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="time">Time Slot</label>
              <select id="time" value={time} onChange={(e) => setTime(e.target.value)}>
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
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
      )}

      {/* TAB 3: Recent Bookings */}
      {tab === 'others' && (
        <div className="global-bookings-panel" key="others">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div className="icon-tile icon-tile-warning" aria-hidden="true">
              <IconCalendar />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Recent Bookings</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recent room reservations across campus</p>
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
                  <p>No bookings from other users yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
