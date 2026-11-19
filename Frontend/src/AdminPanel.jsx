import { useState, useEffect, useRef } from 'react';
import * as xlsx from 'xlsx';
import { IconShield, IconSearch, IconCheck, IconUpload, IconFileText, IconCalendar } from './icons';
import { adminAPI, routineAPI } from './api';
import Toast from './Toast';

export default function AdminPanel({ user, setUser, onRoutineUpdated }) {
  const [activeTab, setActiveTab] = useState('routineReader'); // 'routineReader' | 'roles'

  // Routine Reader state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedRoutine, setParsedRoutine] = useState([]);
  const [updateMode, setUpdateMode] = useState('replace'); // 'replace' | 'append'
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [routinePreviewFilter, setRoutinePreviewFilter] = useState('');
  const fileInputRef = useRef(null);

  // Role Assignment state
  const [targetUserId, setTargetUserId] = useState('');
  const [newRole, setNewRole] = useState('Teacher');
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user && user.designation === 'Admin';

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      const data = await adminAPI.getUsers();
      if (data && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.warn('Could not load user list:', err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdmin]);

  // Client-side helper: Normalize row from Excel
  const normalizeRow = (row, defaultDay = 'Saturday') => {
    const getField = (candidates) => {
      for (const key of Object.keys(row)) {
        const clean = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const c of candidates) {
          if (clean === c.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            const v = String(row[key]).trim();
            if (v) return v;
          }
        }
      }
      return '';
    };

    const day = getField(['day', 'weekday', 'dayofweek']) || defaultDay;
    const section = getField(['section', 'sec', 'batch']);
    const time = getField(['time', 'timeslot', 'slot', 'period', 'hour']);
    const course = getField(['course', 'coursecode', 'subject', 'class']);
    const faculty = getField(['faculty', 'teacher', 'instructor', 'initials']) || 'TBA';
    const room = getField(['room', 'roomno', 'classroom', 'hall']);

    if (!section || !time || !course || !room) return null;

    const cleanDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    return {
      day: cleanDay,
      section: section.trim().toUpperCase(),
      time: time.trim(),
      course: course.trim().toUpperCase(),
      faculty: faculty.trim().toUpperCase(),
      room: room.trim()
    };
  };

  // Handle file selection (Excel or PDF)
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadSuccessMsg('');
    setError('');
    setIsParsingFile(true);

    const filename = file.name.toLowerCase();

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
      // Parse Excel client-side with SheetJS for instant interactive preview
      try {
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'array' });
        const entries = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
          const dayMatch = sheetName.match(/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i);
          const defaultDay = dayMatch ? dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase() : 'Saturday';

          for (const r of rawRows) {
            const normalized = normalizeRow(r, defaultDay);
            if (normalized) entries.push(normalized);
          }
        }

        if (entries.length === 0) {
          setError('No valid routine entries found in this spreadsheet. Check column headers (Day, Section, Time, Course, Faculty, Room).');
          setParsedRoutine([]);
        } else {
          setParsedRoutine(entries);
          setToast({
            message: `Extracted ${entries.length} classes from ${file.name}`,
            type: 'info',
            id: Date.now()
          });
        }
      } catch (err) {
        setError(`Failed to parse spreadsheet: ${err.message}`);
        setParsedRoutine([]);
      } finally {
        setIsParsingFile(false);
      }
    } else if (filename.endsWith('.pdf')) {
      // Send PDF to backend routine reader service for parsing
      try {
        const res = await routineAPI.uploadFile(file, { mode: updateMode, dryRun: true });
        if (res && res.entries && res.entries.length > 0) {
          setParsedRoutine(res.entries);
          setToast({
            message: `Extracted ${res.entries.length} classes from PDF`,
            type: 'info',
            id: Date.now()
          });
        } else {
          setError('Could not extract tabular routine from PDF. Ensure text content contains Day, Section, Time, and Course.');
          setParsedRoutine([]);
        }
      } catch (err) {
        setError(`Failed to parse PDF routine: ${err.message}`);
        setParsedRoutine([]);
      } finally {
        setIsParsingFile(false);
      }
    } else {
      setError('Please select an Excel (.xlsx, .xls, .csv) or PDF (.pdf) file.');
      setSelectedFile(null);
      setParsedRoutine([]);
      setIsParsingFile(false);
    }
  };

  // Commit parsed routine to MongoDB
  const handleCommitRoutine = async () => {
    if (!parsedRoutine || parsedRoutine.length === 0) {
      setError('No parsed routine entries to save.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const res = await routineAPI.batchUpdate(parsedRoutine, updateMode);
      setUploadSuccessMsg(
        `Schedule successfully updated! ${parsedRoutine.length} classes saved to database (${updateMode === 'replace' ? 'Master schedule replaced' : 'Appended to schedule'}).`
      );
      setToast({
        message: 'Master schedule updated successfully!',
        type: 'success',
        id: Date.now()
      });

      // Notify parent to refresh app routine state
      if (onRoutineUpdated) {
        onRoutineUpdated(parsedRoutine, updateMode);
      }

      // Reset file input
      setSelectedFile(null);
      setParsedRoutine([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'Failed to update schedule in database.');
      setToast({
        message: err.message || 'Schedule update failed',
        type: 'error',
        id: Date.now()
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Direct upload and commit via backend API
  const handleDirectUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setError('');

    try {
      const res = await routineAPI.uploadFile(selectedFile, { mode: updateMode, dryRun: false });
      setUploadSuccessMsg(res.message || 'Schedule updated successfully!');
      setToast({
        message: 'File uploaded and schedule updated!',
        type: 'success',
        id: Date.now()
      });

      // Reload fresh routines
      const routineRes = await routineAPI.getRoutines();
      if (routineRes && routineRes.routine && onRoutineUpdated) {
        onRoutineUpdated(routineRes.routine, 'replace');
      }

      setSelectedFile(null);
      setParsedRoutine([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message || 'Failed to upload and update schedule.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRoleAssignment = async (e) => {
    e && e.preventDefault();
    if (!targetUserId.trim()) {
      setError('Please provide a target user ID.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await adminAPI.assignRole({
        targetUserId: targetUserId.trim(),
        newRole
      });

      setConfirmation(result.confirmation || {
        targetUserId: targetUserId.trim(),
        newRole,
        updatedAt: new Date().toISOString()
      });

      setToast({
        message: result.message || `Successfully assigned ${newRole} role to ${targetUserId}!`,
        type: 'success',
        id: Date.now()
      });

      if (user && (user.id === targetUserId.trim() || user.username === targetUserId.trim())) {
        setUser({ ...user, designation: newRole });
      }

      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user role');
      setToast({
        message: err.message || 'Role update failed',
        type: 'error',
        id: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimAdmin = async () => {
    setIsBootstrapping(true);
    try {
      const result = await adminAPI.bootstrapAdmin();
      if (result.user) {
        setUser(result.user);
      }
      setToast({
        message: 'Administrator privileges successfully granted!',
        type: 'success',
        id: Date.now()
      });
    } catch (err) {
      setToast({
        message: err.message || 'Could not claim admin privileges',
        type: 'error',
        id: Date.now()
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.id && u.id.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.designation && u.designation.toLowerCase().includes(q)) ||
      (u.section && u.section.toLowerCase().includes(q)) ||
      (u.facultyCode && u.facultyCode.toLowerCase().includes(q))
    );
  });

  const filteredParsedRoutine = parsedRoutine.filter((r) => {
    if (!routinePreviewFilter) return true;
    const q = routinePreviewFilter.toLowerCase();
    return (
      r.day.toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q) ||
      r.time.toLowerCase().includes(q) ||
      r.course.toLowerCase().includes(q) ||
      r.faculty.toLowerCase().includes(q) ||
      r.room.toLowerCase().includes(q)
    );
  });

  // Unique stats from parsed routine
  const uniqueSectionsCount = new Set(parsedRoutine.map((r) => r.section)).size;
  const uniqueFacultiesCount = new Set(parsedRoutine.map((r) => r.faculty)).size;
  const uniqueRoomsCount = new Set(parsedRoutine.map((r) => r.room)).size;

  if (!isAdmin) {
    return (
      <div className="card-panel">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
            <IconShield />
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Administrator Access Required</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              This section is restricted to administrators only.
            </p>
          </div>
        </div>

        <div className="empty-state" style={{ padding: '2.5rem 2rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontWeight: 800, fontSize: '1.25rem' }}>
            Access Denied
          </h4>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', maxWidth: '420px', lineHeight: 1.6 }}>
            You are logged in with role <strong>{user.designation}</strong>. An administrator must assign you the Admin role to access routine file imports and role controls.
          </p>
          <button
            onClick={handleClaimAdmin}
            className="primary-btn"
            disabled={isBootstrapping}
            style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}
          >
            {isBootstrapping ? 'Claiming Admin Role...' : 'Claim First Administrator Role'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === 'routineReader' ? 'active' : ''}
          onClick={() => setActiveTab('routineReader')}
        >
          <span className="tab-icon"><IconUpload /></span> Full Routine Reader (Excel / PDF)
        </button>
        <button
          className={activeTab === 'roles' ? 'active' : ''}
          onClick={() => setActiveTab('roles')}
        >
          <span className="tab-icon"><IconShield /></span> Role Assignment & Directory
        </button>
      </div>

      {activeTab === 'routineReader' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* File Upload Zone */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
                <IconUpload />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Full Routine Reader</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Upload Excel (.xlsx, .xls, .csv) or PDF schedule files to read and update the institutional routine.
                </p>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: '1.25rem' }}>
                {error}
              </div>
            )}

            {uploadSuccessMsg && (
              <div
                style={{
                  marginBottom: '1.5rem',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--success-soft)',
                  border: '1.5px solid var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <span style={{ color: 'var(--success)', display: 'flex' }}><IconCheck /></span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{uploadSuccessMsg}</span>
              </div>
            )}

            {/* Drop / Selector Card */}
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--surface-soft)',
                transition: 'border-color 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📄</div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                {selectedFile ? selectedFile.name : 'Choose an Excel or PDF Routine File'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedFile
                  ? `Size: ${(selectedFile.size / 1024).toFixed(1)} KB • Click to change file`
                  : 'Drag & drop or click to browse (.xlsx, .xls, .csv, .pdf)'}
              </p>
            </div>

            {/* Import Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Update Mode:</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="updateMode"
                    value="replace"
                    checked={updateMode === 'replace'}
                    onChange={() => setUpdateMode('replace')}
                  />
                  <strong>Replace Master Schedule</strong> (Overwrites existing routine)
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="updateMode"
                    value="append"
                    checked={updateMode === 'append'}
                    onChange={() => setUpdateMode('append')}
                  />
                  <span>Append / Merge with existing</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {selectedFile && parsedRoutine.length > 0 && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleCommitRoutine}
                    disabled={isUploading || isParsingFile}
                  >
                    {isUploading ? (
                      <span className="spinner" style={{ width: '18px', height: '18px' }}></span>
                    ) : (
                      `Commit & Update Master Schedule (${parsedRoutine.length} classes)`
                    )}
                  </button>
                )}
                {selectedFile && parsedRoutine.length === 0 && !isParsingFile && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleDirectUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading & Parsing...' : 'Process File via Server'}
                  </button>
                )}
              </div>
            </div>

            {isParsingFile && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Reading file and analyzing routine structure...
                </p>
              </div>
            )}
          </div>

          {/* Parsed Preview Table */}
          {parsedRoutine.length > 0 && (
            <div className="card-panel">
              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Classes</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 800 }}>{parsedRoutine.length}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Unique Sections</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 800 }}>{uniqueSectionsCount}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Faculty Members</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f59e0b', fontWeight: 800 }}>{uniqueFacultiesCount}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Classrooms</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#10b981', fontWeight: 800 }}>{uniqueRoomsCount}</h3>
                </div>
              </div>

              {/* Filter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Extracted Schedule Preview ({filteredParsedRoutine.length} of {parsedRoutine.length})
                  </h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Verify the extracted columns before committing changes
                  </p>
                </div>
                <div style={{ minWidth: '220px', maxWidth: '300px', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Filter preview by section, course, room..."
                    value={routinePreviewFilter}
                    onChange={(e) => setRoutinePreviewFilter(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="routine-table-wrapper" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="routine-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Section</th>
                      <th>Time Slot</th>
                      <th>Course</th>
                      <th>Faculty</th>
                      <th>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParsedRoutine.slice(0, 100).map((r, idx) => (
                      <tr key={idx}>
                        <td><strong>{r.day}</strong></td>
                        <td><span className="user-chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700 }}>{r.section}</span></td>
                        <td>{r.time}</td>
                        <td><code>{r.course}</code></td>
                        <td>{r.faculty}</td>
                        <td><span className="routine-room-badge">{r.room}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredParsedRoutine.length > 100 && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Showing first 100 of {filteredParsedRoutine.length} classes
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Role Assignment Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Role Assignment Card */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
                <IconShield />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Admin-Controlled Role Assignment</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Authorize and reassign user permissions across the institution.
                </p>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert" style={{ marginBottom: '1.25rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRoleAssignment} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="targetUserId" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Target User ID <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="targetUserId"
                  type="text"
                  placeholder="e.g. 242061009"
                  value={targetUserId}
                  onChange={(e) => {
                    setTargetUserId(e.target.value);
                    setError('');
                  }}
                  required
                  disabled={isLoading}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="newRole" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  New Assigned Role <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={isLoading}
                  style={{ width: '100%' }}
                >
                  <option value="Student">Student (Section schedule & booking)</option>
                  <option value="Teacher">Teacher (Assigned classes & routine updates)</option>
                  <option value="Admin">Admin (Full administrative & schedule reader)</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isLoading || !targetUserId.trim()}
                  style={{ width: '100%', height: '44px', justifyContent: 'center' }}
                >
                  {isLoading ? (
                    <span className="spinner" style={{ width: '18px', height: '18px' }}></span>
                  ) : (
                    'Update Target Role'
                  )}
                </button>
              </div>
            </form>

            {confirmation && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--success-soft)',
                  border: '1.5px solid var(--success)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}
              >
                <div style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }}>
                  <IconCheck />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.35rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 700 }}>
                    Role Updated Confirmation
                  </h4>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    User <strong>{confirmation.name || confirmation.targetUserId}</strong> (ID: <code>{confirmation.targetUserId}</code>) has been successfully updated to role <span className="user-chip" style={{ marginLeft: '0.35rem', background: 'var(--primary)', color: 'white' }}>{confirmation.newRole}</span>.
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Previous Role: <em>{confirmation.previousRole || 'N/A'}</em> • Confirmed at: {new Date(confirmation.updatedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Directory */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Registered Users Directory</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any user to auto-populate target ID and reassign role
                </p>
              </div>
              <div style={{ minWidth: '220px', maxWidth: '320px', width: '100%' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search user ID, name, section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                  />
                  <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                    <IconSearch />
                  </div>
                </div>
              </div>
            </div>

            {isLoadingUsers ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="spinner"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No registered users found matching &ldquo;{searchQuery}&rdquo;.</p>
              </div>
            ) : (
              <div className="routine-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="routine-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Department</th>
                      <th>Section / Code</th>
                      <th>Current Role</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isCurrentTarget = targetUserId.trim() === u.id;
                      return (
                        <tr
                          key={u.id}
                          style={{
                            background: isCurrentTarget ? 'var(--primary-soft)' : undefined,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setTargetUserId(u.id);
                            setError('');
                          }}
                        >
                          <td><strong>{u.id}</strong></td>
                          <td>{u.name}</td>
                          <td>{u.department}</td>
                          <td>
                            {u.designation === 'Student' && u.section ? (
                              <span className="user-chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600 }}>Sec: {u.section}</span>
                            ) : u.designation === 'Teacher' && u.facultyCode ? (
                              <span className="user-chip" style={{ background: 'var(--warning-soft)', color: '#b45309', fontWeight: 600 }}>Code: {u.facultyCode}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className="user-chip"
                              style={{
                                background:
                                  u.designation === 'Admin'
                                    ? 'linear-gradient(135deg, var(--accent), var(--primary))'
                                    : u.designation === 'Teacher'
                                    ? 'var(--warning-soft)'
                                    : 'var(--surface-soft)',
                                color:
                                  u.designation === 'Admin'
                                    ? 'white'
                                    : u.designation === 'Teacher'
                                    ? '#b45309'
                                    : 'var(--text-main)',
                                fontWeight: 600
                              }}
                            >
                              {u.designation}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="secondary-btn small-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetUserId(u.id);
                                setError('');
                              }}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
