import { useState, useMemo } from 'react';
import { roomDetails } from "./routine";
import { IconSearch, IconList, IconRoom, IconCalendar } from './icons';
import { bookingAPI, authAPI } from './api';
import Toast from './Toast';

export default function Dashboard({
  user,
  setUser,
  myBookings,
  setMyBookings,
  globalBookings,
  setGlobalBookings,
  setCurrentPage,
  routine
}) {
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

  // Day order & Time sorting helpers
  const dayOrder = {
    'saturday': 1,
    'sunday': 2,
    'monday': 3,
    'tuesday': 4,
    'wednesday': 5,
    'thursday': 6,
    'friday': 7
  };

  const parseTimeSlotStart = (timeStr) => {
    const m = (timeStr || '').match(/(\d{1,2})[\.:](\d{2})\s*([AaPp][Mm])?/);
    if (!m) return 0;
    let hour = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3] ? m[3].toUpperCase() : '';
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return hour * 60 + min;
  };

  // Filter routine strictly according to user's assigned section or faculty code
  const userRoutine = useMemo(() => {
    let filtered = [];
    if (isStudent) {
      if (!userSection) return [];
      filtered = routine.filter(r => r.section && r.section.trim().toUpperCase() === userSection);
    } else if (isTeacher) {
      if (!userFaculty) return [];
      filtered = routine.filter(r => r.faculty && r.faculty.trim().toUpperCase() === userFaculty);
    } else {
      // Admin: View selected section or faculty
      if (adminViewMode === 'section') {
        filtered = routine.filter(r => r.section && r.section.trim().toUpperCase() === adminSection.toUpperCase());
      } else {
        filtered = routine.filter(r => r.faculty && r.faculty.trim().toUpperCase() === adminFaculty.toUpperCase());
      }
    }

    // Sort whole routine in academic day and time order
    return [...filtered].sort((a, b) => {
      const dayA = dayOrder[a.day.toLowerCase()] || 99;
      const dayB = dayOrder[b.day.toLowerCase()] || 99;
      if (dayA !== dayB) return dayA - dayB;
      return parseTimeSlotStart(a.time) - parseTimeSlotStart(b.time);
    });
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
    const occupiedRooms = routine
      .filter(item => item.day === day && item.time === time)
      .map(item => item.room);

    const bookedRooms = (globalBookings || [])
      .filter(b => b.day === day && b.time === time)
      .map(b => b.room);

    const freeRooms = Object.keys(roomDetails).filter(roomName => {
      if (occupiedRooms.includes(roomName) || bookedRooms.includes(roomName)) return false;

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
      await bookingAPI.createBooking(newBooking).catch(err => {
        if (err.status === 409) {
          throw err;
        }
        console.warn('Booking API offline, proceeding with local update', err);
      });

      setMyBookings([...myBookings, newBooking]);
      setGlobalBookings([newBooking, ...globalBookings]);
      showToast(`${bookingRoom} booked successfully!`, 'success');
      setBookingRoom(null);
      setAvailableRooms(null);
      setCurrentPage && setCurrentPage('MyBookings');
    } catch (err) {
      showToast(err.message || `Failed to book ${bookingRoom}`, 'error');
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

      {/* Tabs */}
      <div className="tabs">
        <button className={tab === 'myRoutine' ? 'active' : ''} onClick={() => setTab('myRoutine')}>
          <span className="tab-icon"><IconCalendar /></span>
          {isStudent
            ? `My Routine${userSection ? ` (Sec ${userSection})` : ''}`
            : isTeacher
            ? `My Classes${userFaculty ? ` (${userFaculty})` : ''}`
            : 'Schedule Explorer'}
        </button>
        <button className={tab === 'checker' ? 'active' : ''} onClick={() => setTab('checker')}>
          <span className="tab-icon"><IconSearch /></span> Find Room
        </button>
        <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>
          <span className="tab-icon"><IconList /></span> Recent Bookings
        </button>
      </div>

      {/* TAB 1: Role-Tailored Single Unified Routine Table */}
      {tab === 'myRoutine' && (
        <div className="tailored-routine-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Card */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isTeacher ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
                  <IconCalendar />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                    {isStudent && (userSection ? `Class Routine — Section ${userSection}` : 'Class Routine')}
                    {isTeacher && (userFaculty ? `Assigned Teaching Schedule — Faculty ${userFaculty}` : 'Assigned Teaching Schedule')}
                    {isAdmin && `Schedule Explorer (${adminViewMode === 'section' ? `Section ${adminSection}` : `Faculty ${adminFaculty}`})`}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {isStudent && userSection && `Official timetable strictly for Section ${userSection}`}
                    {isTeacher && userFaculty && `All assigned lectures and time slots for Faculty code ${userFaculty}`}
                    {isAdmin && 'Administrative routine schedule inspector'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {isStudent && userSection && (
                  <span className="user-chip" style={{ background: 'var(--primary)', color: 'white', fontWeight: 700, padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    Section {userSection}
                  </span>
                )}
                {isTeacher && userFaculty && (
                  <span className="user-chip" style={{ background: '#f59e0b', color: 'white', fontWeight: 700, padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    Faculty {userFaculty}
                  </span>
                )}
                {/* Admin Selectors */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      value={adminViewMode}
                      onChange={(e) => setAdminViewMode(e.target.value)}
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}
                    >
                      <option value="section">Section</option>
                      <option value="faculty">Faculty</option>
                    </select>
                    {adminViewMode === 'section' ? (
                      <select
                        value={adminSection}
                        onChange={(e) => setAdminSection(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
                      >
                        {distinctSections.map(s => <option key={s} value={s}>Sec {s}</option>)}
                      </select>
                    ) : (
                      <select
                        value={adminFaculty}
                        onChange={(e) => setAdminFaculty(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
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
                    placeholder="e.g. 5B"
                    value={inputSection}
                    onChange={(e) => setInputSection(e.target.value.toUpperCase())}
                    style={{ flex: 1, padding: '0.5rem 0.75rem', textTransform: 'uppercase', fontWeight: 700 }}
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
                    placeholder="e.g. SDS"
                    value={inputFaculty}
                    onChange={(e) => setInputFaculty(e.target.value.toUpperCase())}
                    style={{ flex: 1, padding: '0.5rem 0.75rem', textTransform: 'uppercase', fontWeight: 700 }}
                    required
                  />
                  <button type="submit" className="primary-btn small-btn" disabled={isSavingPref}>
                    {isSavingPref ? 'Saving...' : 'Save Code'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Single Unified Routine Table (Whole routine in one table) */}
          <div className="card-panel">
            {((isStudent && userSection) || (isTeacher && userFaculty) || isAdmin) && (
              <>
                {userRoutine.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem' }}>
                    <div className="empty-state-icon"><IconCalendar /></div>
                    <h4>No classes scheduled</h4>
                    <p>
                      No classes are currently scheduled for {isStudent ? `Section ${userSection}` : isTeacher ? `Faculty ${userFaculty}` : 'this selection'}.
                    </p>
                  </div>
                ) : (
                  <div className="routine-table-wrapper">
                    <table className="routine-table">
                      <thead>
                        <tr>
                          <th style={{ width: '130px' }}>Day</th>
                          <th style={{ width: '190px' }}>Time Slot</th>
                          <th>Course Code</th>
                          {isTeacher ? <th>Section</th> : <th>Faculty</th>}
                          <th>Classroom</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userRoutine.map((item, idx) => {
                          // Check if day changed from previous row for visual grouping
                          const prevDay = idx > 0 ? userRoutine[idx - 1].day : null;
                          const isNewDay = item.day !== prevDay;

                          return (
                            <tr
                              key={idx}
                              style={{
                                borderTop: isNewDay && idx > 0 ? '2px solid var(--border)' : undefined
                              }}
                            >
                              <td>
                                <span
                                  className="routine-day-badge"
                                  style={{
                                    display: 'inline-block',
                                    fontSize: '0.8rem',
                                    padding: '0.2rem 0.6rem',
                                    fontWeight: 700
                                  }}
                                >
                                  {item.day}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.time}</strong>
                              </td>
                              <td>
                                <code style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                                  {item.course}
                                </code>
                              </td>
                              <td>
                                {isTeacher ? (
                                  <span className="user-chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700 }}>
                                    Section {item.section}
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {item.faculty}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className="routine-room-badge" style={{ fontSize: '0.85rem' }}>
                                  Room {item.room}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Room Availability Checker */}
      {tab === 'checker' && (
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
      )}

      {/* TAB 3: Recent Bookings */}
      {tab === 'others' && (
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
