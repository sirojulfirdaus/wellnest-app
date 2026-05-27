const API_BASE_URL = window.location.origin;

const state = {
  token: localStorage.getItem('wellnest_token') || '',
  user: JSON.parse(localStorage.getItem('wellnest_user') || 'null'),
  logs: [],
  feedbacks: [],
  healthAlerts: [],
  pendingUsers: [],
  usersSummary: null,
  logsSummary: null
};

const app = document.getElementById('app');

function apiHeaders(isJson = true) {
  const headers = {};

  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Request failed.');
  }

  return data;
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;

  localStorage.setItem('wellnest_token', token);
  localStorage.setItem('wellnest_user', JSON.stringify(user));
}

function clearSession() {
  state.token = '';
  state.user = null;

  localStorage.removeItem('wellnest_token');
  localStorage.removeItem('wellnest_user');
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'No date';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatOpenFDADate(value) {
  if (!value || value.length !== 8) return 'No date';

  const formatted = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return formatDate(formatted);
}

function showMessage(message, type = 'success') {
  const box = document.getElementById('message-box');

  if (!box) {
    alert(message);
    return;
  }

  box.textContent = message;
  box.className = `message-box ${type}`;
  box.style.display = 'block';

  setTimeout(() => {
    box.style.display = 'none';
  }, 4500);
}

function renderMedia(mediaPath) {
  if (!mediaPath) return '<span class="muted">No media uploaded</span>';

  const url = `${API_BASE_URL}${mediaPath}`;
  const lower = mediaPath.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return `
      <video class="media-preview" controls>
        <source src="${url}">
        Your browser does not support video preview.
      </video>
    `;
  }

  return `<img class="media-preview" src="${url}" alt="Uploaded progress media" />`;
}

function renderAuthPage(mode = 'login') {
  const isLogin = mode === 'login';

  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-hero">
        <div class="brand-row">
          <div class="brand-icon">✦</div>
          <div>
            <h1>WellNest</h1>
            <p>Health & Wellbeing Platform</p>
          </div>
        </div>

        <div class="hero-copy">
          <span class="eyebrow">Assignment 2 Upgrade</span>
          <h2>Multi-user health tracking with role-based access.</h2>
          <p>
            WellNest now supports account approval, user progress uploads,
            admin feedback, and public health alerts through an integrated backend API.
          </p>
        </div>

        <div class="feature-grid">
          <div>RBAC Login</div>
          <div>Progress Upload</div>
          <div>Admin Feedback</div>
          <div>OpenFDA Alerts</div>
        </div>
      </section>

      <section class="auth-card">
        <div class="auth-tabs">
          <button class="${isLogin ? 'active' : ''}" onclick="renderAuthPage('login')">Login</button>
          <button class="${!isLogin ? 'active' : ''}" onclick="renderAuthPage('register')">Register</button>
        </div>

        <div id="message-box" class="message-box"></div>

        ${isLogin ? renderLoginForm() : renderRegisterForm()}
      </section>
    </main>
  `;
}

function renderLoginForm() {
  return `
    <form id="login-form" class="form">
      <div>
        <label>Email</label>
        <input type="email" id="login-email" placeholder="superadmin@wellnest.local" required />
      </div>

      <div>
        <label>Password</label>
        <input type="password" id="login-password" placeholder="Enter your password" required />
      </div>

      <button type="submit" class="btn primary">Login</button>

      <div class="demo-box">
        <strong>Demo Accounts</strong>
        <p>Superadmin: superadmin@wellnest.local / superadmin123</p>
        <p>Admin: admin@wellnest.local / admin123</p>
      </div>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-form" class="form">
      <div>
        <label>Email</label>
        <input type="email" id="register-email" placeholder="user@example.com" required />
      </div>

      <div>
        <label>Password</label>
        <input type="password" id="register-password" placeholder="Create password" required />
      </div>

      <div>
        <label>Role</label>
        <select id="register-role" required>
          <option value="user">User / Patient</option>
          <option value="admin">Admin / Doctor / Trainer</option>
        </select>
      </div>

      <button type="submit" class="btn primary">Create Account</button>

      <p class="muted small">
        New accounts must be approved by the Superadmin before they can login.
      </p>
    </form>
  `;
}

function renderDashboardShell(content) {
  const roleLabel = state.user?.role || 'guest';

  app.innerHTML = `
    <header class="topbar">
      <div class="brand-row small-brand">
        <div class="brand-icon">✦</div>
        <div>
          <h1>WellNest</h1>
          <p>Health & Wellbeing Platform</p>
        </div>
      </div>

      <div class="topbar-actions">
        <span class="role-badge">${escapeHTML(roleLabel)}</span>
        <span class="user-email">${escapeHTML(state.user?.email || '')}</span>
        <button class="btn ghost" onclick="handleLogout()">Logout</button>
      </div>
    </header>

    <main class="dashboard">
      <div id="message-box" class="message-box"></div>
      ${content}
    </main>
  `;
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <span>${label}</span>
      <strong>${value ?? '—'}</strong>
    </div>
  `;
}

