const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'rmv2_token';
const USER_KEY = 'rmv2_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredSessionUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user, token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save session to localStorage', err);
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear session from localStorage', err);
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...(options.headers || {})
  };

  // Only default to application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const authAPI = {
  async signup(payload) {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      setSession(data.user, data.token);
    }
    return data;
  },

  async login(payload) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      setSession(data.user, data.token);
    }
    return data;
  },

  async getMe() {
    const token = getToken();
    if (!token) return null;
    const data = await request('/auth/me', { method: 'GET' });
    if (data && data.user) {
      setSession(data.user, data.token || token);
    }
    return data;
  },

  async updateProfile(payload) {
    const data = await request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (data.user) {
      setSession(data.user, data.token);
    }
    return data;
  },

  logout() {
    clearSession();
  }
};

export const bookingAPI = {
  async getBookings() {
    return await request('/bookings', { method: 'GET' });
  },

  async createBooking(booking) {
    return await request('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking)
    });
  },

  async cancelBooking(bookingId) {
    return await request(`/bookings/${encodeURIComponent(bookingId)}`, {
      method: 'DELETE'
    });
  }
};

export const routineAPI = {
  async getRoutines(params = {}) {
    const query = new URLSearchParams();
    if (params.section) query.append('section', params.section);
    if (params.faculty) query.append('faculty', params.faculty);
    if (params.day) query.append('day', params.day);
    if (params.room) query.append('room', params.room);
    const qs = query.toString();
    return await request(qs ? `/routine?${qs}` : '/routine', { method: 'GET' });
  },

  async getRoutineMeta() {
    return await request('/routine/meta', { method: 'GET' });
  },

  async addRoutineEntry(entry) {
    return await request('/routine', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  },

  async deleteRoutineEntry(entryId) {
    return await request(`/routine/${encodeURIComponent(entryId)}`, {
      method: 'DELETE'
    });
  },

  async getRoutineRequests() {
    return await request('/routine/requests', { method: 'GET' });
  },

  async submitRoutineRequest(payload) {
    return await request('/routine/requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async approveRoutineRequest(id, reviewNote = '') {
    return await request(`/routine/requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote })
    });
  },

  async rejectRoutineRequest(id, reviewNote = '') {
    return await request(`/routine/requests/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote })
    });
  },

  async uploadFile(file, { mode = 'replace', dryRun = false } = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    formData.append('dryRun', String(dryRun));
    return await request('/routine/upload-file', {
      method: 'POST',
      body: formData
    });
  },

  async batchUpdate(routines, mode = 'replace', roomDetails = null) {
    return await request('/routine/batch-update', {
      method: 'POST',
      body: JSON.stringify({ routines, mode, ...(roomDetails ? { roomDetails } : {}) })
    });
  },

  async getRooms() {
    return await request('/routine/rooms', { method: 'GET' });
  },

  async seed(routines, roomDetails) {
    return await request('/routine/seed', {
      method: 'POST',
      body: JSON.stringify({ routines, roomDetails })
    });
  }
};

export const adminAPI = {
  async getUsers() {
    return await request('/admin/users', { method: 'GET' });
  },

  async assignRole({ targetUserId, newRole }) {
    const data = await request('/admin/assign-role', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, newRole })
    });
    if (data && data.token && data.user) {
      setSession(data.user, data.token);
    }
    return data;
  },

  async bootstrapAdmin() {
    const data = await request('/admin/bootstrap', {
      method: 'POST'
    });
    if (data.token) {
      setSession(data.user, data.token);
    }
    return data;
  }
};
