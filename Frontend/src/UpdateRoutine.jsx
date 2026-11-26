import { useState, useEffect } from 'react';
import Toast from './Toast';
import { routineAPI } from './api';
import { ACADEMIC_DAYS, TIME_SLOTS } from './routineParser';

export default function UpdateRoutine({ user, routine, setRoutine, roomDetails, setRoomDetails }) {
  const isAdmin = user && user.designation === 'Admin';
  const isTeacher = user && user.designation === 'Teacher';

  const [formData, setFormData] = useState({
    day: 'Saturday',
    section: '',
    time: TIME_SLOTS[0],
    course: '',
    faculty: (user && user.facultyCode) || '',
    room: '',
    capacity: '40',
    hasAC: true,
    hasProjector: true,
    isLab: false,
    note: ''
  });

  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const loadMyRequests = async () => {
    if (!isTeacher && !isAdmin) return;
    setIsLoadingRequests(true);
    try {
      const res = await routineAPI.getRoutineRequests();
      if (res && Array.isArray(res.requests)) {
        setMyRequests(res.requests);
      }
    } catch (err) {
      console.warn('Could not load routine requests:', err.message);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadMyRequests();
  }, [user?.designation, user?.id]);

  const validate = () => {
    const errs = {};
    if (!formData.section.trim()) errs.section = 'Section is required';
    if (!formData.time.trim()) errs.time = 'Time slot is required';
    if (!formData.course.trim()) errs.course = 'Course code is required';
    if (!formData.faculty.trim()) errs.faculty = 'Faculty initials are required';
    if (!formData.room.trim()) errs.room = 'Room number is required';
    if (!formData.capacity || Number(formData.capacity) < 1) errs.capacity = 'Valid capacity is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const entryPayload = {
      day: formData.day,
      section: formData.section.trim().toUpperCase(),
      time: formData.time.trim(),
      course: formData.course.trim().toUpperCase(),
      faculty: formData.faculty.trim().toUpperCase(),
      room: formData.room.trim(),
      capacity: Number(formData.capacity),
      hasAC: formData.hasAC,
      hasProjector: formData.hasProjector,
      isLab: formData.isLab,
      note: formData.note.trim()
    };

    setIsSubmitting(true);
    try {
      if (isAdmin) {
        // Admins add directly to master routine
        const res = await routineAPI.addRoutineEntry(entryPayload);
        const savedEntry = (res && res.routineEntry) ? res.routineEntry : entryPayload;
        setRoutine(prev => [...prev, savedEntry]);

        if (res && res.roomDetails) {
          setRoomDetails(prev => ({ ...prev, [entryPayload.room]: res.roomDetails }));
        }

        setToast({
          message: `Added ${entryPayload.course} (${entryPayload.day} ${entryPayload.time}) to master routine!`,
          type: 'success',
          id: Date.now()
        });
      } else {
        // Teachers submit for admin review; cannot add directly to routine
        const res = await routineAPI.submitRoutineRequest(entryPayload);
        if (res && res.request) {
          setMyRequests(prev => [res.request, ...prev]);
        }
        setToast({
          message: 'Routine change submitted for Admin review. It will appear in the schedule once approved.',
          type: 'success',
          id: Date.now()
        });
      }

      setFormData({
        day: 'Saturday',
        section: '',
        time: TIME_SLOTS[0],
        course: '',
        faculty: (user && user.facultyCode) || '',
        room: '',
        capacity: '40',
        hasAC: true,
        hasProjector: true,
        isLab: false,
        note: ''
      });
      setErrors({});
    } catch (err) {
      setToast({ message: err.message || 'Submission failed.', type: 'error', id: Date.now() });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user && !isTeacher && !isAdmin) {
    return (
      <div className="card-panel">
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ margin: 0 }}>Update Routine</h3>
          <p className="form-description" style={{ margin: '0.25rem 0 0' }}>This feature is reserved for teachers and admins only.</p>
        </div>
        <div className="empty-state" style={{ padding: '2.5rem 2rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontWeight: 800, fontSize: '1.25rem' }}>Access Denied</h4>
          <p style={{ margin: 0, fontSize: '0.95rem', maxWidth: '320px', lineHeight: 1.6 }}>Sign in with a teacher or admin account to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="card-panel">
        <div style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ margin: 0 }}>
            {isAdmin ? 'Add Class to Master Routine' : 'Submit Routine Request for Review'}
          </h3>
          <p className="form-description" style={{ margin: '0.25rem 0 0' }}>
            {isAdmin
              ? 'As an Administrator, entries submitted here are published immediately to the master routine.'
              : 'Submit a proposed class slot for review. An Administrator must approve your request before it is added to the routine.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="routine-form">
          <div className="routine-section">
            <p className="routine-section-title" style={{ margin: 0 }}>Schedule Details</p>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="day">Day</label>
                <select
                  id="day"
                  value={formData.day}
                  disabled={isSubmitting}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                >
                  {ACADEMIC_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="section">Section</label>
                <input
                  id="section"
                  type="text"
                  placeholder="e.g. 5B, 6A"
                  required
                  disabled={isSubmitting}
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                />
                {errors.section && <span className="field-error">{errors.section}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="time">Time Slot</label>
                <select
                  id="time"
                  value={formData.time}
                  disabled={isSubmitting}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                >
                  {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                {errors.time && <span className="field-error">{errors.time}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="course">Course Code</label>
                <input
                  id="course"
                  type="text"
                  placeholder="e.g. CSE 3101"
                  required
                  disabled={isSubmitting}
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value.toUpperCase() })}
                />
                {errors.course && <span className="field-error">{errors.course}</span>}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="faculty">Faculty Initials</label>
              <input
                id="faculty"
                type="text"
                placeholder="e.g. SDS, MMK, AM, MAR"
                required
                disabled={isSubmitting}
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value.toUpperCase() })}
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
                  placeholder="e.g. 1504, UB-110"
                  required
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                />
                {errors.capacity && <span className="field-error">{errors.capacity}</span>}
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label><input type="checkbox" disabled={isSubmitting} checked={formData.hasAC} onChange={(e) => setFormData({ ...formData, hasAC: e.target.checked })} /> Has AC</label>
              <label><input type="checkbox" disabled={isSubmitting} checked={formData.hasProjector} onChange={(e) => setFormData({ ...formData, hasProjector: e.target.checked })} /> Has Projector</label>
              <label><input type="checkbox" disabled={isSubmitting} checked={formData.isLab} onChange={(e) => setFormData({ ...formData, isLab: e.target.checked })} /> Is Lab</label>
            </div>

            {!isAdmin && (
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="note">Reason / Note for Admin (Optional)</label>
                <input
                  id="note"
                  type="text"
                  placeholder="e.g. Makeup class or extra lab session"
                  disabled={isSubmitting}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            )}
          </div>

          <button type="submit" className="primary-btn" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.95rem' }}>
            {isSubmitting
              ? 'Submitting...'
              : isAdmin
              ? 'Add Directly to Master Routine'
              : 'Submit Routine Request for Admin Review'}
          </button>
        </form>
      </div>

      {/* Teacher's Submitted Requests Tracker */}
      {isTeacher && (
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>My Routine Review Submissions</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Track approval status from the Administration
              </p>
            </div>
            <span className="user-chip">{myRequests.length} total</span>
          </div>

          {isLoadingRequests ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}><div className="spinner"></div></div>
          ) : myRequests.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>You haven&rsquo;t submitted any routine requests yet.</p>
            </div>
          ) : (
            <div className="routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th>Day & Time</th>
                    <th>Section</th>
                    <th>Course</th>
                    <th>Room</th>
                    <th>Status</th>
                    <th>Admin Note</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map(req => (
                    <tr key={req._id}>
                      <td>
                        <strong>{req.day}</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{req.time}</span>
                      </td>
                      <td>
                        <span className="user-chip badge-primary">
                          {req.section}
                        </span>
                      </td>
                      <td><code>{req.course}</code></td>
                      <td><span className="routine-room-badge">{req.room}</span></td>
                      <td>
                        <span
                          className={`user-chip ${
                            req.status === 'Approved'
                              ? 'badge-success'
                              : req.status === 'Rejected'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {req.reviewNote || req.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