function getDashboardTitle() {
  if (state.user?.role === 'superadmin') return 'Superadmin Dashboard';
  if (state.user?.role === 'admin') return 'Admin Review Dashboard';
  return 'User Progress Dashboard';
}

async function loadCommonData() {
  try {
    const health = await apiRequest('/api/health-info');
    state.healthAlerts = health.data || [];
  } catch {
    state.healthAlerts = [];
  }
}

async function loadLogs() {
  const logs = await apiRequest('/api/logs', {
    headers: apiHeaders(false)
  });

  state.logs = logs.data || [];
}

async function loadLogsSummary() {
  const summary = await apiRequest('/api/logs/summary', {
    headers: apiHeaders(false)
  });

  state.logsSummary = summary.data || {};
}

async function loadFeedbacks() {
  const feedbacks = await apiRequest('/api/feedbacks', {
    headers: apiHeaders(false)
  });

  state.feedbacks = feedbacks.data || [];
}

async function renderDashboard() {
  if (!state.user) {
    renderAuthPage('login');
    return;
  }

  if (state.user.role === 'superadmin') {
    await renderSuperadminDashboard();
  } else if (state.user.role === 'admin') {
    await renderAdminDashboard();
  } else {
    await renderUserDashboard();
  }
}

async function renderSuperadminDashboard() {
  await loadCommonData();

  try {
    const pending = await apiRequest('/api/users/pending', {
      headers: apiHeaders(false)
    });

    state.pendingUsers = pending.data || [];
  } catch (error) {
    state.pendingUsers = [];
  }

  try {
    const summary = await apiRequest('/api/users/summary', {
      headers: apiHeaders(false)
    });

    state.usersSummary = summary.data || {};
  } catch {
    state.usersSummary = {};
  }

  const content = `
    <section class="page-heading">
      <span class="eyebrow">Access Control</span>
      <h2>${getDashboardTitle()}</h2>
      <p>Approve registered accounts before users can access the platform.</p>
    </section>

    <section class="stats-grid">
      ${statCard('Pending Accounts', state.usersSummary.pendingUsers ?? state.pendingUsers.length)}
      ${statCard('Total Users', state.usersSummary.totalUsers ?? '—')}
      ${statCard('Admins', state.usersSummary.totalAdmins ?? '—')}
      ${statCard('Regular Users', state.usersSummary.totalRegularUsers ?? '—')}
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Superadmin</span>
          <h3>Pending Account Approval</h3>
          <p>Accounts below cannot login until approved.</p>
        </div>
      </div>

      <div class="list">
        ${state.pendingUsers.length ? state.pendingUsers.map(user => `
          <article class="item-card">
            <div>
              <h4>${escapeHTML(user.email)}</h4>
              <p>Role: <strong>${escapeHTML(user.role)}</strong></p>
              <p class="muted">Registered: ${formatDate(user.created_at)}</p>
            </div>
            <button class="btn primary small-btn" onclick="approveUser(${user.id})">Approve</button>
          </article>
        `).join('') : '<p class="empty">No pending accounts.</p>'}
      </div>
    </section>

    ${renderHealthAlerts()}
  `;

  renderDashboardShell(content);
}

