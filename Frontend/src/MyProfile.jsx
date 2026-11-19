import { useState } from 'react';
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await authAPI.updateProfile({
        name: editedUser.name,
        designation: editedUser.designation,
        department: editedUser.department,
        section: editedUser.section,
        facultyCode: editedUser.facultyCode
      });

      if (data && data.user) {
        setUser(data.user);
        setEditedUser(data.user);
      } else {
        setUser(editedUser);
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

  const isStudent = (editedUser.designation || user.designation) === 'Student';
  const isTeacher = (editedUser.designation || user.designation) === 'Teacher';

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
            {user.designation === 'Student' && user.section ? ` • Section ${user.section}` : ''}
            {user.designation === 'Teacher' && user.facultyCode ? ` • Faculty ${user.facultyCode}` : ''}
          </p>
        </div>
        {!isEditing && (
          <button className="secondary-btn small-btn" onClick={() => setIsEditing(true)}>
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
          <div className="profile-value">{user.id}</div>
        </div>

        <div className="profile-field">
          <label>Designation</label>
          {isEditing ? (
            <select
              value={(editedUser.designation || '').toLowerCase()}
              disabled={isSaving}
              onChange={(e) => {
                const val = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                setEditedUser({ ...editedUser, designation: val });
              }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          ) : (
            <div className="profile-value">{user.designation}</div>
          )}
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
                {user.section ? <span className="user-chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700 }}>Section {user.section}</span> : 'Not set (e.g. 5B)'}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Faculty Code for Teacher */}
        {isTeacher && (
          <div className="profile-field">
            <label>Faculty Initials / Code</label>
            {isEditing ? (
              <input
                type="text"
                value={editedUser.facultyCode || ''}
                onChange={(e) => setEditedUser({ ...editedUser, facultyCode: e.target.value.toUpperCase() })}
                placeholder="e.g. SDS, ABM, SDO"
                disabled={isSaving}
              />
            ) : (
              <div className="profile-value">
                {user.facultyCode ? <span className="user-chip" style={{ background: 'var(--warning-soft)', color: '#b45309', fontWeight: 700 }}>{user.facultyCode}</span> : 'Not set (e.g. SDS)'}
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
