/**
 * Advance Manager - API Client Module
 */

window.AMApi = (function () {
  function getBaseUrl() {
    if (window.AuthManager && typeof window.AuthManager.getApiBaseUrl === 'function') {
      return window.AuthManager.getApiBaseUrl();
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8787';
    }
    return window.location.origin;
  }

  function getHeaders() {
    if (window.AuthManager && typeof window.AuthManager.getAuthHeaders === 'function') {
      return window.AuthManager.getAuthHeaders();
    }
    const token = localStorage.getItem('omnibox_auth_token') || localStorage.getItem('hostcalculator_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function request(endpoint, options = {}) {
    const url = `${getBaseUrl()}${endpoint}`;
    const opts = {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, opts);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        const errorMsg = (data.error && data.error.message) || data.error || '请求执行失败';
        throw new Error(errorMsg);
      }
      return data.data !== undefined ? data.data : data;
    } catch (err) {
      console.error(`[AMApi] Error requesting ${endpoint}:`, err);
      throw err;
    }
  }

  return {
    getDashboard: () => request('/api/advancemanager/dashboard'),
    getPersons: () => request('/api/advancemanager/persons'),
    createPerson: (payload) => request('/api/advancemanager/persons', { method: 'POST', body: JSON.stringify(payload) }),
    updatePerson: (id, payload) => request(`/api/advancemanager/persons/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    getPersonDetail: (id) => request(`/api/advancemanager/persons/${id}`),
    getExpenses: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/advancemanager/expenses${qs ? '?' + qs : ''}`);
    },
    createExpense: (payload) => request('/api/advancemanager/expenses', { method: 'POST', body: JSON.stringify(payload) }),
    getExpenseDetail: (id) => request(`/api/advancemanager/expenses/${id}`),
    deleteExpense: (id) => request(`/api/advancemanager/expenses/${id}`, { method: 'DELETE' }),
    getSettlements: () => request('/api/advancemanager/settlements'),
    createSettlement: (payload) => request('/api/advancemanager/settlements', { method: 'POST', body: JSON.stringify(payload) }),
    getCategories: () => request('/api/advancemanager/categories'),
    getProjects: () => request('/api/advancemanager/projects'),
    createProject: (payload) => request('/api/advancemanager/projects', { method: 'POST', body: JSON.stringify(payload) }),
    updateProject: (id, payload) => request(`/api/advancemanager/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    getProjectDetail: (id) => request(`/api/advancemanager/projects/${id}`),
    cleanupSettledHistory: () => request('/api/advancemanager/cleanup', { method: 'POST' }),
    togglePersonFavourite: (id) => request(`/api/advancemanager/persons/${id}/toggle-favourite`, { method: 'POST' })
  };
})();
