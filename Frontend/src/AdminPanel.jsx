import { useState, useEffect, useRef } from 'react';
import { IconShield, IconSearch, IconCheck, IconUpload, IconCalendar, IconFileText } from './icons';
import { adminAPI, routineAPI } from './api';
import { parseRoutineWorkbook } from './routineParser';
import Toast from './Toast';

export default function AdminPanel({ user, setUser, onRoutineUpdated }) {
  const [activeTab, setActiveTab] = useState('routineReader'); // 'routineReader' | 'approvals' | 'roles'

  // Routine Approvals state
  const [routineRequests, setRoutineRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});

  // Routine Reader state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedRoutine, setParsedRoutine] = useState([]);
  const [parsedRoomDetails, setParsedRoomDetails] = useState(null);
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

  const fetchRoutineRequests = async () => {
    if (!isAdmin) return;
    setIsLoadingRequests(true);
    try {
      const data = await routineAPI.getRoutineRequests();
      if (data && Array.isArray(data.requests)) {
        setRoutineRequests(data.requests);
      }
    } catch (err) {
      console.warn('Could not load routine requests:', err.message);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoutineRequests();
  }, [isAdmin]);

  const handleApproveRequest = async (reqItem) => {
    setProcessingRequestId(reqItem._id);
    try {
      const note = reviewNotes[reqItem._id] || '';
      const res = await routineAPI.approveRoutineRequest(reqItem._id, note);
      if (res && res.request) {
        setRoutineRequests(prev => prev.map(r => r._id === reqItem._id ? res.request : r));
      }
      if (res && res.routineEntry && onRoutineUpdated) {
        const roomUpdate = res.updatedRoomDetails
          ? { [res.updatedRoomDetails.room]: res.updatedRoomDetails.details }
          : null;
        onRoutineUpdated([res.routineEntry], 'append', roomUpdate);
      }
      setToast({
        message: res.message || `Approved ${reqItem.course} and added to master routine.`,
        type: 'success',
        id: Date.now()
      });
    } catch (err) {
      setToast({
        message: err.message || 'Failed to approve routine request.',
        type: 'error',
        id: Date.now()
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (reqItem) => {
    setProcessingRequestId(reqItem._id);
    try {
      const note = reviewNotes[reqItem._id] || '';
      const res = await routineAPI.rejectRoutineRequest(reqItem._id, note);
      if (res && res.request) {
        setRoutineRequests(prev => prev.map(r => r._id === reqItem._id ? res.request : r));
      }
      setToast({
        message: res.message || `Rejected request for ${reqItem.course}.`,
        type: 'info',
        id: Date.now()
      });
    } catch (err) {
      setToast({
        message: err.message || 'Failed to reject routine request.',
        type: 'error',
        id: Date.now()
      });
    } finally {
      setProcessingRequestId(null);
    }
  };

  const pendingCount = routineRequests.filter(r => r.status === 'Pending').length;

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
      try {
        const buffer = await file.arrayBuffer();
        const { entries, roomDetails } = parseRoutineWorkbook(buffer);

        if (entries.length === 0) {
          setError('No valid routine entries found in this spreadsheet. Ensure it has a Routine matrix or Day, Section, Time, Course, Faculty, and Room columns.');
          setParsedRoutine([]);
          setParsedRoomDetails(null);
        } else {
          setParsedRoutine(entries);
          setParsedRoomDetails(roomDetails);
          setToast({
            message: `Extracted ${entries.length} classes from ${file.name}`,
            type: 'info',
            id: Date.now()
          });
        }
      } catch (err) {
        setError(`Failed to parse spreadsheet: ${err.message}`);
        setParsedRoutine([]);
        setParsedRoomDetails(null);
      } finally {
        setIsParsingFile(false);
      }
    } else {
      setError('Please select an Excel (.xlsx, .xls, .csv) file.');
      setSelectedFile(null);
      setParsedRoutine([]);
      setParsedRoomDetails(null);
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
      await routineAPI.batchUpdate(parsedRoutine, updateMode, parsedRoomDetails);
      setUploadSuccessMsg(
        `Schedule successfully updated! ${parsedRoutine.length} classes saved to database (${updateMode === 'replace' ? 'Master schedule replaced' : 'Appended to schedule'}).`
      );
      setToast({
        message: 'Master schedule updated successfully!',
        type: 'success',
        id: Date.now()
      });

      if (onRoutineUpdated) {
        onRoutineUpdated(parsedRoutine, updateMode, parsedRoomDetails);
      }

      setSelectedFile(null);
      setParsedRoutine([]);
      setParsedRoomDetails(null);
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

      const routineRes = await routineAPI.getRoutines();
      if (routineRes && routineRes.routine && onRoutineUpdated) {
        onRoutineUpdated(routineRes.routine, 'replace', res.roomDetails || null);
      }

      setSelectedFile(null);
      setParsedRoutine([]);
      setParsedRoomDetails(null);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <div className="icon-tile icon-tile-danger" aria-hidden="true">
            <IconShield />
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Administrator Access Required</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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

      {/* Segmented Tabs */}
      <div className="tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'routineReader'}
          className={activeTab === 'routineReader' ? 'active' : ''}
          onClick={() => setActiveTab('routineReader')}
        >
          <span className="tab-icon" aria-hidden="true"><IconUpload /></span> Full Routine Reader
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'approvals'}
          className={activeTab === 'approvals' ? 'active' : ''}
          onClick={() => setActiveTab('approvals')}
        >
          <span className="tab-icon" aria-hidden="true"><IconCalendar /></span> Routine Approvals
          {pendingCount > 0 && (
            <span className="tab-count-badge" aria-label={`${pendingCount} pending`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roles'}
          className={activeTab === 'roles' ? 'active' : ''}
          onClick={() => setActiveTab('roles')}
        >
          <span className="tab-icon" aria-hidden="true"><IconShield /></span> Role Assignment
        </button>
      </div>

      {activeTab === 'approvals' ? (
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div className="icon-tile icon-tile-warning" aria-hidden="true">
                <IconCalendar />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Teacher Routine Submissions</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Review and approve or reject routine updates submitted by teachers.
                </p>
              </div>
            </div>
            <button type="button" className="secondary-btn small-btn" onClick={fetchRoutineRequests} disabled={isLoadingRequests}>
              {isLoadingRequests ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {isLoadingRequests ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner"></div></div>
          ) : routineRequests.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <div className="empty-state-icon"><IconCalendar /></div>
              <h4>No routine submissions</h4>
              <p>Teacher routine review submissions will appear here for your approval.</p>
            </div>
          ) : (
            <div className="routine-table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th>Submitted By</th>
                    <th>Day & Time</th>
                    <th>Section</th>
                    <th>Course & Faculty</th>
                    <th>Room</th>
                    <th>Status</th>
                    <th>Review Note / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {routineRequests.map(req => {
                    const isPending = req.status === 'Pending';
                    const isBusy = processingRequestId === req._id;
                    return (
                      <tr key={req._id}>
                        <td>
                          <strong>{req.requestedByName || req.requestedBy}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {req.requestedBy}</span>
                          {req.note && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              &ldquo;{req.note}&rdquo;
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{req.day}</strong>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{req.time}</span>
                        </td>
                        <td>
                          <span className="user-chip badge-primary">
                            {req.section}
                          </span>
                        </td>
                        <td>
                          <code>{req.course}</code>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Faculty: {req.faculty}</span>
                        </td>
                        <td>
                          <span className="routine-room-badge">{req.room}</span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Cap: {req.capacity || 40}{req.isLab ? ' • Lab' : ''}
                          </span>
                        </td>
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
                        <td>
                          {isPending ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: '185px' }}>
                              <input
                                type="text"
                                className="styled-input"
                                placeholder="Optional review note..."
                                value={reviewNotes[req._id] || ''}
                                onChange={(e) => setReviewNotes(prev => ({ ...prev, [req._id]: e.target.value }))}
                                disabled={isBusy}
                                style={{ minHeight: '36px', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                              />
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  type="button"
                                  className="primary-btn small-btn"
                                  disabled={isBusy}
                                  onClick={() => handleApproveRequest(req)}
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                                >
                                  {isBusy ? '...' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  className="cancel-btn small-btn"
                                  disabled={isBusy}
                                  onClick={() => handleRejectRequest(req)}
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {req.reviewNote || (req.reviewedBy ? `Reviewed by ${req.reviewedBy}` : '—')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === 'routineReader' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* File Upload Zone */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <div className="icon-tile" aria-hidden="true">
                <IconUpload />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Full Routine Reader</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Upload Excel (.xlsx, .xls, .csv) schedule files to update the master routine.
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
                className="badge-success"
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.9rem 1.15rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--success-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <span style={{ display: 'flex' }}><IconCheck /></span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{uploadSuccessMsg}</span>
              </div>
            )}

            {/* Drop / Selector Card */}
            <div
              role="button"
              tabIndex={0}
              className="admin-dropzone"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current && fileInputRef.current.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="icon-tile" style={{ margin: '0 auto 0.85rem', width: '48px', height: '48px' }} aria-hidden="true">
                <IconFileText />
              </div>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {selectedFile ? selectedFile.name : 'Choose an Excel Routine File'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {selectedFile
                  ? `Size: ${(selectedFile.size / 1024).toFixed(1)} KB • Click to change file`
                  : 'Click to browse (.xlsx, .xls, .csv)'}
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
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Classes</p>
                  <h3 className="tabular-nums" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary-text)', fontWeight: 700 }}>{parsedRoutine.length}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Unique Sections</p>
                  <h3 className="tabular-nums" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 700 }}>{uniqueSectionsCount}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Faculty Members</p>
                  <h3 className="tabular-nums" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--warning-text)', fontWeight: 700 }}>{uniqueFacultiesCount}</h3>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-soft)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Classrooms</p>
                  <h3 className="tabular-nums" style={{ margin: 0, fontSize: '1.5rem', color: 'var(--success)', fontWeight: 700 }}>{uniqueRoomsCount}</h3>
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
                    className="styled-input"
                    placeholder="Filter preview by section, course, room..."
                    value={routinePreviewFilter}
                    onChange={(e) => setRoutinePreviewFilter(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
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
                        <td><span className="user-chip badge-primary">{r.section}</span></td>
                        <td className="tabular-nums">{r.time}</td>
                        <td><code>{r.course}</code></td>
                        <td>
                          <strong>{r.faculty}</strong>
                          {r.facultyName ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.facultyName}</span> : null}
                        </td>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <div className="icon-tile" aria-hidden="true">
                <IconShield />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Role Assignment</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                  Target User ID <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <input
                  id="targetUserId"
                  type="text"
                  className="styled-input"
                  placeholder="e.g. 242061009"
                  value={targetUserId}
                  onChange={(e) => {
                    setTargetUserId(e.target.value);
                    setError('');
                  }}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="newRole" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  New Assigned Role <span style={{ color: 'var(--danger-text)' }}>*</span>
                </label>
                <select
                  id="newRole"
                  className="styled-input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={isLoading}
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
                    className="styled-input"
                    placeholder="Search user ID, name, section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                  />
                  <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'flex' }}>
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
                            if (u.designation) setNewRole(u.designation);
                            setError('');
                          }}
                        >
                          <td><strong>{u.id}</strong></td>
                          <td>{u.name}</td>
                          <td>{u.department}</td>
                          <td>
                            {u.designation === 'Student' && u.section ? (
                              <span className="user-chip badge-primary">Sec: {u.section}</span>
                            ) : u.designation === 'Teacher' && u.facultyCode ? (
                              <span className="user-chip badge-warning">Code: {u.facultyCode}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`user-chip ${
                                u.designation === 'Admin'
                                  ? 'badge-solid-primary'
                                  : u.designation === 'Teacher'
                                  ? 'badge-warning'
                                  : 'badge-neutral'
                              }`}
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
                                if (u.designation) setNewRole(u.designation);
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
