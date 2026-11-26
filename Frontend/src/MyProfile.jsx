import { useState, useEffect } from 'react';
import { IconEdit, IconLogout } from './icons';
import { authAPI } from './api';
import Toast from './Toast';

export default function MyProfile({ user, setUser, handleLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    ...user,
    section: user.section || '',
    facultyCode: user.facultyCode || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Keep editedUser synchronized if user prop updates externally
  useEffect(() => {
    if (!isEditing && user) {
      setEditedUser({
        ...user,
        section: user.section || '',
        facultyCode: user.facultyCode || ''
      });
    }
  }, [user, isEditing]);

  const handleStartEdit = () => {
    setEditedUser({
      ...user,
      section: user.section || '',
      facultyCode: user.facultyCode || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmedId = (editedUser.id || '').trim();
    if (isTeacherOrAdmin && trimmedId.length < 2) {
      setToast({ message: 'ID must be at least 2 characters.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editedUser.name,
        department: editedUser.department
      };

      if (user.designation === 'Student') {
        payload.section = editedUser.section || '';
      } else if (user.designation === 'Teacher' || user.designation === 'Admin') {
        payload.id = trimmedId;
        payload.facultyCode = editedUser.facultyCode || '';
      }

      const data = await authAPI.updateProfile(payload);

      if (data && data.user) {
        setUser(data.user);
        setEditedUser(data.user);
      } else {
        const updated = {
          ...user,
          ...payload,
          ...(payload.id ? { id: payload.id, username: payload.id } : {})
        };
        setUser(updated);
        setEditedUser(updated);
      }
      setIsEditing(false);
      setToast({ message: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedUser({
      ...user,
      section: user.section || '',
      facultyCode: user.facultyCode || ''
    });
    setIsEditing(false);
  };

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user.username || user.id || 'U').charAt(0).toUpperCase();

  const isStudent = user.designation === 'Student';
  const isTeacherOrAdmin = user.designation === 'Teacher' || user.designation === 'Admin';

  return (
    <div className="profile-panel card-panel">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="profile-header">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-title">
          <h3>{isEditing ? 'Edit Profile' : 'User Profile'}</h3>
          <p className="profile-subtitle">
            {user.designation} • {user.department}
            {isStudent && user.section ? ` • Section ${user.section}` : ''}
            {isTeacherOrAdmin && user.facultyCode ? ` • Faculty ${user.facultyCode}` : ''}
          </p>
        </div>
        {!isEditing && (
          <button className="secondary-btn small-btn" onClick={handleStartEdit}>
            <IconEdit /> Edit Profile
          </button>
        )}
      </div>

      <div className="profile-details">
        <div className="profile-field">
          <label>Name</label>
          {isEditing ? (
            <input
              type="text"
              value={editedUser.name || ''}
              onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
              placeholder="Enter your full name"
              disabled={isSaving}
            />
          ) : (
            <div className="profile-value">{user.name || '—'}</div>
          )}
        </div>

        <div className="profile-field">
          <label>ID</label>
          {isEditing && isTeacherOrAdmin ? (
            <input
              type="text"
              value={editedUser.id || ''}
              onChange={(e) => setEditedUser({ ...editedUser, id: e.target.value })}
              placeholder="Enter your ID"
              disabled={isSaving}
            />
          ) : (
            <div className="profile-value">
              {user.id}
              {isEditing && isStudent && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  (Cannot be changed by students)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="profile-field">
          <label>Designation</label>
          <div className="profile-value">
            <span
              className={`user-chip ${
                user.designation === 'Admin'
                  ? 'badge-solid-primary'
                  : user.designation === 'Teacher'
                  ? 'badge-warning'
                  : 'badge-neutral'
              }`}
            >
              {user.designation}
            </span>
            {isEditing && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                (Managed by Admin)
              </span>
            )}
          </div>
        </div>

        <div className="profile-field">
          <label>Department</label>
          {isEditing ? (
            <input
              type="text"
              value={editedUser.department || ''}
              onChange={(e) => setEditedUser({ ...editedUser, department: e.target.value })}
              placeholder="Enter your department"
              disabled={isSaving}
            />
          ) : (
            <div className="profile-value">{user.department}</div>
          )}
        </div>

        {/* Dynamic Section field for Student */}
        {isStudent && (
          <div className="profile-field">
            <label>Assigned Section</label>
            {isEditing ? (
              <input
                type="text"
                value={editedUser.section || ''}
                onChange={(e) => setEditedUser({ ...editedUser, section: e.target.value.toUpperCase() })}
                placeholder="e.g. 5B, 6A, 2A"
                disabled={isSaving}
              />
            ) : (
              <div className="profile-value">
                {user.section ? <span className="user-chip badge-primary">Section {user.section}</span> : 'Not set (e.g. 5B)'}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Faculty Code for Teacher / Admin */}
        {isTeacherOrAdmin && (
          <div className="profile-field">
            <label>Faculty Initials / Code</label>
            {isEditing ? (
              <input
                type="text"
                value={editedUser.facultyCode || ''}
                onChange={(e) => setEditedUser({ ...editedUser, facultyCode: e.target.value.toUpperCase() })}
                placeholder="e.g. SDS, MMK, AM, MAR"
                disabled={isSaving}
              />
            ) : (
              <div className="profile-value">
                {user.facultyCode ? <span className="user-chip badge-warning">{user.facultyCode}</span> : 'Not set (e.g. SDS)'}
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="profile-actions">
          <button className="secondary-btn" onClick={handleCancel} disabled={isSaving}>Cancel</button>
          <button className="primary-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {!isEditing && (
        <button onClick={handleLogout} className="logout-btn">
          <IconLogout /> Sign Out
        </button>
      )}
    </div>
  );
}