async function renderAdminDashboard() {
  await Promise.all([
    loadCommonData(),
    loadLogs(),
    loadLogsSummary(),
    loadFeedbacks()
  ]);

  const logsWithMedia = state.logs.filter(log => log.media_path).length;

  const content = `
    <section class="page-heading">
      <span class="eyebrow">Producer Role</span>
      <h2>${getDashboardTitle()}</h2>
      <p>Review user progress uploads and provide health or fitness feedback.</p>
    </section>

    <section class="stats-grid">
      ${statCard('Visible Logs', state.logs.length)}
      ${statCard('Logs with Media', logsWithMedia)}
      ${statCard('Feedbacks', state.feedbacks.length)}
      ${statCard('Health Alerts', state.healthAlerts.length)}
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Admin Review</span>
          <h3>User Progress Logs</h3>
          <p>Inspect user progress, media uploads, and submit feedback.</p>
        </div>
      </div>

      <div class="list">
        ${state.logs.length ? state.logs.map(renderAdminLogCard).join('') : '<p class="empty">No user logs available.</p>'}
      </div>
    </section>

    ${renderHealthAlerts()}
  `;

  renderDashboardShell(content);
}

function renderAdminLogCard(log) {
  return `
    <article class="item-card vertical">
      <div class="item-top">
        <div>
          <h4>${escapeHTML(log.activity_type)}</h4>
          <p class="muted">User: ${escapeHTML(log.user_email || 'Unknown user')}</p>
          <p>${escapeHTML(log.duration_minutes)} minutes · Heart rate: ${escapeHTML(log.heart_rate || 'N/A')} bpm · ${formatDate(log.date || log.created_at)}</p>
        </div>
        <span class="role-badge">Log #${log.id}</span>
      </div>

      <div class="media-box">
        ${renderMedia(log.media_path)}
      </div>

      ${log.notes ? `<p class="note-box">${escapeHTML(log.notes)}</p>` : ''}

      <form class="feedback-form" onsubmit="submitFeedback(event, ${log.id})">
        <textarea placeholder="Write feedback for this user..." required></textarea>
        <button class="btn primary small-btn" type="submit">Submit Feedback</button>
      </form>
    </article>
  `;
}

async function renderUserDashboard() {
  await Promise.all([
    loadCommonData(),
    loadLogs(),
    loadLogsSummary(),
    loadFeedbacks()
  ]);

  const content = `
    <section class="page-heading">
      <span class="eyebrow">Consumer Role</span>
      <h2>${getDashboardTitle()}</h2>
      <p>Upload your physical progress and view feedback from Admin.</p>
    </section>

    <section class="stats-grid">
      ${statCard('Total Logs', state.logsSummary?.totalLogs ?? state.logs.length)}
      ${statCard('Total Minutes', state.logsSummary?.totalMinutes ?? 0)}
      ${statCard('Avg Heart Rate', state.logsSummary?.avgHeartRate ?? 'N/A')}
      ${statCard('Health Alerts', state.healthAlerts.length)}
    </section>

    <section class="content-grid">
      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="section-label">Upload Progress</span>
            <h3>Physical Progress Report</h3>
            <p>Submit activity data and optional image/video progress.</p>
          </div>
        </div>

        <form id="upload-form" class="form">
          <div>
            <label>Activity Type</label>
            <input id="activity_type" type="text" placeholder="Gym, Running, Home Workout" required />
          </div>

          <div class="form-row">
            <div>
              <label>Duration Minutes</label>
              <input id="duration_minutes" type="number" min="1" placeholder="45" required />
            </div>

            <div>
              <label>Heart Rate</label>
              <input id="heart_rate" type="number" min="1" placeholder="140" />
            </div>
          </div>

          <div>
            <label>Date</label>
            <input id="date" type="date" />
          </div>

          <div>
            <label>Progress Media</label>
            <input id="media" type="file" accept="image/*,video/mp4,video/webm" />
          </div>

          <div>
            <label>Notes</label>
            <textarea id="notes" placeholder="How did you feel?"></textarea>
          </div>

          <button class="btn primary" type="submit">Submit Progress</button>
        </form>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="section-label">My Logs</span>
            <h3>Activity History</h3>
            <p>Your latest progress records.</p>
          </div>
        </div>

        <div class="list">
          ${state.logs.length ? state.logs.map(renderUserLogCard).join('') : '<p class="empty">No progress logs yet.</p>'}
        </div>
      </section>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Admin Feedback</span>
          <h3>Feedback for You</h3>
          <p>Evaluation submitted by Admin or Trainer.</p>
        </div>
      </div>

      <div class="list">
        ${state.feedbacks.length ? state.feedbacks.map(item => `
          <article class="item-card">
            <div>
              <h4>${escapeHTML(item.activity_type)}</h4>
              <p>${escapeHTML(item.message)}</p>
              <p class="muted">From: ${escapeHTML(item.admin_email || 'Admin')} · ${formatDate(item.created_at)}</p>
            </div>
          </article>
        `).join('') : '<p class="empty">No feedback yet.</p>'}
      </div>
    </section>

    ${renderHealthAlerts()}
  `;

  renderDashboardShell(content);

  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.valueAsDate = new Date();
}

