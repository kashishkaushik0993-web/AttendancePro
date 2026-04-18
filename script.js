

// frontend/script.js
const API_BASE = 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('token');
}

async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE + endpoint, config);
  
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    alert('Session expired. Please login again.');
    window.location.href = 'login.html';
    return null;
  }
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Something went wrong');
  }
  
  return res.json();
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; 
    background: ${type === 'success' ? '#10b981' : '#ef4444'}; 
    color: white; padding: 14px 24px; border-radius: 9999px; 
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2); z-index: 9999;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}