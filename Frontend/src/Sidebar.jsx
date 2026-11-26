import { IconDashboard, IconBookings, IconRoutine, IconProfile, IconLogout, IconClose, IconSchool, IconShield } from './icons';

export default function Sidebar({ isOpen, setIsOpen, setCurrentPage, currentPage, user, handleLogout }) {
  const menuItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'MyBookings', label: 'My Bookings', icon: IconBookings },
    { id: 'CurrentRoutine', label: 'Current Routine', icon: IconRoutine },
    ...(user && (user.designation === 'Teacher' || user.designation === 'Admin') ? [{ id: 'UpdateRoutine', label: 'Update Routine', icon: IconRoutine }] : []),
    ...(user && user.designation === 'Admin' ? [{ id: 'AdminPanel', label: 'Admin Panel', icon: IconShield }] : []),
    { id: 'MyProfile', label: 'Profile', icon: IconProfile },
  ];

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.username.charAt(0).toUpperCase();

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navigation sidebar" aria-hidden={!isOpen}>
      <button type="button" className="close-btn" onClick={() => setIsOpen(false)} aria-label="Close navigation">
        <IconClose />
      </button>
      <div className="sidebar-brand">
        <div className="sidebar-logo" aria-hidden="true">
          <IconSchool />
        </div>
        <div>
          <h3 className="sidebar-title">Classroom Checker</h3>
          <span className="sidebar-subtitle">Academic Workspace</span>
        </div>
      </div>

      <nav aria-label="Primary" style={{ flex: 1, overflowY: 'auto' }}>
        <ul className="nav-list">
          {menuItems.map(item => (
            <li
              key={item.id}
              role="button"
              tabIndex={0}
              aria-current={currentPage === item.id ? 'page' : undefined}
              className={currentPage === item.id ? 'active' : ''}
              onClick={() => {
                setCurrentPage(item.id);
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCurrentPage(item.id);
                  setIsOpen(false);
                }
              }}
            >
              <span className="nav-icon" aria-hidden="true"><item.icon /></span>
              <span className="nav-label">{item.label}</span>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar" aria-hidden="true">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name || user.username}</span>
            <span className="sidebar-user-designation">{user.designation} • {user.department}</span>
          </div>
        </div>
        <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
          <IconLogout />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
