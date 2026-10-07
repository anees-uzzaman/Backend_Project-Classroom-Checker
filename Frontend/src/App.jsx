import { useState } from 'react';
import './App.css';
import Auth from './Auth';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import MyBookings from './MyBookings';
import UpdateRoutine from './UpdateRoutine';
import MyProfile from './MyProfile';
import CurrentRoutine from './CurrentRoutine';
import initialRoutine, { roomDetails as initialRoomDetails } from './routine';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [myBookings, setMyBookings] = useState([]);
  const [globalBookings, setGlobalBookings] = useState([
    { room: '1504', day: 'Saturday', time: '8.30 AM - 9.50 AM', user: 'teacher_john', name: 'John Teacher', designation: 'Teacher', id: '1504-Saturday-8.30 AM - 9.50 AM-teacher_john-0' }
  ]);
  const [routine, setRoutine] = useState(initialRoutine);
  const [roomDetails, setRoomDetails] = useState(initialRoomDetails);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pageTitle = currentPage.replace(/([A-Z])/g, ' $1').trim();
  const pageSubtitle = {
    Dashboard: 'Find available classrooms and manage bookings quickly.',
    MyBookings: 'Review and manage your current reservations.',
    CurrentRoutine: 'View the full class routine schedule.',
    UpdateRoutine: 'Submit routine changes for review and planning.',
    MyProfile: 'View and update your account details securely.'
  }[currentPage];

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('Dashboard');
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard
                  user={user}
                  myBookings={myBookings}
                  setMyBookings={setMyBookings}
                  globalBookings={globalBookings}
                  setGlobalBookings={setGlobalBookings}
                  setCurrentPage={setCurrentPage}
                  routine={routine}
                />;
      case 'MyBookings':
        return <MyBookings bookings={myBookings} setMyBookings={setMyBookings} setGlobalBookings={setGlobalBookings} />;
      case 'CurrentRoutine':
        return <CurrentRoutine routine={routine} />;
      case 'UpdateRoutine':
        return <UpdateRoutine user={user} routine={routine} setRoutine={setRoutine} roomDetails={roomDetails} setRoomDetails={setRoomDetails} />;
      case 'MyProfile':
        return <MyProfile user={user} setUser={setUser} handleLogout={handleLogout} />;
      default:
        return <Dashboard
                  user={user}
                  myBookings={myBookings}
                  setMyBookings={setMyBookings}
                  globalBookings={globalBookings}
                  setGlobalBookings={setGlobalBookings}
                  setCurrentPage={setCurrentPage}
                  routine={routine}
                />;
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        setCurrentPage={setCurrentPage}
        currentPage={currentPage}
        user={user}
        handleLogout={handleLogout}
      />
      <div className={isSidebarOpen ? 'sidebar-overlay visible' : 'sidebar-overlay'} onClick={() => setIsSidebarOpen(false)} />

      <div className="main-content">
        <header className="top-header">
          <div className="header-title">
            <button className="burger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Open sidebar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <p className="eyebrow">Welcome back, {user.username}</p>
              <h2>
                <span className="header-logo-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10l-10-7L2 10l10 7 10-7z" />
                    <path d="M6 10v10l6 4 6-4V10" />
                  </svg>
                </span>
                Classroom Checker
              </h2>
            </div>
          </div>
          <div className="header-meta">
            <span className="user-chip">{user.designation}</span>
            <span className="user-chip">{user.department}</span>
            <button className="logout-btn small-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-header">
            <div>
              <p className="eyebrow">Current view</p>
              <h1>{pageTitle}</h1>
              <p className="page-description">{pageSubtitle}</p>
            </div>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}