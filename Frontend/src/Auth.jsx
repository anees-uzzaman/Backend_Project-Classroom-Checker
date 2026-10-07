import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons';
import { getStoredUsers, saveUsers } from './utils';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [designation, setDesignation] = useState('student');
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    if (!name.trim()) { setError('Name is required'); return false; }
    if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return false; }
    if (!id.trim()) { setError('ID is required'); return false; }
    if (id.trim().length < 2) { setError('ID must be at least 2 characters'); return false; }
    if (!department.trim()) { setError('Department is required'); return false; }
    if (department.trim().length < 2) { setError('Department must be at least 2 characters'); return false; }
    if (!password) { setError('Password is required'); return false; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    if (getStoredUsers().find(u => u.id === id.trim())) { setError('An account with this ID already exists'); return false; }
    setError('');
    return true;
  };

  const validateLogin = () => {
    if (!id.trim()) { setError('ID is required'); return false; }
    if (!password) { setError('Password is required'); return false; }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      if (!validateLogin()) return;
      setIsLoading(true);

      try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id.trim(), password }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');

        onLogin(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!validate()) return;
      setIsLoading(true);

      try {
        const response = await fetch('http://localhost:5000/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: id.trim(),
            name: name.trim(),
            designation: designation.charAt(0).toUpperCase() + designation.slice(1),
            department: department.trim(),
            password,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Signup failed');

        onLogin(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10l-10-7L2 10l10 7 10-7z" />
              <path d="M6 10v10l6 4 6-4V10" />
            </svg>
          </div>
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Sign in to access the classroom checker' : 'Register to start booking rooms'}
          </p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="id">{isLogin ? 'ID' : 'Student/Teacher ID'}</label>
            <input
              id="id"
              type="text"
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder={isLogin ? 'Enter your ID' : 'Enter your student/teacher ID'}
              disabled={isLoading}
              autoComplete="id"
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="designation">Designation</label>
                <select
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="department">Department</label>
                <input
                  id="department"
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Enter your department"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button type="submit" className="primary-btn auth-submit" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner"></span>
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p onClick={() => { setIsLogin(!isLogin); setError(''); }} className="toggle-auth">
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </p>
      </div>
    </div>
  );
}