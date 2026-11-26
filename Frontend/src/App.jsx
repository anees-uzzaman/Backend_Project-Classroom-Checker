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
  const [globalBookings, setGlobalBookings] = useState([]);
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
        if (bookingRes && Array.isArray(bookingRes.bookings)) {
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

  // Refresh bookings when logged-in user ID changes (e.g., Teacher/Admin updates ID)
  useEffect(() => {
    if (!user?.id) return;
    bookingAPI.getBookings()
      .then(res => {
        if (res && Array.isArray(res.bookings)) {
          setGlobalBookings(res.bookings);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Update user's personal bookings when global bookings or user changes
  useEffect(() => {
    if (user) {
      setMyBookings(globalBookings.filter(b => b.user === user.username || b.user === user.id));
    } else {
      setMyBookings([]);
    }
  }, [globalBookings, user]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  const pageTitle = currentPage.replace(/([A-Z])/g, ' $1').trim();
  const pageSubtitle = {
    Dashboard: 'Schedule and classroom availability',
    MyBookings: 'Review and manage your reservations',
    CurrentRoutine: 'Complete academic timetable',
    UpdateRoutine: 'Submit routine changes for review',
    AdminPanel: 'Schedule imports, approvals, and user roles',
    MyProfile: 'Account details and role preferences'
  }[currentPage];

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setCurrentPage('Dashboard');
  };

  const handleRoutineUpdated = (newRoutines, mode = 'replace', newRoomDetails = null) => {
    if (mode === 'append') {
      setRoutine(prev => [...prev, ...newRoutines]);
    } else {
      setRoutine(newRoutines);
    }
    if (newRoomDetails && typeof newRoomDetails === 'object') {
      setRoomDetails(prev => ({ ...prev, ...newRoomDetails }));
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
                  roomDetails={roomDetails}
                />;
      case 'MyBookings':
        return <MyBookings bookings={myBookings} setMyBookings={setMyBookings} setGlobalBookings={setGlobalBookings} />;
      case 'CurrentRoutine':
        return <CurrentRoutine routine={routine} setRoutine={setRoutine} user={user} />;
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
                  roomDetails={roomDetails}
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
            <button
              type="button"
              className="burger-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isSidebarOpen}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div>
              <h1>{pageTitle}</h1>
              <p className="header-subtitle">{pageSubtitle}</p>
            </div>
          </div>
          <div className="header-meta">
            <span className="user-chip badge-primary">{user.designation}</span>
            <span className="user-chip badge-neutral">{user.department}</span>
            <button type="button" className="secondary-btn small-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        <main className="page-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
