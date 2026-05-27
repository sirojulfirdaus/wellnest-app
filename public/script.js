const API_BASE_URL = window.location.origin;

const state = {
  token: localStorage.getItem('wellnest_token') || '',
  user: JSON.parse(localStorage.getItem('wellnest_user') || 'null'),
  logs: [],
  feedbacks: [],
  healthAlerts: [],
  pendingUsers: [],
  usersSummary: null,
  logsSummary: null,
  curation: null,
  curationError: '',
  mediaPreviewUrl: '',
  userLogFilter: 'all',
  userCustomDate: '',
  adminLogFilter: 'all',
  adminCustomDate: '',
  adminSearchQuery: ''
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

function formatRoleLabel(role) {
  const labels = {
    superadmin: 'Superadmin',
    admin: 'Admin / Doctor / Trainer',
    user: 'User / Patient'
  };

  return labels[role] || role || 'Guest';
}

function renderEmptyState(title, detail = '') {
  return `
    <div class="empty">
      <strong>${escapeHTML(title)}</strong>
      ${detail ? `<p>${escapeHTML(detail)}</p>` : ''}
    </div>
  `;
}

function renderMetaItem(label, value) {
  return `
    <div class="meta-item">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `;
}

function getFeedbacksForLog(logId) {
  return state.feedbacks.filter(item => Number(item.log_id) === Number(logId));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getLogDateValue(log) {
  const value = log.date || log.created_at;

  if (!value) return '';

  const textValue = String(value);
  const dateMatch = textValue.match(/^\d{4}-\d{2}-\d{2}/);

  if (dateMatch) return dateMatch[0];

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '';

  return toDateKey(parsed);
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split('-').map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function isLogWithinFilter(log, filterType, customDate) {
  if (filterType === 'all') return true;

  const logDateKey = getLogDateValue(log);
  const today = new Date();
  const todayKey = toDateKey(today);

  if (!logDateKey) return false;

  if (filterType === 'today') {
    return logDateKey === todayKey;
  }

  if (filterType === 'last7') {
    const logDate = parseDateKey(logDateKey);
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 6);

    return logDate && logDate >= startDate && logDate <= today;
  }

  if (filterType === 'month') {
    return logDateKey.slice(0, 7) === todayKey.slice(0, 7);
  }

  if (filterType === 'custom') {
    return customDate ? logDateKey === customDate : true;
  }

  return true;
}

function filterLogs(logs, filterType, customDate, searchQuery = '') {
  const query = searchQuery.trim().toLowerCase();

  return logs.filter((log) => {
    const matchesDate = isLogWithinFilter(log, filterType, customDate);
    const matchesSearch = !query
      || String(log.user_email || '').toLowerCase().includes(query)
      || String(log.activity_type || '').toLowerCase().includes(query);

    return matchesDate && matchesSearch;
  });
}

function renderLogFilterControls(scope, options) {
  const filterId = `${scope}-log-filter`;
  const customDateId = `${scope}-custom-date`;
  const customWrapId = `${scope}-custom-date-wrap`;
  const searchId = `${scope}-log-search`;
  const isCustom = options.filterType === 'custom';

  return `
    <div class="filter-bar">
      <div class="filter-controls">
        <div class="filter-field">
          <label for="${filterId}">Date Filter</label>
          <select id="${filterId}" onchange="handleLogFilterChange('${scope}', 'filter', this.value)">
            <option value="all" ${options.filterType === 'all' ? 'selected' : ''}>All logs</option>
            <option value="today" ${options.filterType === 'today' ? 'selected' : ''}>Today</option>
            <option value="last7" ${options.filterType === 'last7' ? 'selected' : ''}>Last 7 days</option>
            <option value="month" ${options.filterType === 'month' ? 'selected' : ''}>This month</option>
            <option value="custom" ${isCustom ? 'selected' : ''}>Custom date</option>
          </select>
        </div>

        <div id="${customWrapId}" class="filter-field custom-date-field ${isCustom ? '' : 'is-hidden'}">
          <label for="${customDateId}">Custom Date</label>
          <input id="${customDateId}" type="date" value="${escapeHTML(options.customDate || '')}" onchange="handleLogFilterChange('${scope}', 'customDate', this.value)" />
        </div>

        ${options.includeSearch ? `
          <div class="filter-field filter-search-field">
            <label for="${searchId}">Search</label>
            <input id="${searchId}" type="search" value="${escapeHTML(options.searchQuery || '')}" placeholder="Email or activity" oninput="handleLogFilterChange('${scope}', 'search', this.value)" />
          </div>
        ` : ''}
      </div>

      <span id="${scope}-filter-count" class="filter-count">
        ${renderFilterCount(options.filteredCount, options.totalCount)}
      </span>
    </div>
  `;
}

function renderFilterCount(filteredCount, totalCount) {
  if (totalCount === 0) return 'No logs';

  return `Showing ${filteredCount} of ${totalCount} logs`;
}

function getFilteredAdminLogs() {
  return filterLogs(
    state.logs,
    state.adminLogFilter,
    state.adminCustomDate,
    state.adminSearchQuery
  );
}

function getFilteredUserLogs() {
  return filterLogs(
    state.logs,
    state.userLogFilter,
    state.userCustomDate
  );
}

function renderAdminLogList() {
  const filteredLogs = getFilteredAdminLogs();

  if (state.logs.length === 0) {
    return renderEmptyState('No logs yet', 'User progress logs will appear here after upload.');
  }

  if (filteredLogs.length === 0) {
    return renderEmptyState('No logs match this filter', 'Try changing the date filter or search text.');
  }

  return filteredLogs.map(renderAdminLogCard).join('');
}

function renderUserLogList() {
  const filteredLogs = getFilteredUserLogs();

  if (state.logs.length === 0) {
    return renderEmptyState('No logs yet', 'Your uploaded activity progress will appear here.');
  }

  if (filteredLogs.length === 0) {
    return renderEmptyState('No logs match this filter', 'Try another date range or choose All logs.');
  }

  return filteredLogs.map(renderUserLogCard).join('');
}

function handleLogFilterChange(scope, field, value) {
  if (scope === 'admin') {
    if (field === 'filter') state.adminLogFilter = value;
    if (field === 'customDate') state.adminCustomDate = value;
    if (field === 'search') state.adminSearchQuery = value;
  }

  if (scope === 'user') {
    if (field === 'filter') state.userLogFilter = value;
    if (field === 'customDate') state.userCustomDate = value;
  }

  refreshLogList(scope);
}

function refreshLogList(scope) {
  const list = document.getElementById(`${scope}-log-list`);
  const count = document.getElementById(`${scope}-filter-count`);
  const customDateWrap = document.getElementById(`${scope}-custom-date-wrap`);
  const filterType = scope === 'admin' ? state.adminLogFilter : state.userLogFilter;
  const filteredLogs = scope === 'admin' ? getFilteredAdminLogs() : getFilteredUserLogs();

  if (customDateWrap) {
    customDateWrap.classList.toggle('is-hidden', filterType !== 'custom');
  }

  if (list) {
    list.innerHTML = scope === 'admin' ? renderAdminLogList() : renderUserLogList();
  }

  if (count) {
    count.textContent = renderFilterCount(filteredLogs.length, state.logs.length);
  }
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
  if (!mediaPath) return '<div class="media-empty">No media uploaded</div>';

  const url = `${API_BASE_URL}${mediaPath}`;
  const lower = mediaPath.toLowerCase();

  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return `
      <video class="media-preview" controls preload="metadata">
        <source src="${url}">
        Your browser does not support video preview.
      </video>
    `;
  }

  return `<img class="media-preview" src="${url}" alt="Uploaded progress media" loading="lazy" />`;
}

function renderAuthPage(mode = 'login') {
  const isLogin = mode === 'login';

  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-hero">
        <div class="brand-row">
          <div class="brand-icon">WN</div>
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
        <div class="demo-account">
          <span>Superadmin Approval</span>
          <p>superadmin@wellnest.local / superadmin123</p>
        </div>
        <div class="demo-account">
          <span>Admin / Doctor / Trainer</span>
          <p>admin@wellnest.local / admin123</p>
        </div>
        <div class="demo-account">
          <span>User / Patient</span>
          <p>userdemo@wellnest.local / user123</p>
        </div>
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
  const roleLabel = formatRoleLabel(state.user?.role);

  app.innerHTML = `
    <header class="topbar">
      <div class="brand-row small-brand">
        <div class="brand-icon">WN</div>
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
      <strong>${value ?? '-'}</strong>
    </div>
  `;
}

function getDashboardTitle() {
  if (state.user?.role === 'superadmin') return 'Superadmin Dashboard';
  if (state.user?.role === 'admin') return 'Admin / Doctor / Trainer Dashboard';
  return 'User / Patient Dashboard';
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

async function loadCuration() {
  try {
    const curation = await apiRequest('/api/curation', {
      headers: apiHeaders(false)
    });

    state.curation = curation.data || null;
    state.curationError = '';
  } catch {
    state.curation = null;
    state.curationError = 'Wellness curation is temporarily unavailable.';
  }
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
      ${statCard('Total Users', state.usersSummary.totalUsers ?? '-')}
      ${statCard('Admins', state.usersSummary.totalAdmins ?? '-')}
      ${statCard('Regular Users', state.usersSummary.totalRegularUsers ?? '-')}
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
              <p>Role: <strong>${escapeHTML(formatRoleLabel(user.role))}</strong></p>
              <p class="muted">Registered: ${formatDate(user.created_at)}</p>
            </div>
            <button class="btn primary small-btn" onclick="approveUser(${user.id})">Approve</button>
          </article>
        `).join('') : renderEmptyState('No pending accounts', 'New registrations waiting for approval will appear here.')}
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
  const filteredLogs = getFilteredAdminLogs();

  const content = `
    <section class="page-heading">
      <span class="eyebrow">Admin / Doctor / Trainer</span>
      <h2>${getDashboardTitle()}</h2>
      <p>Review user progress uploads, check media, and add follow-up feedback.</p>
    </section>

    <section class="stats-grid">
      ${statCard('Visible Logs', state.logs.length)}
      ${statCard('Logs with Media', logsWithMedia)}
      ${statCard('Feedbacks', state.feedbacks.length)}
      ${statCard('Health Alerts', state.healthAlerts.length)}
    </section>

    <section class="panel admin-review-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Admin Review</span>
          <h3>User Progress Logs</h3>
          <p>Inspect user progress, media uploads, and submit feedback.</p>
        </div>
      </div>

      ${renderLogFilterControls('admin', {
        filterType: state.adminLogFilter,
        customDate: state.adminCustomDate,
        includeSearch: true,
        searchQuery: state.adminSearchQuery,
        filteredCount: filteredLogs.length,
        totalCount: state.logs.length
      })}

      <div id="admin-log-list" class="list scrollable-list admin-log-list">
        ${renderAdminLogList()}
      </div>
    </section>

    ${renderHealthAlerts()}
  `;

  renderDashboardShell(content);
}

function renderAdminLogCard(log) {
  return `
    <article class="admin-log-card">
      <div class="admin-log-header">
        <div>
          <h4>${escapeHTML(log.activity_type)}</h4>
          <p class="muted">${escapeHTML(log.user_email || 'Unknown user')}</p>
        </div>
        <span class="role-badge">Log #${log.id}</span>
      </div>

      <div class="admin-meta-grid">
        ${renderMetaItem('User Email', log.user_email || 'Unknown user')}
        ${renderMetaItem('Duration', `${log.duration_minutes} minutes`)}
        ${renderMetaItem('Heart Rate', `${log.heart_rate || 'N/A'} bpm`)}
        ${renderMetaItem('Date', formatDate(log.date || log.created_at))}
      </div>

      <div class="media-section">
        <span class="media-label">Media Preview</span>
        <div class="media-box">
          ${renderMedia(log.media_path)}
        </div>
      </div>

      ${log.notes ? `<p class="note-box">${escapeHTML(log.notes)}</p>` : ''}

      ${renderAdminFeedbackHistory(log.id)}

      <form class="feedback-form admin-feedback-form" onsubmit="submitFeedback(event, ${log.id})">
        <div>
          <label>Add Follow-up Feedback</label>
          <p class="helper-text">Multiple feedback entries can be added to the same activity log.</p>
        </div>
        <textarea placeholder="Write a follow-up note for this user..." required></textarea>
        <button class="btn primary small-btn" type="submit">Add Feedback</button>
      </form>
    </article>
  `;
}

function renderAdminFeedbackHistory(logId) {
  const feedbackItems = getFeedbacksForLog(logId);

  return `
    <div class="feedback-history compact">
      <div class="history-heading">
        <strong>Feedback History</strong>
        <span>${feedbackItems.length} ${feedbackItems.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      ${feedbackItems.length ? `
        <div class="feedback-list">
          ${feedbackItems.map(item => `
            <div class="feedback-entry">
              <p>${escapeHTML(item.message)}</p>
              <span class="muted small">By ${escapeHTML(item.admin_email || 'Admin')} - ${formatDate(item.created_at)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<p class="empty compact-empty">No follow-up feedback yet.</p>'}
    </div>
  `;
}

function renderCurationSection() {
  if (state.curationError) {
    return `
      <section class="panel curation-panel">
        <div class="panel-header">
          <div>
            <span class="section-label">Wellness Curation</span>
            <h3>Wellness Curation</h3>
            <p>Personalized lifestyle support based on your recent activity pattern.</p>
          </div>
        </div>
        ${renderEmptyState('Curation unavailable', state.curationError)}
      </section>
    `;
  }

  const curation = state.curation || {
    pattern: 'General Wellness',
    summary: 'Your recent activity pattern is still general, so start with simple wellness support.',
    evidence: {
      totalLogsAnalyzed: 0,
      matchedKeywords: []
    },
    recommendations: []
  };
  const evidence = curation.evidence || {};
  const keywords = evidence.matchedKeywords || [];
  const keywordText = keywords.length ? keywords.join(', ') : 'no specific keywords yet';
  const recommendations = curation.recommendations || [];

  return `
    <section class="panel curation-panel">
      <div class="panel-header curation-header">
        <div>
          <span class="section-label">Wellness Curation</span>
          <h3>Wellness Curation</h3>
          <p>Personalized lifestyle support based on your recent activity pattern.</p>
        </div>
        <span class="pattern-badge">${escapeHTML(curation.pattern || 'General Wellness')}</span>
      </div>

      <p class="curation-summary">${escapeHTML(curation.summary || '')}</p>

      <div class="recommendation-grid">
        ${recommendations.map(item => `
          <article class="recommendation-card">
            <h4>${escapeHTML(item.title)}</h4>
            <p>${escapeHTML(item.reason)}</p>
          </article>
        `).join('')}
      </div>

      <p class="evidence-text">
        Based on ${escapeHTML(evidence.totalLogsAnalyzed ?? 0)} recent logs and keywords: ${escapeHTML(keywordText)}
      </p>
    </section>
  `;
}

async function renderUserDashboard() {
  await Promise.all([
    loadCommonData(),
    loadLogs(),
    loadLogsSummary(),
    loadFeedbacks(),
    loadCuration()
  ]);

  const filteredLogs = getFilteredUserLogs();

  const content = `
    <section class="page-heading">
      <span class="eyebrow">User / Patient</span>
      <h2>${getDashboardTitle()}</h2>
      <p>Upload physical progress and review feedback history from Admin or Trainer.</p>
    </section>

    <section class="stats-grid">
      ${statCard('Total Logs', state.logsSummary?.totalLogs ?? state.logs.length)}
      ${statCard('Total Minutes', state.logsSummary?.totalMinutes ?? 0)}
      ${statCard('Avg Heart Rate', state.logsSummary?.avgHeartRate ?? 'N/A')}
      ${statCard('Health Alerts', state.healthAlerts.length)}
    </section>

    ${renderCurationSection()}

    <section class="content-grid">
      <section class="panel upload-panel">
        <div class="panel-header">
          <div>
            <span class="section-label">Upload Progress</span>
            <h3>Physical Progress Report</h3>
            <p>Submit activity data and optional image/video progress.</p>
          </div>
        </div>

        <form id="upload-form" class="form upload-form">
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
            <input id="media" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" />
            <p class="helper-text">Supported files: JPG, PNG, WEBP, GIF, MP4, WEBM.</p>
          </div>

          <div id="selected-media-preview" class="upload-preview empty-preview">
            <span>No media selected</span>
          </div>

          <div>
            <label>Notes</label>
            <textarea id="notes" placeholder="How did you feel?"></textarea>
          </div>

          <button class="btn primary" type="submit">Submit Progress</button>
        </form>
      </section>

      <section class="panel activity-history-panel">
        <div class="panel-header">
          <div>
            <span class="section-label">My Logs</span>
            <h3>Activity History</h3>
            <p>Your latest progress records.</p>
          </div>
        </div>

        ${renderLogFilterControls('user', {
          filterType: state.userLogFilter,
          customDate: state.userCustomDate,
          filteredCount: filteredLogs.length,
          totalCount: state.logs.length
        })}

        <div id="user-log-list" class="list scrollable-list activity-history-list">
          ${renderUserLogList()}
        </div>
      </section>
    </section>

    <section class="panel feedback-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Feedback History</span>
          <h3>Feedback History</h3>
          <p>Follow-up feedback submitted by Admin or Trainer.</p>
        </div>
      </div>

      <div class="list">
        ${state.feedbacks.length ? state.feedbacks.map(renderUserFeedbackCard).join('') : renderEmptyState('No feedback yet', 'Feedback will appear here after an Admin reviews your logs.')}
      </div>
    </section>

    ${renderHealthAlerts()}
  `;

  renderDashboardShell(content);

  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.valueAsDate = new Date();

  setupUploadPreview();
}

function renderUserLogCard(log) {
  return `
    <article class="item-card vertical log-card user-log-card">
      <div class="log-card-header">
        <div>
          <h4>${escapeHTML(log.activity_type)}</h4>
          <p class="muted">${formatDate(log.date || log.created_at)}</p>
        </div>
      </div>

      <div class="log-meta-grid small-meta-grid">
        ${renderMetaItem('Duration', `${log.duration_minutes} minutes`)}
        ${renderMetaItem('Heart Rate', `${log.heart_rate || 'N/A'} bpm`)}
      </div>

      <div class="media-section">
        <span class="media-label">Media Preview</span>
        <div class="media-box">
          ${renderMedia(log.media_path)}
        </div>
      </div>

      ${log.notes ? `<p class="note-box">${escapeHTML(log.notes)}</p>` : ''}
    </article>
  `;
}

function renderUserFeedbackCard(item) {
  return `
    <article class="feedback-card">
      <div class="feedback-card-header">
        <div>
          <h4>${escapeHTML(item.activity_type || 'Activity Log')}</h4>
          <p class="muted small">Log #${escapeHTML(item.log_id || '-')}</p>
        </div>
        <span class="role-badge">${formatDate(item.created_at)}</span>
      </div>
      <p class="feedback-message">${escapeHTML(item.message)}</p>
      <p class="muted small">From: ${escapeHTML(item.admin_email || 'Admin')}</p>
    </article>
  `;
}

function setupUploadPreview() {
  const mediaInput = document.getElementById('media');
  const preview = document.getElementById('selected-media-preview');

  if (!mediaInput || !preview) return;

  mediaInput.addEventListener('change', () => {
    if (state.mediaPreviewUrl) {
      URL.revokeObjectURL(state.mediaPreviewUrl);
      state.mediaPreviewUrl = '';
    }

    const file = mediaInput.files[0];

    if (!file) {
      preview.className = 'upload-preview empty-preview';
      preview.innerHTML = '<span>No media selected</span>';
      return;
    }

    state.mediaPreviewUrl = URL.createObjectURL(file);
    const safeName = escapeHTML(file.name);

    if (file.type.startsWith('video/')) {
      preview.className = 'upload-preview';
      preview.innerHTML = `
        <video controls preload="metadata" src="${state.mediaPreviewUrl}"></video>
        <span>${safeName}</span>
      `;
      return;
    }

    if (file.type.startsWith('image/')) {
      preview.className = 'upload-preview';
      preview.innerHTML = `
        <img src="${state.mediaPreviewUrl}" alt="Selected media preview" />
        <span>${safeName}</span>
      `;
      return;
    }

    preview.className = 'upload-preview empty-preview';
    preview.innerHTML = `<span>${safeName}</span>`;
  });
}

function renderHealthAlerts() {
  return `
    <section class="panel health-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">Public API</span>
          <h3>Public Health Alerts</h3>
          <p>Latest food safety recalls from OpenFDA.</p>
        </div>
      </div>

      <div class="list health-alert-list">
        ${state.healthAlerts.length ? state.healthAlerts.map(item => `
          <article class="health-alert-card">
            <div class="health-alert-header">
              <h4>${escapeHTML(item.recalling_firm || 'Health Alert')}</h4>
              <span class="date-badge">${formatOpenFDADate(item.report_date)}</span>
            </div>
            <p class="health-alert-reason">${escapeHTML(item.reason_for_recall || 'No reason available.')}</p>
            <span class="status-pill">${escapeHTML(item.status || 'Unknown')}</span>
          </article>
        `).join('') : renderEmptyState('No health alerts available', 'OpenFDA food recall data will appear here when available.')}
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
    if (state.mediaPreviewUrl) {
      URL.revokeObjectURL(state.mediaPreviewUrl);
      state.mediaPreviewUrl = '';
    }
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
