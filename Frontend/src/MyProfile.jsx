import { useState } from 'react';
import { IconEdit, IconLogout } from './icons';
import { getStoredUsers, saveUsers } from './utils';

export default function MyProfile({ user, setUser, handleLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({ ...user });

  const handleSave = () => {
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], name: editedUser.name, designation: editedUser.designation, department: editedUser.department };
      saveUsers(users);
    }
    setUser(editedUser);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedUser({ ...user });
    setIsEditing(false);
  };

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.username.charAt(0).toUpperCase();

  return (
    <div className="profile-panel card-panel">
      <div className="profile-header">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-title">
          <h3>{isEditing ? 'Edit Profile' : 'User Profile'}</h3>
          <p className="profile-subtitle">{user.designation} • {user.department}</p>
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
              onChange={(e) => {
                const val = e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
                setEditedUser({ ...editedUser, designation: val });
              }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
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
              value={editedUser.department}
              onChange={(e) => setEditedUser({ ...editedUser, department: e.target.value })}
              placeholder="Enter your department"
            />
          ) : (
            <div className="profile-value">{user.department}</div>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="profile-actions">
          <button className="secondary-btn" onClick={handleCancel}>Cancel</button>
          <button className="primary-btn" onClick={handleSave}>Save Changes</button>
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