import { useState } from 'react';
import Toast from './Toast';

export default function UpdateRoutine({ user, routine, setRoutine, roomDetails, setRoomDetails }) {
  const [formData, setFormData] = useState({
    day: 'Saturday',
    section: '',
    time: '',
    course: '',
    faculty: '',
    room: '',
    capacity: '',
    hasAC: false,
    hasProjector: false,
    isLab: false
  });

  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.section.trim()) errs.section = 'Section is required';
    if (!formData.time.trim()) errs.time = 'Time slot is required';
    if (!formData.course.trim()) errs.course = 'Course code is required';
    if (!formData.faculty.trim()) errs.faculty = 'Faculty name is required';
    if (!formData.room.trim()) errs.room = 'Room number is required';
    if (!formData.capacity || Number(formData.capacity) < 1) errs.capacity = 'Valid capacity is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const newEntry = {
      day: formData.day,
      section: formData.section.trim(),
      time: formData.time.trim(),
      course: formData.course.trim(),
      faculty: formData.faculty.trim(),
      room: formData.room.trim()
    };

    setRoutine([...routine, newEntry]);

    const room = formData.room.trim();
    const capacity = Number(formData.capacity);
    if (!roomDetails[room] || roomDetails[room].capacity !== capacity || roomDetails[room].ac !== formData.hasAC || roomDetails[room].projector !== formData.hasProjector || roomDetails[room].lab !== formData.isLab) {
      setRoomDetails({
        ...roomDetails,
        [room]: {
          capacity: capacity || roomDetails[room]?.capacity || 0,
          ac: formData.hasAC,
          projector: formData.hasProjector,
          lab: formData.isLab
        }
      });
    }

    setToast({ message: 'Routine update submitted for review.', type: 'success', id: Date.now() });
    setFormData({ day: 'Saturday', section: '', time: '', course: '', faculty: '', room: '', capacity: '', hasAC: false, hasProjector: false, isLab: false });
    setErrors({});
  };

  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

  if (user && user.designation !== 'Teacher') {
    return (
      <div className="card-panel">
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ margin: 0 }}>Update Routine</h3>
          <p className="form-description" style={{ margin: '0.25rem 0 0' }}>This feature is reserved for teachers only.</p>
        </div>
        <div className="empty-state" style={{ padding: '2.5rem 2rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontWeight: 800, fontSize: '1.25rem' }}>Access Denied</h4>
          <p style={{ margin: 0, fontSize: '0.95rem', maxWidth: '320px', lineHeight: 1.6 }}>Sign in with a teacher account to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-panel">
      <div style={{ marginBottom: '1.75rem' }}>
        <h3 style={{ margin: 0 }}>Update Routine</h3>
        <p className="form-description" style={{ margin: '0.25rem 0 0' }}>Submit a routine change request for review by the administration.</p>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="routine-form">
        <div className="routine-section">
          <p className="routine-section-title" style={{ margin: 0 }}>Schedule Details</p>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="day">Day</label>
              <select
                id="day"
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
              >
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="section">Section</label>
              <input
                id="section"
                type="text"
                placeholder="e.g. 2A, 3B"
                required
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
              {errors.section && <span className="field-error">{errors.section}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="time">Time Slot</label>
              <input
                id="time"
                type="text"
                placeholder="e.g. 10.00 AM - 11.20 AM"
                required
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
              {errors.time && <span className="field-error">{errors.time}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="course">Course Code</label>
              <input
                id="course"
                type="text"
                placeholder="e.g. CSE 1101"
                required
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              />
              {errors.course && <span className="field-error">{errors.course}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="faculty">Faculty Name</label>
            <input
              id="faculty"
              type="text"
              placeholder="e.g. John Doe"
              required
              value={formData.faculty}
              onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
            />
            {errors.faculty && <span className="field-error">{errors.faculty}</span>}
          </div>
        </div>

        <div className="routine-section">
          <p className="routine-section-title" style={{ margin: 0 }}>Room Information</p>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="room">Room Number</label>
              <input
                id="room"
                type="text"
                placeholder="e.g. 1504"
                required
                value={formData.room}
                onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              />
              {errors.room && <span className="field-error">{errors.room}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="capacity">Room Capacity</label>
              <input
                id="capacity"
                type="number"
                placeholder="e.g. 40"
                required
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
              {errors.capacity && <span className="field-error">{errors.capacity}</span>}
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label><input type="checkbox" checked={formData.hasAC} onChange={(e) => setFormData({ ...formData, hasAC: e.target.checked })} /> Has AC</label>
            <label><input type="checkbox" checked={formData.hasProjector} onChange={(e) => setFormData({ ...formData, hasProjector: e.target.checked })} /> Has Projector</label>
            <label><input type="checkbox" checked={formData.isLab} onChange={(e) => setFormData({ ...formData, isLab: e.target.checked })} /> Is Lab</label>
          </div>
        </div>

        <button type="submit" className="primary-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.95rem' }}>
          Submit for Review
        </button>
      </form>
    </div>
  );
}
