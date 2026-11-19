import { useState, useMemo } from 'react';
import { IconCalendar } from './icons';

export default function CurrentRoutine({ routine, user }) {
  const isTeacher = user && user.designation === 'Teacher';
  const isAdmin = user && user.designation === 'Admin';
  const isStudent = !isTeacher && !isAdmin;

  const userSection = (user && user.section ? user.section.trim().toUpperCase() : '');
  const userFaculty = (user && user.facultyCode ? user.facultyCode.trim().toUpperCase() : '');

  const [selectedDay, setSelectedDay] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

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

  // Strictly filter for student and teacher
  const filteredRoutine = useMemo(() => {
    return routine.filter(item => {
      // 1. Role enforcement: Students only see their section, Teachers only see their classes
      if (isStudent) {
        if (!userSection) return false;
        if (item.section.trim().toUpperCase() !== userSection) return false;
      } else if (isTeacher) {
        if (!userFaculty) return false;
        if (item.faculty.trim().toUpperCase() !== userFaculty) return false;
      }

      // 2. Day filter
      const matchesDay = selectedDay === 'All' || item.day.toLowerCase() === selectedDay.toLowerCase();

      // 3. Search query
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        item.section.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q) ||
        item.faculty.toLowerCase().includes(q) ||
        item.room.toLowerCase().includes(q);

      return matchesDay && matchesSearch;
    }).sort((a, b) => {
      const dayA = dayOrder[a.day.toLowerCase()] || 99;
      const dayB = dayOrder[b.day.toLowerCase()] || 99;
      if (dayA !== dayB) return dayA - dayB;
      return parseTimeSlotStart(a.time) - parseTimeSlotStart(b.time);
    });
  }, [routine, isStudent, isTeacher, userSection, userFaculty, selectedDay, searchQuery]);

  return (
    <div className="card-panel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isTeacher ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
            <IconCalendar />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {isStudent && (userSection ? `Section ${userSection} Schedule` : 'Class Schedule')}
              {isTeacher && (userFaculty ? `Faculty ${userFaculty} Schedule` : 'Teaching Schedule')}
              {isAdmin && 'Institution Master Routine'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isStudent && userSection && `Showing complete timetable for Section ${userSection}`}
              {isTeacher && userFaculty && `Showing assigned teaching schedule for Faculty ${userFaculty}`}
              {isAdmin && 'Full schedule browser with search and day filtering'}
            </p>
          </div>
        </div>

        {/* User Scope Chip */}
        <div>
          {isStudent && userSection && (
            <span className="user-chip" style={{ background: 'var(--primary)', color: 'white', fontWeight: 700 }}>
              Section {userSection}
            </span>
          )}
          {isTeacher && userFaculty && (
            <span className="user-chip" style={{ background: '#f59e0b', color: 'white', fontWeight: 700 }}>
              Faculty {userFaculty}
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Search Courses or Rooms
          </label>
          <input
            type="text"
            placeholder="Search by course code, room, etc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.9rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-soft)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Filter by Day
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.9rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-soft)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          >
            <option value="All">All Days</option>
            {days.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
      </div>

      {/* If Student has no section assigned */}
      {isStudent && !userSection && (
        <div className="empty-state" style={{ padding: '2.5rem' }}>
          <div className="empty-state-icon"><IconCalendar /></div>
          <h4>No section set</h4>
          <p>Please configure your section in your profile or on the dashboard to access your schedule.</p>
        </div>
      )}

      {/* If Teacher has no faculty code assigned */}
      {isTeacher && !userFaculty && (
        <div className="empty-state" style={{ padding: '2.5rem' }}>
          <div className="empty-state-icon"><IconCalendar /></div>
          <h4>No faculty code set</h4>
          <p>Please configure your faculty code in your profile or on the dashboard to view your schedule.</p>
        </div>
      )}

      {/* Whole routine in a single unified table */}
      {((isStudent && userSection) || (isTeacher && userFaculty) || isAdmin) && (
        <>
          {filteredRoutine.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <div className="empty-state-icon"><IconCalendar /></div>
              <h4>No classes found</h4>
              <p>No classes matched your filter criteria.</p>
            </div>
          ) : (
            <div className="routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Day</th>
                    <th style={{ width: '190px' }}>Time Slot</th>
                    <th>Course</th>
                    {isTeacher ? <th>Section</th> : <th>Faculty</th>}
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutine.map((entry, idx) => {
                    const prevDay = idx > 0 ? filteredRoutine[idx - 1].day : null;
                    const isNewDay = entry.day !== prevDay;

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderTop: isNewDay && idx > 0 ? '2px solid var(--border)' : undefined
                        }}
                      >
                        <td>
                          <span className="routine-day-badge" style={{ display: 'inline-block', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 700 }}>
                            {entry.day}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{entry.time}</strong>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {entry.course}
                          </code>
                        </td>
                        <td>
                          {isTeacher ? (
                            <span className="user-chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700 }}>
                              Section {entry.section}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {entry.faculty}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="routine-room-badge" style={{ fontSize: '0.85rem' }}>
                            Room {entry.room}
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
  );
}
