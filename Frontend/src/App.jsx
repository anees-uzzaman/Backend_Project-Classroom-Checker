import { useState, useEffect } from 'react';
import './App.css';
import Auth from './Auth';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import MyBookings from './MyBookings';
import UpdateRoutine from './UpdateRoutine';
import MyProfile from './MyProfile';
import CurrentRoutine from './CurrentRoutine';
import AdminPanel from './AdminPanel';
import initialRoutine, { roomDetails as initialRoomDetails } from './routine';
import { authAPI, bookingAPI, routineAPI, getStoredSessionUser } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [myBookings, setMyBookings] = useState([]);
  const [globalBookings, setGlobalBookings] = useState([
    { room: '1504', day: 'Saturday', time: '8.30 AM - 9.50 AM', user: 'teacher_john', name: 'John Teacher', designation: 'Teacher', id: '1504-Saturday-8.30 AM - 9.50 AM-teacher_john-0' }
  ]);
  const [routine, setRoutine] = useState(initialRoutine);
  const [roomDetails, setRoomDetails] = useState(initialRoomDetails);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Restore authenticated session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = getStoredSessionUser();
        if (stored) {
          setUser(stored);
        }
        const me = await authAPI.getMe().catch(() => null);
        if (me && me.user) {
          setUser(me.user);
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    restoreSession();
  }, []);

  // Sync data with backend on load
  useEffect(() => {
    async function loadData() {
      try {
        const bookingRes = await bookingAPI.getBookings().catch(() => null);
        if (bookingRes && Array.isArray(bookingRes.bookings) && bookingRes.bookings.length > 0) {
          setGlobalBookings(bookingRes.bookings);
        }

        const routineRes = await routineAPI.getRoutines().catch(() => null);
        if (routineRes && Array.isArray(routineRes.routine) && routineRes.routine.length > 0) {
          setRoutine(routineRes.routine);
        } else {
          // Seed initial routines in background if backend has no records
          routineAPI.seed(initialRoutine, initialRoomDetails).catch(() => {});
        }

        const roomRes = await routineAPI.getRooms().catch(() => null);
        if (roomRes && roomRes.rooms && Object.keys(roomRes.rooms).length > 0) {
          setRoomDetails(prev => ({ ...prev, ...roomRes.rooms }));
        }
      } catch (err) {
        console.warn('Backend data sync fallback to local state', err);
      }
    }
    loadData();
  }, []);

  // Update user's personal bookings when global bookings or user changes
  useEffect(() => {
    if (user) {
      setMyBookings(globalBookings.filter(b => b.user === user.username || b.user === user.id));
    } else {
      setMyBookings([]);
    }
  }, [globalBookings, user]);

  const pageTitle = currentPage.replace(/([A-Z])/g, ' $1').trim();
  const pageSubtitle = {
    Dashboard: 'Find available classrooms and manage bookings quickly.',
    MyBookings: 'Review and manage your current reservations.',
    CurrentRoutine: 'View the full class routine schedule.',
    UpdateRoutine: 'Submit routine changes for review and planning.',
    AdminPanel: 'Manage user permissions and administrative role assignments.',
    MyProfile: 'View and update your account details securely.'
  }[currentPage];

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setCurrentPage('Dashboard');
  };

  const handleRoutineUpdated = (newRoutines, mode = 'replace') => {
    if (mode === 'append') {
      setRoutine(prev => [...prev, ...newRoutines]);
    } else {
      setRoutine(newRoutines);
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard
                  user={user}
                  setUser={setUser}
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
        return <CurrentRoutine routine={routine} user={user} />;
      case 'UpdateRoutine':
        return <UpdateRoutine user={user} routine={routine} setRoutine={setRoutine} roomDetails={roomDetails} setRoomDetails={setRoomDetails} />;
      case 'AdminPanel':
        return <AdminPanel user={user} setUser={setUser} onRoutineUpdated={handleRoutineUpdated} />;
      case 'MyProfile':
        return <MyProfile user={user} setUser={setUser} handleLogout={handleLogout} />;
      default:
        return <Dashboard
                  user={user}
                  setUser={setUser}
                  myBookings={myBookings}
                  setMyBookings={setMyBookings}
                  globalBookings={globalBookings}
                  setGlobalBookings={setGlobalBookings}
                  setCurrentPage={setCurrentPage}
                  routine={routine}
                />;
    }
  };

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

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
              <p className="eyebrow">Welcome back, {user.name || user.username}</p>
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
