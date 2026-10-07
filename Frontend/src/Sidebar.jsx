import { IconDashboard, IconBookings, IconRoutine, IconProfile, IconLogout, IconClose, IconSchool } from './icons';

export default function Sidebar({ isOpen, setIsOpen, setCurrentPage, currentPage, user, handleLogout }) {
  const menuItems = [
    { id: 'Dashboard', label: 'Dashboard', icon: IconDashboard },
    { id: 'MyBookings', label: 'My Bookings', icon: IconBookings },
    { id: 'CurrentRoutine', label: 'Current Routine', icon: IconRoutine },
    ...(user && user.designation === 'Teacher' ? [{ id: 'UpdateRoutine', label: 'Update Routine', icon: IconRoutine }] : []),
    { id: 'MyProfile', label: 'My Profile', icon: IconProfile },
  ];

  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.username.charAt(0).toUpperCase();

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
      <button className="close-btn" onClick={() => setIsOpen(false)} aria-label="Close sidebar">
        <IconClose />
      </button>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <IconSchool />
        </div>
        <h3 className="sidebar-title">Classroom<br />Checker</h3>
      </div>
      <ul className="nav-list" role="menu">
        {menuItems.map(item => (
          <li
            key={item.id}
            role="menuitem"
            tabIndex={0}
            className={currentPage === item.id ? 'active' : ''}
            onClick={() => {
              setCurrentPage(item.id);
              setIsOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setCurrentPage(item.id);
                setIsOpen(false);
              }
            }}
          >
            <span className="nav-icon"><item.icon /></span>
            <span className="nav-label">{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.name || user.username}</span>
            <span className="sidebar-user-designation">{user.designation} • {user.department}</span>
          </div>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout}>
          <IconLogout />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}