function renderUserLogCard(log) {
  return `
    <article class="item-card vertical">
      <div class="item-top">
        <div>
          <h4>${escapeHTML(log.activity_type)}</h4>
          <p>${escapeHTML(log.duration_minutes)} minutes · Heart rate: ${escapeHTML(log.heart_rate || 'N/A')} bpm</p>
          <p class="muted">${formatDate(log.date || log.created_at)}</p>
        </div>
      </div>

      <div class="media-box">
        ${renderMedia(log.media_path)}
      </div>

      ${log.notes ? `<p class="note-box">${escapeHTML(log.notes)}</p>` : ''}
    </article>
  `;
}

function renderHealthAlerts() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Public API</span>
          <h3>Public Health Alerts</h3>
          <p>Latest food safety recalls from OpenFDA.</p>
        </div>
      </div>

      <div class="list">
        ${state.healthAlerts.length ? state.healthAlerts.map(item => `
          <article class="item-card vertical">
            <div class="item-top">
              <h4>${escapeHTML(item.recalling_firm || 'Health Alert')}</h4>
              <span class="role-badge">${formatOpenFDADate(item.report_date)}</span>
            </div>
            <p>${escapeHTML(item.reason_for_recall || 'No reason available.')}</p>
            <span class="status-pill">${escapeHTML(item.status || 'Unknown')}</span>
          </article>
        `).join('') : '<p class="empty">No public health alerts available.</p>'}
      </div>
    </section>
  `;
}

async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiRequest('/api/login', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ email, password })
    });

    saveSession(data.token, data.user);
    await renderDashboard();
  } catch (error) {
    const message = error.message.includes('pending')
      ? 'Your account is still pending approval by the Superadmin.'
      : error.message;

    showMessage(message, 'error');
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const role = document.getElementById('register-role').value;

  try {
    const data = await apiRequest('/api/register', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({ email, password, role })
    });

    showMessage(data.message || 'Registration successful. Please wait for approval.', 'success');

    setTimeout(() => {
      renderAuthPage('login');
    }, 1800);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function approveUser(id) {
  try {
    const data = await apiRequest(`/api/users/${id}/approve`, {
      method: 'PATCH',
      headers: apiHeaders(false)
    });

    showMessage(data.message || 'User approved.', 'success');
    await renderSuperadminDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleUpload(event) {
  event.preventDefault();

  const formData = new FormData();
  const mediaInput = document.getElementById('media');

  formData.append('activity_type', document.getElementById('activity_type').value.trim());
  formData.append('duration_minutes', document.getElementById('duration_minutes').value);
  formData.append('heart_rate', document.getElementById('heart_rate').value);
  formData.append('date', document.getElementById('date').value);
  formData.append('notes', document.getElementById('notes').value.trim());

  if (mediaInput.files[0]) {
    formData.append('media', mediaInput.files[0]);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed.');
    }

    showMessage('Progress uploaded successfully.', 'success');
    await renderUserDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function submitFeedback(event, logId) {
  event.preventDefault();

  const textarea = event.target.querySelector('textarea');
  const message = textarea.value.trim();

  try {
    const data = await apiRequest('/api/feedbacks', {
      method: 'POST',
      headers: apiHeaders(true),
      body: JSON.stringify({
        log_id: logId,
        message
      })
    });

    textarea.value = '';
    showMessage(data.message || 'Feedback submitted.', 'success');
    await renderAdminDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function handleLogout() {
  clearSession();
  renderAuthPage('login');
}

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'login-form') {
    await handleLogin(event);
  }

  if (event.target.id === 'register-form') {
    await handleRegister(event);
  }

  if (event.target.id === 'upload-form') {
    await handleUpload(event);
  }
});

if (state.user && state.token) {
  renderDashboard();
} else {
  renderAuthPage('login');
}
