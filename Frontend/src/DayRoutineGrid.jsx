import { ACADEMIC_DAYS, parseTimeSlotStart } from './routineParser';

/**
 * Renders the routine as one horizontal time-slot timetable block per day,
 * stacked vertically for every day in one go.
 */
export default function DayRoutineGrid({
  entries,
  isTeacher = false,
  isAdmin = false,
  days = ACADEMIC_DAYS,
  showOffDays = true
}) {
  return (
    <div className="routine-day-sections">
      {days.map((dayName) => {
        const dayEntries = entries.filter(
          (item) => (item.day || '').toLowerCase() === dayName.toLowerCase()
        );

        if (dayEntries.length === 0) {
          if (!showOffDays) return null;
          return (
            <div key={dayName} className="routine-offday-strip">
              <strong>Day - {dayName}</strong>
              <span>No classes scheduled</span>
            </div>
          );
        }

        // Collect and sort unique allocated time slots for this day
        const allocatedSlots = Array.from(
          new Set(dayEntries.map((e) => e.time).filter(Boolean))
        ).sort((a, b) => parseTimeSlotStart(a) - parseTimeSlotStart(b));

        return (
          <div key={dayName} className="routine-day-grid-card">
            <div className="routine-table-wrapper">
              <table className="routine-day-grid-table">
                <thead>
                  <tr>
                    <th colSpan={allocatedSlots.length} className="routine-day-banner">
                      Day - {dayName}
                    </th>
                  </tr>
                  <tr>
                    {allocatedSlots.map((slot) => (
                      <th key={slot} className="routine-slot-header">
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {allocatedSlots.map((slot) => {
                      const slotClasses = dayEntries.filter((e) => e.time === slot);
                      return (
                        <td key={slot} className="routine-slot-cell" data-slot={slot}>
                          <div className="routine-slot-stack">
                            {slotClasses.map((cls, idx) => {
                              const hasGroup = !isTeacher && cls.section && cls.section.includes('-');
                              const groupLabel = hasGroup
                                ? cls.section.split('-')[1].trim() === 'I'
                                  ? 'Gr-I'
                                  : cls.section.split('-')[1].trim() === 'II'
                                  ? 'Gr-II'
                                  : cls.section
                                : '';

                              return (
                                <div key={cls._id || idx} className="routine-slot-item">
                                  <div className="routine-slot-course">
                                    <code>{cls.course}</code>
                                    {groupLabel && (
                                      <span className="routine-slot-group">{groupLabel}</span>
                                    )}
                                  </div>

                                  {isTeacher ? (
                                    <div className="routine-slot-meta">
                                      Section {cls.section}
                                    </div>
                                  ) : isAdmin ? (
                                    <div className="routine-slot-meta">
                                      Sec {cls.section} • {cls.faculty}
                                    </div>
                                  ) : (
                                    <div className="routine-slot-meta">
                                      <span>{cls.faculty}</span>
                                      {cls.facultyName && (
                                        <span className="routine-slot-sub">{cls.facultyName}</span>
                                      )}
                                    </div>
                                  )}

                                  <div>
                                    <span className="routine-room-badge" style={{ fontSize: '0.75rem' }}>
                                      Room {cls.room}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
