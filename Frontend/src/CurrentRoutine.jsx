import { useState } from 'react';
import { IconCalendar } from './icons';

export default function CurrentRoutine({ routine }) {
  const [selectedDay, setSelectedDay] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

  const filteredRoutine = routine.filter(item => {
    const matchesDay = selectedDay === 'All' || item.day === selectedDay;
    const matchesSearch = !searchQuery || 
      item.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.faculty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.room.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDay && matchesSearch;
  });

  const routineByDay = days.reduce((acc, day) => {
    acc[day] = filteredRoutine.filter(item => item.day === day);
    return acc;
  }, {});

  const totalEntries = filteredRoutine.length;

  return (
    <div className="card-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <IconCalendar />
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Current Routine</h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {totalEntries} class{totalEntries !== 1 ? 'es' : ''} scheduled
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Search section, course, faculty, room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-soft)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Filter by Day
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
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

      {selectedDay === 'All' ? (
        <div className="routine-day-sections">
          {days.map(day => {
            const entries = routineByDay[day] || [];
            if (entries.length === 0) return null;
            return (
              <div key={day} className="routine-day-section">
                <div className="routine-day-header">
                  <span className="routine-day-badge">{day}</span>
                  <span className="routine-day-count">{entries.length} class{entries.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="routine-table-wrapper">
                  <table className="routine-table">
                    <thead>
                      <tr>
                        <th>Section</th>
                        <th>Time</th>
                        <th>Course</th>
                        <th>Faculty</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => (
                        <tr key={`${entry.day}-${entry.section}-${entry.time}-${idx}`}>
                          <td><strong>{entry.section}</strong></td>
                          <td>{entry.time}</td>
                          <td>{entry.course}</td>
                          <td>{entry.faculty}</td>
                          <td><span className="routine-room-badge">{entry.room}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="routine-table-wrapper">
          {filteredRoutine.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><IconCalendar /></div>
              <h4>No classes found</h4>
              <p>No routine entries match your search criteria.</p>
            </div>
          ) : (
            <table className="routine-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Section</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Faculty</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutine.map((entry, idx) => (
                  <tr key={`${entry.day}-${entry.section}-${entry.time}-${idx}`}>
                    <td><span className="routine-day-badge">{entry.day}</span></td>
                    <td><strong>{entry.section}</strong></td>
                    <td>{entry.time}</td>
                    <td>{entry.course}</td>
                    <td>{entry.faculty}</td>
                    <td><span className="routine-room-badge">{entry.room}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
