const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const portal = $('#portalShell');
const loginView = $('#loginView');
const dashboardView = $('#dashboardView');
const loginForm = $('#portalLoginForm');
const message = $('#portalMessage');
const apiBase = String(window.NEXTLEVEL_PORTAL_API_URL || '').replace(/\/$/, '');
const sessionKey = 'nextlevel_portal_session';

function openPortal() {
  portal.classList.add('open');
  portal.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#portalUsername')?.focus(), 80);
}

function closePortal() {
  portal.classList.remove('open');
  portal.setAttribute('aria-hidden', 'true');
  message.textContent = '';
}

function initials(name) {
  return String(name || 'NL').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function safe(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function status(value) {
  return `<span class="status">${safe(String(value || 'pending').replaceAll('_', ' '))}</span>`;
}

function empty(text) { return `<div class="empty-state">${safe(text)}</div>`; }

function taskRows(tasks = []) {
  if (!tasks.length) return empty('No task records are available yet.');
  return tasks.slice(-8).reverse().map((task) => `<div class="dash-row"><div><b>${safe(task.title || task.id)}</b><small>${safe(task.id)}${task.dueAt ? ` • Due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</small></div>${status(task.status)}</div>`).join('');
}

function renderOwner(data) {
  const s = data.summary || {};
  return `<div class="dashboard-stats"><article class="dash-stat"><small>ACTIVE ADMINS</small><strong>${Number(s.admins || 0)}</strong></article><article class="dash-stat"><small>MEMBER ACCOUNTS</small><strong>${Number(s.members || 0)}</strong></article><article class="dash-stat"><small>ACTIVE ELITE</small><strong>${Number(s.activeSubscriptions || 0)}</strong></article><article class="dash-stat"><small>PENDING PAYOUTS</small><strong>${Number(s.pendingPayouts || 0)}</strong></article></div><div class="dash-grid"><article class="dash-card"><h3>Recent task activity</h3>${taskRows(data.tasks)}</article><article class="dash-card"><h3>Operations overview</h3><div class="dash-row"><div><b>Open tasks</b><small>Assigned and active</small></div><strong>${Number(s.openTasks || 0)}</strong></div><div class="dash-row"><div><b>For owner review</b><small>Waiting for approval</small></div><strong>${Number(s.reviewTasks || 0)}</strong></div><div class="dash-row"><div><b>Website access</b><small>Full Owner visibility</small></div>${status('protected')}</div></article></div>`;
}

function renderAdmin(data) {
  const tasks = data.tasks || [];
  const completed = tasks.filter((item) => ['completed', 'approved'].includes(item.status)).length;
  const attendanceMinutes = Math.floor((data.attendance || []).reduce((sum, row) => sum + Number(row.accumulatedMs || 0), 0) / 60000);
  return `<div class="dashboard-stats"><article class="dash-stat"><small>MY TASKS</small><strong>${tasks.length}</strong></article><article class="dash-stat"><small>COMPLETED</small><strong>${completed}</strong></article><article class="dash-stat"><small>TASK REWARD</small><strong>₱${Number(data.balances?.taskReward || 0).toFixed(2)}</strong></article><article class="dash-stat"><small>REFERRAL BALANCE</small><strong>₱${Number(data.balances?.referral || 0).toFixed(2)}</strong></article></div><div class="dash-grid"><article class="dash-card"><h3>My assigned tasks</h3>${taskRows(tasks)}</article><article class="dash-card"><h3>My activity</h3><div class="dash-row"><div><b>Recorded duty</b><small>Across recent attendance records</small></div><strong>${attendanceMinutes} min</strong></div><div class="dash-row"><div><b>Submitted reports</b><small>Private admin records</small></div><strong>${(data.reports || []).length}</strong></div><div class="dash-row"><div><b>Password controls</b><small>Available in Discord Admin Panel</small></div>${status('discord')}</div></article></div>`;
}

function renderMember(data) {
  const subscription = data.subscription;
  const topics = data.training?.topics || [];
  const progress = Number(data.training?.progress || 0);
  const credits = Number(data.learningCredits?.balance || 0);
  return `<div class="dashboard-stats"><article class="dash-stat"><small>TRAINING PROGRESS</small><strong>${progress}%</strong></article><article class="dash-stat"><small>LEARNING CREDITS</small><strong>${credits}</strong></article><article class="dash-stat"><small>PLAN</small><strong>${subscription ? 'Elite' : '—'}</strong></article><article class="dash-stat"><small>ACCESS STATUS</small><strong>${subscription ? 'Active' : 'Inactive'}</strong></article></div><div class="dash-grid"><article class="dash-card"><h3>Your training path</h3>${topics.length ? topics.slice(0, 8).map((topic, index) => `<div class="dash-row"><div><b>${safe(topic.title)}</b><small>Module ${String(index + 1).padStart(2, '0')}</small></div>${status('available')}</div>`).join('') : empty('Training topics will appear after the Owner publishes the program.')}</article><article class="dash-card"><h3>Member benefits</h3><div class="dash-row"><div><b>Learning Credits</b><small>Non-cash credits for approved learning benefits</small></div><strong>${credits}/500</strong></div><div class="dash-row"><div><b>Task Reward Points</b><small>Earned only from Owner-approved work</small></div>${status('separate')}</div>${subscription ? `<div class="dash-row"><div><b>Training Elite</b><small>${safe(subscription.id)}</small></div>${status(subscription.status)}</div><div class="dash-row"><div><b>Access until</b><small>Your role expires automatically</small></div><strong>${subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'Active'}</strong></div>` : empty('No active Training Elite subscription.')}</article></div>`;
}

function showDashboard(payload) {
  const { user, dashboard } = payload;
  loginView.hidden = true;
  dashboardView.hidden = false;
  $('#accountName').textContent = user.displayName || user.username;
  $('#accountRole').textContent = `${user.role} • ${user.username}`;
  $('#accountInitials').textContent = initials(user.displayName || user.username);
  $('#dashboardKicker').textContent = `${user.role.toUpperCase()} WORKSPACE`;
  $('#dashboardTitle').textContent = user.role === 'owner' ? 'Owner Dashboard' : user.role === 'admin' ? 'Admin Dashboard' : 'Member Dashboard';
  const labels = user.role === 'owner' ? ['Overview', 'Admins', 'Tasks', 'Subscriptions', 'Payouts'] : user.role === 'admin' ? ['Overview', 'My Tasks', 'My Rewards', 'Referrals', 'Attendance'] : ['Overview', 'My Training', 'Progress', 'Membership'];
  $('#dashboardNav').innerHTML = labels.map((label, index) => `<button class="dash-nav-button ${index === 0 ? 'active' : ''}" type="button"><span>${safe(label)}</span></button>`).join('');
  $('#dashboardContent').innerHTML = user.role === 'owner' ? renderOwner(dashboard) : user.role === 'admin' ? renderAdmin(dashboard) : renderMember(dashboard);
}

async function portalRequest(path, options = {}) {
  if (!apiBase) throw new Error('Final secure connection is not configured yet. Add the public Wispbyte webhook address to config.js.');
  const response = await fetch(`${apiBase}/nextlevel/api/v1${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The secure portal is temporarily unavailable.');
  return data;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = $('#portalSubmit');
  submit.disabled = true;
  message.textContent = 'Checking your secure account…';
  try {
    const data = await portalRequest('/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: $('#portalUsername').value, password: $('#portalPassword').value }) });
    sessionStorage.setItem(sessionKey, data.token);
    $('#portalPassword').value = '';
    message.textContent = '';
    showDashboard(data);
  } catch (error) {
    $('#portalPassword').value = '';
    message.textContent = error.message;
  } finally { submit.disabled = false; }
});

async function restoreSession() {
  const token = sessionStorage.getItem(sessionKey);
  if (!token || !apiBase) return;
  try { showDashboard(await portalRequest('/session', { headers: { authorization: `Bearer ${token}` } })); }
  catch { sessionStorage.removeItem(sessionKey); }
}

$$('[data-open-portal]').forEach((button) => button.addEventListener('click', () => { openPortal(); restoreSession(); }));
$('#portalClose').addEventListener('click', closePortal);
$('#togglePassword').addEventListener('click', () => { const input = $('#portalPassword'); input.type = input.type === 'password' ? 'text' : 'password'; $('#togglePassword').textContent = input.type === 'password' ? 'Show' : 'Hide'; });
$('#portalLogout').addEventListener('click', async () => {
  const token = sessionStorage.getItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  if (token && apiBase) portalRequest('/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  dashboardView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
  message.textContent = 'You have been logged out securely.';
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && portal.classList.contains('open')) closePortal(); });
