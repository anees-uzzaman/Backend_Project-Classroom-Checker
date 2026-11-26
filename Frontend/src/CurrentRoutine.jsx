import { useState, useMemo } from 'react';
import { IconCalendar } from './icons';
import { ACADEMIC_DAYS, matchesStudentSection, sortRoutineEntries } from './routineParser';
import { routineAPI } from './api';
import Toast from './Toast';
import DayRoutineGrid from './DayRoutineGrid';

export default function CurrentRoutine({ routine, setRoutine, user }) {
  const isTeacher = user && user.designation === 'Teacher';
  const isAdmin = user && user.designation === 'Admin';
  const isStudent = !isTeacher && !isAdmin;

  const userSection = (user && user.section ? user.section.trim().toUpperCase() : '');
  const userFaculty = (user && user.facultyCode ? user.facultyCode.trim().toUpperCase() : '');

  const [selectedDay, setSelectedDay] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  const days = ACADEMIC_DAYS;

  const handleDeleteEntry = async (entry) => {
    if (!entry._id) return;
    try {
      await routineAPI.deleteRoutineEntry(entry._id);
      if (setRoutine) {
        setRoutine(prev => prev.filter(item => item._id !== entry._id));
      }
      setToast({ message: `Removed ${entry.course} (${entry.day} ${entry.time})`, type: 'success', id: Date.now() });
    } catch (err) {
      setToast({ message: err.message || 'Failed to delete entry', type: 'error', id: Date.now() });
    }
  };

  // Strictly filter for student and teacher
  const filteredRoutine = useMemo(() => {
    const matched = routine.filter(item => {
      // 1. Role enforcement: Students only see their section, Teachers only see their classes
      if (isStudent) {
        if (!userSection) return false;
        if (!matchesStudentSection(item.section, userSection)) return false;
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
        (item.facultyName && item.facultyName.toLowerCase().includes(q)) ||
        item.room.toLowerCase().includes(q);

      return matchesDay && matchesSearch;
    });

    return sortRoutineEntries(matched);
  }, [routine, isStudent, isTeacher, userSection, userFaculty, selectedDay, searchQuery]);

  return (
    <div className="card-panel">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className={`icon-tile ${isTeacher ? 'icon-tile-warning' : ''}`} aria-hidden="true">
            <IconCalendar />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              {isStudent && (userSection ? `Section ${userSection} Schedule` : 'Class Schedule')}
              {isTeacher && (userFaculty ? `Faculty ${userFaculty} Schedule` : 'Teaching Schedule')}
              {isAdmin && 'Master Routine'}
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isStudent && userSection && `Complete timetable for Section ${userSection}`}
              {isTeacher && userFaculty && `Assigned teaching schedule for ${userFaculty}`}
              {isAdmin && 'Browse, filter, and manage routine entries'}
            </p>
          </div>
        </div>

        {/* User Scope Chip */}
        <div>
          {isStudent && userSection && (
            <span className="user-chip badge-solid-primary">
              Section {userSection}
            </span>
          )}
          {isTeacher && userFaculty && (
            <span className="user-chip badge-warning">
              Faculty {userFaculty}
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label htmlFor="routine-search" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Search Courses or Rooms
          </label>
          <input
            id="routine-search"
            type="text"
            className="styled-input"
            placeholder="Course code, room, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <label htmlFor="routine-day-filter" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Filter by Day
          </label>
          <select
            id="routine-day-filter"
            className="styled-input"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
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

      {/* Per-day horizontal routine for students/teachers; full management table for admins */}
      {((isStudent && userSection) || (isTeacher && userFaculty) || isAdmin) && (
        <>
          {filteredRoutine.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <div className="empty-state-icon"><IconCalendar /></div>
              <h4>No classes found</h4>
              <p>No classes matched your filter criteria.</p>
            </div>
          ) : !isAdmin ? (
            <DayRoutineGrid
              entries={filteredRoutine}
              isTeacher={isTeacher}
              isAdmin={false}
              days={selectedDay === 'All' ? ACADEMIC_DAYS : [selectedDay]}
              showOffDays={!searchQuery && selectedDay === 'All'}
            />
          ) : (
            <div className="routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Day</th>
                    <th style={{ width: '190px' }}>Time Slot</th>
                    <th>Course</th>
                    {(isTeacher || isAdmin) && <th>Section</th>}
                    {!isTeacher && <th>Faculty</th>}
                    <th>Room</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutine.map((entry, idx) => {
                    const prevDay = idx > 0 ? filteredRoutine[idx - 1].day : null;
                    const isNewDay = entry.day !== prevDay;

                    return (
                      <tr
                        key={entry._id || idx}
                        style={{
                          borderTop: isNewDay && idx > 0 ? '2px solid var(--border)' : undefined
                        }}
                      >
                        <td>
                          <span className="routine-day-badge">
                            {entry.day}
                          </span>
                        </td>
                        <td>
                          <strong className="tabular-nums" style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{entry.time}</strong>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-text)' }}>
                            {entry.course}
                          </code>
                          {isStudent && entry.section && entry.section.includes('-') && (
                            <span className="routine-slot-group" style={{ marginLeft: '0.45rem' }}>
                              {entry.section.split('-')[1].trim() === 'I' ? 'Gr-I' : entry.section.split('-')[1].trim() === 'II' ? 'Gr-II' : entry.section}
                            </span>
                          )}
                        </td>
                        {(isTeacher || isAdmin) && (
                          <td>
                            <span className="user-chip badge-primary">
                              {entry.section}
                            </span>
                          </td>
                        )}
                        {!isTeacher && (
                          <td>
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {entry.faculty}
                              </span>
                              {entry.facultyName && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {entry.facultyName}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        <td>
                          <span className="routine-room-badge" style={{ fontSize: '0.85rem' }}>
                            Room {entry.room}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            {entry._id && (
                              <button
                                type="button"
                                className="cancel-btn small-btn"
                                onClick={() => handleDeleteEntry(entry)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
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
