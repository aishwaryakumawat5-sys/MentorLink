/**
 * MentorLink — Frontend JavaScript Application
 * Vanilla JS with Fetch API, In-app Toasts, Modals, and Modular Dashboard.
 */

// Global State
const MentorLink = {
  currentUser: null,
  csrfToken: "",
  activePartnerId: null,
  activeTab: "overview",
  chatPollInterval: null,
};

// ==========================================
// Initialization & Utility Helpers
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Grab CSRF token from meta tag
  const metaCsrf = document.querySelector('meta[name="csrf-token"]');
  if (metaCsrf) {
    MentorLink.csrfToken = metaCsrf.getAttribute("content");
  }

  // Bind close buttons for modals
  document.querySelectorAll(".modal-close-btn, [data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-backdrop");
      if (modal) closeModal(modal.id);
    });
  });

  // Close modals on clicking backdrop
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });

  // ESC key closes any open modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModalElem = document.querySelector(".modal-backdrop.open");
      if (openModalElem) closeModal(openModalElem.id);
    }
  });

  // Check if we are on dashboard page
  if (document.getElementById("dashboard-root")) {
    initDashboard();
  }
});

/**
 * Navigate to relevant dashboard tab based on feature card and user role
 */
function goToFeature(feature) {
  let target = "overview";
  const user = MentorLink.currentUser;
  const role = user ? user.role : null;

  if (feature === "matching") {
    if (role === "admin") target = "matching";
    else if (role === "mentor") target = "mentees";
    else if (role === "mentee") target = "mentor";
    else target = "overview";
  } else if (feature === "skills") {
    target = "skills";
  } else if (feature === "roadmap") {
    target = "roadmap";
  } else if (feature === "signals") {
    target = role === "mentee" ? "overview" : "signals";
  } else if (feature === "impact") {
    target = "impact";
  } else if (feature === "meetings") {
    target = "meetings";
  } else if (feature === "tasks") {
    target = "tasks";
  } else if (feature === "messages") {
    target = "messages";
  } else if (feature === "feedback") {
    target = "feedback";
  } else if (feature === "profile") {
    target = "profile";
  }
  window.location.href = `/dashboard#${target}`;
}

/**
 * Enhanced Fetch API wrapper with JSON and CSRF handling.
 */
async function apiFetch(url, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
    "X-CSRF-Token": MentorLink.csrfToken,
  };

  options.headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error("API Fetch Error:", err);
    throw err;
  }
}

// ==========================================
// In-App Toast Notification System
// ==========================================

function showToast(title, message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  toast.innerHTML = `
    <div style="font-weight:bold; font-size:1.1rem; color:inherit;">${iconMap[type] || "•"}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => removeToast(toast));

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
}

function removeToast(toast) {
  toast.style.opacity = "0";
  toast.style.transform = "translateX(20px)";
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 200);
}

// ==========================================
// Modal Helpers & Confirmation Dialog
// ==========================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("open");
  }
}

/**
 * Standard confirmation modal replacement for window.confirm()
 */
function showConfirmModal(title, message, onConfirm) {
  let confirmModal = document.getElementById("confirm-modal");
  if (!confirmModal) {
    confirmModal = document.createElement("div");
    confirmModal.id = "confirm-modal";
    confirmModal.className = "modal-backdrop";
    confirmModal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title" id="confirm-modal-title">Confirm Action</h3>
          <button class="modal-close-btn" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" id="confirm-modal-body">
          Are you sure you want to proceed?
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-close-modal>Cancel</button>
          <button class="btn btn-danger" id="confirm-modal-btn">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmModal);

    confirmModal.querySelectorAll("[data-close-modal]").forEach((b) => {
      b.addEventListener("click", () => closeModal("confirm-modal"));
    });
  }

  document.getElementById("confirm-modal-title").innerText = title;
  document.getElementById("confirm-modal-body").innerText = message;

  const confirmBtn = document.getElementById("confirm-modal-btn");
  // Replace button to remove old listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener("click", () => {
    closeModal("confirm-modal");
    if (typeof onConfirm === "function") {
      onConfirm();
    }
  });

  openModal("confirm-modal");
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// Authentication Handlers
// ==========================================

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const submitBtn = form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.innerText = "Signing in...";

  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    showToast("Success", res.message || "Login successful!", "success");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 500);
  } catch (err) {
    showToast("Login Failed", err.message, "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "Sign In";
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirm_password.value;
  const role = form.role.value;
  const department = form.department.value.trim();
  const skills = form.skills.value.trim();
  const interests = form.interests.value.trim();
  const bio = form.bio.value.trim();
  const submitBtn = form.querySelector('button[type="submit"]');

  if (password !== confirmPassword) {
    showToast("Validation Error", "Passwords do not match.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Creating Account...";

  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        department,
        skills,
        interests,
        bio,
      }),
    });

    showToast("Account Created", "Welcome to MentorLink!", "success");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600);
  } catch (err) {
    showToast("Registration Failed", err.message, "error");
    submitBtn.disabled = false;
    submitBtn.innerText = "Create Account";
  }
}

async function handleLogout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  } catch (err) {
    window.location.href = "/login";
  }
}

function quickFillLogin(email, password) {
  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-password");
  if (emailInput && passInput) {
    emailInput.value = email;
    passInput.value = password;
    showToast("Demo Selected", `Filled login credentials for ${email}`, "info", 1500);
  }
}

/**
 * 1-Click Instant Login for demo buttons on landing page & login screen
 */
async function instantLogin(email, password) {
  showToast("Signing In...", `Authenticating as ${email}`, "info", 1500);
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    showToast("Welcome Back!", res.message || "Logged in successfully!", "success", 2000);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 400);
  } catch (err) {
    showToast("Sign In Failed", err.message, "error");
  }
}

// ==========================================
// Notifications System
// ==========================================

async function loadNotifications() {
  try {
    const res = await apiFetch("/api/notifications");
    const badge = document.getElementById("notif-unread-badge");
    const list = document.getElementById("notif-dropdown-list");

    if (badge) {
      if (res.unread_count > 0) {
        badge.innerText = res.unread_count;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }

    if (list) {
      if (res.notifications.length === 0) {
        list.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">No notifications yet.</div>`;
        return;
      }

      list.innerHTML = res.notifications
        .map(
          (n) => `
        <div class="notif-item ${n.is_read ? "read" : "unread"}" onclick="markNotificationRead(${n.id})">
          <div style="font-weight:700; font-size:0.85rem; color:var(--text-main);">${escapeHtml(n.title)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(n.message)}</div>
          <div style="font-size:0.7rem; color:var(--text-light); margin-top:4px;">${n.created_at}</div>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Failed to load notifications:", err);
  }
}

async function markNotificationRead(id) {
  try {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PUT" });
    loadNotifications();
  } catch (err) {
    console.error(err);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiFetch("/api/notifications/read-all", { method: "PUT" });
    loadNotifications();
    showToast("Notifications", "All marked as read.", "info");
  } catch (err) {
    console.error(err);
  }
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById("notif-dropdown-menu");
  if (dropdown) {
    const isOpen = dropdown.style.display === "block";
    dropdown.style.display = isOpen ? "none" : "block";
    if (!isOpen) loadNotifications();
  }
}

// ==========================================
// Dashboard Controller
// ==========================================

async function initDashboard() {
  try {
    const res = await apiFetch("/api/auth/me");
    MentorLink.currentUser = res.user;
    MentorLink.extra = res.extra || {};
    MentorLink.csrfToken = res.csrf_token || MentorLink.csrfToken;

    renderUserHeader();
    setupDashboardTabs();
    loadNotifications();

    // Check if URL specifies a hash tab (e.g. /dashboard#meetings)
    const hashTab = (window.location.hash || "").replace("#", "");
    const initialTab = hashTab && document.getElementById(`tab-${hashTab}`) ? hashTab : "overview";
    switchTab(initialTab);

    // Poll notifications every 30 seconds
    setInterval(loadNotifications, 30000);
  } catch (err) {
    console.error("Dashboard init error:", err);
    window.location.href = "/login";
  }
}

function renderUserHeader() {
  const u = MentorLink.currentUser;
  const nameDisplay = document.getElementById("dash-user-name");
  const roleDisplay = document.getElementById("dash-user-role");
  const deptDisplay = document.getElementById("dash-user-dept");
  const avatarDisplay = document.getElementById("dash-user-avatar");

  if (nameDisplay) nameDisplay.innerText = u.name;
  if (deptDisplay) deptDisplay.innerText = u.department || "No department specified";
  if (avatarDisplay) avatarDisplay.innerText = u.name.charAt(0).toUpperCase();

  if (roleDisplay) {
    roleDisplay.className = `badge badge-${u.role}`;
    roleDisplay.innerText = u.role.toUpperCase();
  }
}

function setupDashboardTabs() {
  const role = MentorLink.currentUser.role;
  const navContainer = document.getElementById("dashboard-nav-items");
  if (!navContainer) return;

  let tabs = [];
  if (role === "admin") {
    tabs = [
      { id: "overview", label: "📊 Overview", icon: "overview" },
      { id: "users", label: "👥 Users Directory", icon: "users" },
      { id: "matching", label: "🤝 Smart Matching", icon: "matching" },
      { id: "signals", label: "🚨 Support Signals", icon: "signals" },
      { id: "impact", label: "📈 Impact Analytics", icon: "impact" },
      { id: "meetings", label: "📅 All Meetings", icon: "meetings" },
      { id: "tasks", label: "📋 All Tasks", icon: "tasks" },
      { id: "feedback", label: "⭐ Reviews & Feedback", icon: "feedback" },
      { id: "profile", label: "⚙️ My Profile", icon: "profile" },
    ];
  } else if (role === "mentor") {
    tabs = [
      { id: "overview", label: "📊 Overview", icon: "overview" },
      { id: "mentees", label: "🎓 My Mentees", icon: "mentees" },
      { id: "roadmap", label: "🗺️ Adaptive Roadmap", icon: "roadmap" },
      { id: "skills", label: "🔍 Skill Detective", icon: "skills" },
      { id: "signals", label: "🚨 Support Alerts", icon: "signals" },
      { id: "impact", label: "📈 Impact Analytics", icon: "impact" },
      { id: "meetings", label: "📅 Meetings", icon: "meetings" },
      { id: "tasks", label: "📋 Task Assignments", icon: "tasks" },
      { id: "messages", label: "💬 Mentee Chat", icon: "messages" },
      { id: "feedback", label: "⭐ Reviews & Ratings", icon: "feedback" },
      { id: "profile", label: "⚙️ My Profile", icon: "profile" },
    ];
  } else if (role === "mentee") {
    tabs = [
      { id: "overview", label: "📊 Overview", icon: "overview" },
      { id: "mentor", label: "🧑‍🏫 My Mentor", icon: "mentor" },
      { id: "roadmap", label: "🗺️ Adaptive Roadmap", icon: "roadmap" },
      { id: "skills", label: "🔍 AI Skill Detective", icon: "skills" },
      { id: "impact", label: "📈 Growth Impact", icon: "impact" },
      { id: "meetings", label: "📅 My Meetings", icon: "meetings" },
      { id: "tasks", label: "📋 My Tasks", icon: "tasks" },
      { id: "messages", label: "💬 Mentor Chat", icon: "messages" },
      { id: "feedback", label: "⭐ Ratings & Feedback", icon: "feedback" },
      { id: "profile", label: "⚙️ My Profile", icon: "profile" },
    ];
  }

  navContainer.innerHTML = tabs
    .map(
      (t) => `
    <li>
      <button class="dash-nav-item ${t.id === "overview" ? "active" : ""}" data-tab="${t.id}" onclick="switchTab('${t.id}')">
        <span>${t.label}</span>
      </button>
    </li>
  `
    )
    .join("");
}

function switchTab(tabId) {
  if (!document.getElementById(`tab-${tabId}`)) {
    tabId = "overview";
  }
  MentorLink.activeTab = tabId;
  window.history.replaceState(null, null, `#${tabId}`);

  // Stop chat polling if leaving messages tab
  if (tabId !== "messages" && MentorLink.chatPollInterval) {
    clearInterval(MentorLink.chatPollInterval);
    MentorLink.chatPollInterval = null;
  }

  // Update nav buttons
  document.querySelectorAll(".dash-nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });

  // Update tab panes
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.remove("active");
  });

  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) {
    activePane.classList.add("active");
  }

  // Trigger data loader for the active tab
  loadTabData(tabId);
}

function loadTabData(tabId) {
  const role = MentorLink.currentUser.role;

  switch (tabId) {
    case "overview":
      loadOverviewStats();
      break;
    case "users":
      if (role === "admin") loadAdminUsers();
      break;
    case "matching":
      if (role === "admin") loadAdminMatchingCenter();
      break;
    case "mentees":
      if (role === "mentor") loadMentorMentees();
      break;
    case "mentor":
      if (role === "mentee") loadMenteeMentor();
      break;
    case "skills":
      loadSkillsTab();
      break;
    case "roadmap":
      loadRoadmapTab();
      break;
    case "signals":
      loadSupportSignalsTab();
      break;
    case "impact":
      loadImpactTab();
      break;
    case "meetings":
      loadMeetingsTab();
      break;
    case "tasks":
      loadTasksTab();
      break;
    case "messages":
      loadMessagesTab();
      break;
    case "feedback":
      loadFeedbackTab();
      break;
    case "profile":
      loadProfileTab();
      break;
  }
}

// ==========================================
// 1. Overview Tab
// ==========================================

async function loadOverviewStats() {
  try {
    const [statsRes, meetingsRes, tasksRes, feedbackRes, signalsRes] = await Promise.all([
      apiFetch("/api/dashboard/stats"),
      apiFetch("/api/meetings").catch(() => ({ meetings: [] })),
      apiFetch("/api/tasks").catch(() => ({ tasks: [] })),
      apiFetch("/api/feedback").catch(() => ({ feedback: [] })),
      apiFetch("/api/support-signals").catch(() => ({ signals: [] })),
    ]);

    const container = document.getElementById("tab-overview-content");
    if (!container) return;

    const u = MentorLink.currentUser;
    const meetings = meetingsRes.meetings || [];
    const tasks = tasksRes.tasks || [];
    const feedbackList = feedbackRes.feedback || [];
    const activeSignals = (signalsRes && signalsRes.signals) || [];

    const signalBannerHtml = activeSignals.length > 0 ? `
      <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fca5a5; border-left: 5px solid #dc2626; border-radius: var(--radius-md); padding: 1.15rem 1.5rem; margin-bottom: 1.75rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm); flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; align-items:center; gap:0.85rem;">
          <div style="font-size:1.75rem;">🚨</div>
          <div>
            <div style="font-weight:800; font-size:1.05rem; color:#991b1b;">
              Early Support Signal Engine Alert: ${activeSignals.length} Active Issue${activeSignals.length === 1 ? '' : 's'} Requiring Action
            </div>
            <div style="font-size:0.85rem; color:#7f1d1d; margin-top:2px;">
              Declining student performance, missed milestone assignments, or inactivity detected.
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="switchTab('signals')" style="background:#dc2626; font-weight:700;">
          Review & Resolve Signals &rarr;
        </button>
      </div>
    ` : '';

    if (statsRes.role === "admin") {
      const s = statsRes.stats;
      container.innerHTML = `
        <!-- Welcome Hero Banner -->
        <div class="welcome-hero-banner">
          <div class="welcome-hero-content">
            <div class="welcome-hero-text">
              <h2>👑 Platform Administration Center</h2>
              <p>Monitor platform health, match faculty mentors with students, and oversee academic mentorship operations.</p>
            </div>
            <div class="welcome-hero-actions">
              <button class="btn btn-primary" style="background:white; color:var(--primary); font-weight:700;" onclick="switchTab('matching')">🤝 Matching Center</button>
              <button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="switchTab('users')">👥 User Directory</button>
            </div>
          </div>
        </div>

        ${signalBannerHtml}

        <!-- 6 Stat KPI Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
          <div class="stat-card">
            <div class="stat-icon indigo">👥</div>
            <div>
              <div class="stat-number">${s.total_users}</div>
              <div class="stat-label">Total Users</div>
              <div class="stat-trend">🟢 Active Ecosystem</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon emerald">🧑‍🏫</div>
            <div>
              <div class="stat-number">${s.total_mentors}</div>
              <div class="stat-label">Faculty Mentors</div>
              <div class="stat-trend">✦ Capacity Monitored</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon cyan">🎓</div>
            <div>
              <div class="stat-number">${s.total_mentees}</div>
              <div class="stat-label">Student Mentees</div>
              <div class="stat-trend">✦ Cross-Discipline</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber">🤝</div>
            <div>
              <div class="stat-number">${s.total_assignments}</div>
              <div class="stat-label">Active Pairings</div>
              <div class="stat-trend">Max 5 per Mentor</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon rose">📅</div>
            <div>
              <div class="stat-number">${s.total_meetings}</div>
              <div class="stat-label">Total Meetings</div>
              <div class="stat-trend">Online & Offline</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon indigo">📋</div>
            <div>
              <div class="stat-number">${s.total_tasks}</div>
              <div class="stat-label">Action Tasks</div>
              <div class="stat-trend">Tracked Roadmaps</div>
            </div>
          </div>
        </div>

        <!-- Split Grid: Meetings & Activity -->
        <div style="display:grid; grid-template-columns:1.2fr 0.8fr; gap:1.75rem;" class="admin-overview-grid">
          <div class="card">
            <div class="card-header">
              <h4 class="card-title">📅 Platform Meetings Log (${meetings.length})</h4>
              <button class="btn btn-sm btn-outline" onclick="switchTab('meetings')">View All &rarr;</button>
            </div>
            ${meetings.length === 0 ? '<div class="empty-state-desc">No meetings scheduled yet.</div>' : `
              <div style="display:flex; flex-direction:column; gap:0.85rem;">
                ${meetings.slice(0, 4).map(m => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1rem; background:var(--bg-subtle); border-radius:var(--radius-md); border:1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:0.85rem;">
                      <div class="date-badge">
                        <div class="date-badge-month">${m.meeting_date.split('-')[1] || 'OCT'}</div>
                        <div class="date-badge-day">${m.meeting_date.split('-')[2] || '18'}</div>
                      </div>
                      <div>
                        <div style="font-weight:700; font-size:0.925rem;">${escapeHtml(m.agenda)}</div>
                        <div style="font-size:0.775rem; color:var(--text-muted);">${escapeHtml(m.mentor_name)} &bull; ${escapeHtml(m.mentee_name)} (${m.meeting_time})</div>
                      </div>
                    </div>
                    <span class="badge badge-${m.status.toLowerCase().replace(' ', '-')}">${m.status}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="card">
            <div class="card-header">
              <h4 class="card-title">🕒 Recent Platform Activity</h4>
            </div>
            <ul style="list-style:none; display:flex; flex-direction:column; gap:0.75rem;">
              ${statsRes.recent_activities.map(a => `
                <li style="padding:0.75rem; background:var(--bg-subtle); border-radius:var(--radius-sm); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border);">
                  <div><strong style="color:var(--primary);">${escapeHtml(a.type)}:</strong> ${escapeHtml(a.label)}</div>
                  <span style="font-size:0.75rem; color:var(--text-light);">${a.created_at}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (statsRes.role === "mentor") {
      const s = statsRes.stats;
      const mentees = statsRes.mentees || [];
      const pendingTasks = tasks.filter(t => t.status !== 'Completed');
      const upcomingMeetings = meetings.filter(m => m.status === 'Requested' || m.status === 'Scheduled');

      container.innerHTML = `
        <!-- Welcome Hero Banner -->
        <div class="welcome-hero-banner">
          <div class="welcome-hero-content">
            <div class="welcome-hero-text">
              <h2>👋 Welcome back, ${escapeHtml(u.name)}!</h2>
              <p>Faculty Mentor &bull; ${escapeHtml(u.department || 'Academic Department')} &mdash; <em>"A mentor empowers a student to see their potential, and believe it can be achieved."</em></p>
            </div>
            <div class="welcome-hero-actions">
              <button class="btn btn-primary" style="background:white; color:var(--primary); font-weight:700;" onclick="openScheduleMeetingModal()">+ Schedule Meeting</button>
              <button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="openCreateTaskModal()">+ Assign Task</button>
              <button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="switchTab('messages')">💬 Mentee Chat</button>
            </div>
          </div>
        </div>

        ${signalBannerHtml}

        <!-- 4 Stat Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
          <div class="stat-card">
            <div class="stat-icon indigo">🎓</div>
            <div>
              <div class="stat-number">${s.mentees_count} <span style="font-size:1.1rem; color:var(--text-muted); font-weight:normal;">/ ${s.max_mentees}</span></div>
              <div class="stat-label">Assigned Mentees</div>
              <div class="stat-trend">🟢 Active Mentorship</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon emerald">📅</div>
            <div>
              <div class="stat-number">${s.upcoming_meetings}</div>
              <div class="stat-label">Upcoming Sessions</div>
              <div class="stat-trend">${s.upcoming_meetings > 0 ? '✦ Next session ready' : 'No pending sessions'}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber">⏳</div>
            <div>
              <div class="stat-number">${s.pending_tasks}</div>
              <div class="stat-label">Active Student Tasks</div>
              <div class="stat-trend">Roadmap progress</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon cyan">⭐</div>
            <div>
              <div class="stat-number">${s.avg_rating ? s.avg_rating + '★' : '5.0★'}</div>
              <div class="stat-label">Student Rating</div>
              <div class="stat-trend">★★★★★ (${s.review_count} Reviews)</div>
            </div>
          </div>
        </div>

        <!-- Split Layout: Left Content & Right Sidebar -->
        <div style="display:grid; grid-template-columns:1.2fr 0.8fr; gap:1.75rem;" class="mentor-overview-grid">
          <!-- Left Column -->
          <div style="display:flex; flex-direction:column; gap:1.75rem;">
            <!-- Upcoming Sessions Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">📅 Upcoming Mentorship Sessions (${upcomingMeetings.length})</h4>
                <button class="btn btn-sm btn-primary" onclick="openScheduleMeetingModal()">+ New Session</button>
              </div>
              ${upcomingMeetings.length === 0 ? `
                <div class="empty-state" style="padding:2rem 1rem;">
                  <div class="empty-state-icon">📅</div>
                  <div class="empty-state-title">No Pending Meetings</div>
                  <div class="empty-state-desc">You are all caught up! Schedule a new check-in with your assigned students.</div>
                  <button class="btn btn-sm btn-primary" onclick="openScheduleMeetingModal()">Schedule Session</button>
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:1rem;">
                  ${upcomingMeetings.map(m => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:1.15rem; background:var(--bg-subtle); border-radius:var(--radius-lg); border:1px solid var(--border); flex-wrap:wrap; gap:1rem;">
                      <div style="display:flex; align-items:center; gap:1rem;">
                        <div class="date-badge">
                          <div class="date-badge-month">${m.meeting_date.split('-')[1] || 'OCT'}</div>
                          <div class="date-badge-day">${m.meeting_date.split('-')[2] || '18'}</div>
                        </div>
                        <div>
                          <div style="font-weight:800; font-size:1rem; color:var(--text-main);">${escapeHtml(m.agenda)}</div>
                          <div style="font-size:0.825rem; color:var(--text-muted); margin-top:2px;">
                            Student: <strong>${escapeHtml(m.mentee_name)}</strong> &bull; Time: ${m.meeting_time} &bull; Mode: <span class="badge" style="background:#e0e7ff; color:#3730a3;">${m.mode.toUpperCase()}</span>
                          </div>
                          ${m.mode === 'online' && m.location_or_link.startsWith('http') ? `
                            <a href="${escapeHtml(m.location_or_link)}" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem; font-weight:700; color:var(--primary); display:inline-block; margin-top:3px;">
                              🎥 Open Video Room ↗
                            </a>
                          ` : (m.location_or_link ? `<span style="font-size:0.8rem; color:var(--text-muted);">Location: ${escapeHtml(m.location_or_link)}</span>` : '')}
                        </div>
                      </div>
                      <div style="display:flex; gap:0.5rem; align-items:center;">
                        <span class="badge badge-${m.status.toLowerCase().replace(' ', '-')}">${m.status}</span>
                        ${m.status === 'Requested' ? `
                          <button class="btn btn-sm btn-success" onclick="updateMeetingStatus(${m.id}, 'Scheduled')">Confirm</button>
                          <button class="btn btn-sm btn-danger" onclick="updateMeetingStatus(${m.id}, 'Cancelled')">Decline</button>
                        ` : `
                          <button class="btn btn-sm btn-success" onclick="updateMeetingStatus(${m.id}, 'Completed')">Complete</button>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Active Tasks Roadmap -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">📋 Mentorship Milestone Tasks (${pendingTasks.length} Active)</h4>
                <button class="btn btn-sm btn-secondary" onclick="openCreateTaskModal()">+ Assign Task</button>
              </div>
              ${pendingTasks.length === 0 ? `
                <div class="empty-state" style="padding:2rem 1rem;">
                  <div class="empty-state-icon">📋</div>
                  <div class="empty-state-title">All Milestones Completed!</div>
                  <div class="empty-state-desc">Your mentees have no pending tasks. Assign a new learning objective!</div>
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.85rem;">
                  ${pendingTasks.slice(0, 4).map(t => `
                    <div style="padding:1rem; background:var(--bg-subtle); border-radius:var(--radius-md); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                      <div>
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${escapeHtml(t.title)}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Assigned to: <strong>${escapeHtml(t.mentee_name)}</strong> &bull; Due: ${t.due_date || 'No deadline'}</div>
                      </div>
                      <div style="display:flex; align-items:center; gap:0.6rem;">
                        <select class="form-select" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:130px;" onchange="updateTaskStatus(${t.id}, this.value)">
                          <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
                          <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                          <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- Right Column: Mentee Spotlight & Reviews -->
          <div style="display:flex; flex-direction:column; gap:1.75rem;">
            <!-- Mentees Spotlight Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">🎓 Assigned Students (${mentees.length})</h4>
                <button class="btn btn-sm btn-outline" onclick="switchTab('mentees')">View All</button>
              </div>
              ${mentees.length === 0 ? `
                <div class="empty-state-desc">No mentees assigned yet. Administrator will pair students with you shortly.</div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:1rem;">
                  ${mentees.map(m => `
                    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1.15rem;">
                      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem;">
                        <div style="width:2.5rem; height:2.5rem; border-radius:50%; background:var(--primary-gradient); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                          ${m.name.charAt(0)}
                        </div>
                        <div>
                          <div style="font-weight:700; font-size:0.95rem;">${escapeHtml(m.name)}</div>
                          <div style="font-size:0.775rem; color:var(--text-muted);">${escapeHtml(m.department || 'Student')}</div>
                        </div>
                      </div>
                      <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;"><strong>Skills:</strong> ${escapeHtml(m.skills || 'Not specified')}</div>
                      <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="openChatWithUser(${m.id})">💬 Message</button>
                        <button class="btn btn-sm btn-outline" onclick="openScheduleMeetingModal(${m.id}, '${escapeHtml(m.name)}')">Schedule</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Student Feedback Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">⭐ Student Reviews (${feedbackList.length})</h4>
                <button class="btn btn-sm btn-outline" onclick="switchTab('feedback')">Reviews &rarr;</button>
              </div>
              ${feedbackList.length === 0 ? `
                <div class="empty-state-desc">No written reviews received yet.</div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                  ${feedbackList.slice(0, 2).map(f => `
                    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                        <span style="font-weight:700; font-size:0.85rem;">${escapeHtml(f.author_name)}</span>
                        <span style="color:#f59e0b; font-weight:bold;">${'★'.repeat(f.rating)}</span>
                      </div>
                      <p style="font-size:0.825rem; color:var(--text-muted); line-height:1.4;">"${escapeHtml(f.comments)}"</p>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    } else if (statsRes.role === "mentee") {
      const s = statsRes.stats;
      const m = statsRes.mentor;
      const pendingTasks = tasks.filter(t => t.status !== 'Completed');
      const upcomingMeetings = meetings.filter(m => m.status === 'Requested' || m.status === 'Scheduled');

      container.innerHTML = `
        <!-- Welcome Hero Banner -->
        <div class="welcome-hero-banner">
          <div class="welcome-hero-content">
            <div class="welcome-hero-text">
              <h2>👋 Welcome back, ${escapeHtml(u.name)}!</h2>
              <p>Student Mentee &bull; ${escapeHtml(u.department || 'Undergraduate Student')} &mdash; <em>"Education is the passport to the future, for tomorrow belongs to those who prepare for it today."</em></p>
            </div>
            <div class="welcome-hero-actions">
              <button class="btn btn-primary" style="background:white; color:var(--primary); font-weight:700;" onclick="switchTab('roadmap')">🗺️ Adaptive Roadmap</button>
              <button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="switchTab('skills')">🔍 AI Skill Detective</button>
              <button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="openRequestMeetingModal()">📅 Request Meeting</button>
              ${m ? `<button class="btn btn-secondary" style="background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" onclick="openChatWithUser(${m.id})">💬 Message Mentor</button>` : ''}
            </div>
          </div>
        </div>

        <!-- 4 Stat Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
          <div class="stat-card">
            <div class="stat-icon emerald">📅</div>
            <div>
              <div class="stat-number">${s.upcoming_meetings}</div>
              <div class="stat-label">Upcoming Sessions</div>
              <div class="stat-trend">${s.upcoming_meetings > 0 ? '✦ Next session ready' : 'Ready to schedule'}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber">⏳</div>
            <div>
              <div class="stat-number">${s.pending_tasks}</div>
              <div class="stat-label">Active Milestone Tasks</div>
              <div class="stat-trend">In Progress Roadmap</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon indigo">✅</div>
            <div>
              <div class="stat-number">${s.completed_tasks}</div>
              <div class="stat-label">Completed Milestones</div>
              <div class="stat-trend">Great progress!</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon cyan">💬</div>
            <div>
              <div class="stat-number">${s.unread_messages}</div>
              <div class="stat-label">Unread Messages</div>
              <div class="stat-trend">${s.unread_messages > 0 ? '✦ New replies' : 'All caught up'}</div>
            </div>
          </div>
        </div>

        <!-- Split Layout: Left Content & Right Sidebar -->
        <div style="display:grid; grid-template-columns:1.2fr 0.8fr; gap:1.75rem;" class="mentee-overview-grid">
          <!-- Left Column: Meetings & Tasks -->
          <div style="display:flex; flex-direction:column; gap:1.75rem;">
            <!-- Upcoming Sessions Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">📅 My Scheduled Sessions (${upcomingMeetings.length})</h4>
                <button class="btn btn-sm btn-primary" onclick="openRequestMeetingModal()">+ Request Session</button>
              </div>
              ${upcomingMeetings.length === 0 ? `
                <div class="empty-state" style="padding:2.5rem 1.5rem;">
                  <div class="empty-state-icon">📅</div>
                  <div class="empty-state-title">No Sessions Scheduled</div>
                  <div class="empty-state-desc">Need technical guidance, code review, or career advice? Request a 1-on-1 meeting with your faculty mentor.</div>
                  <button class="btn btn-primary" onclick="openRequestMeetingModal()">Request Meeting</button>
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:1rem;">
                  ${upcomingMeetings.map(m => `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:1.15rem; background:var(--bg-subtle); border-radius:var(--radius-lg); border:1px solid var(--border); flex-wrap:wrap; gap:1rem;">
                      <div style="display:flex; align-items:center; gap:1rem;">
                        <div class="date-badge">
                          <div class="date-badge-month">${m.meeting_date.split('-')[1] || 'OCT'}</div>
                          <div class="date-badge-day">${m.meeting_date.split('-')[2] || '18'}</div>
                        </div>
                        <div>
                          <div style="font-weight:800; font-size:1rem; color:var(--text-main);">${escapeHtml(m.agenda)}</div>
                          <div style="font-size:0.825rem; color:var(--text-muted); margin-top:2px;">
                            Mentor: <strong>${escapeHtml(m.mentor_name)}</strong> &bull; Time: ${m.meeting_time} &bull; Mode: <span class="badge" style="background:#e0e7ff; color:#3730a3;">${m.mode.toUpperCase()}</span>
                          </div>
                          ${m.mode === 'online' && m.location_or_link.startsWith('http') ? `
                            <a href="${escapeHtml(m.location_or_link)}" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem; font-weight:700; color:var(--primary); display:inline-block; margin-top:3px;">
                              🎥 Join Video Room ↗
                            </a>
                          ` : (m.location_or_link ? `<span style="font-size:0.8rem; color:var(--text-muted);">Location: ${escapeHtml(m.location_or_link)}</span>` : '')}
                        </div>
                      </div>
                      <div style="display:flex; gap:0.5rem; align-items:center;">
                        <span class="badge badge-${m.status.toLowerCase().replace(' ', '-')}">${m.status}</span>
                        <button class="btn btn-sm btn-danger" onclick="updateMeetingStatus(${m.id}, 'Cancelled')">Cancel</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Tasks Roadmap Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">📋 My Milestone Tasks (${tasks.length})</h4>
                <button class="btn btn-sm btn-outline" onclick="switchTab('tasks')">Task Board &rarr;</button>
              </div>
              ${tasks.length === 0 ? `
                <div class="empty-state-desc" style="padding:1.5rem; text-align:center;">No tasks assigned yet. Your mentor will post your learning roadmap here soon.</div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.85rem;">
                  ${tasks.map(t => `
                    <div style="padding:1.15rem; background:var(--bg-subtle); border-radius:var(--radius-md); border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                      <div style="max-width:440px;">
                        <div style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${escapeHtml(t.title)}</div>
                        <div style="font-size:0.825rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(t.description || 'Action item')}</div>
                        <div style="font-size:0.75rem; color:var(--primary); margin-top:4px; font-weight:600;">Due: ${t.due_date || 'Ongoing'}</div>
                      </div>
                      <div style="display:flex; align-items:center; gap:0.65rem;">
                        <select class="form-select" style="font-size:0.825rem; padding:0.35rem 0.65rem; width:135px;" onchange="updateTaskStatus(${t.id}, this.value)">
                          <option value="Pending" ${t.status === 'Pending' ? 'selected' : ''}>Pending</option>
                          <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                          <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- Right Column: Mentor Spotlight -->
          <div style="display:flex; flex-direction:column; gap:1.75rem;">
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">🧑‍🏫 Your Faculty Mentor</h4>
              </div>
              ${m ? `
                <div style="display:flex; flex-direction:column; gap:1rem;">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <div style="width:3.5rem; height:3.5rem; border-radius:var(--radius-lg); background:var(--primary-gradient); color:white; display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:bold; box-shadow:0 4px 10px rgba(79, 70, 229, 0.3);">
                      ${m.name.charAt(0)}
                    </div>
                    <div>
                      <h4 style="font-size:1.15rem; font-weight:800; color:var(--text-main);">${escapeHtml(m.name)}</h4>
                      <div style="font-size:0.825rem; color:var(--primary); font-weight:700;">${escapeHtml(m.department || 'Faculty Department')}</div>
                    </div>
                  </div>
                  <p style="font-size:0.875rem; color:var(--text-muted); line-height:1.5;">${escapeHtml(m.bio || 'Experienced faculty mentor.')}</p>
                  <div style="background:var(--bg-subtle); padding:0.85rem; border-radius:var(--radius-md); font-size:0.8rem;">
                    <div><strong>Skills:</strong> ${escapeHtml(m.skills || 'Technical Expertise')}</div>
                    <div style="margin-top:2px;"><strong>Interests:</strong> ${escapeHtml(m.interests || 'Research & Engineering')}</div>
                  </div>
                  <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-sm" onclick="openRequestMeetingModal()">📅 Request Meeting</button>
                    <button class="btn btn-outline btn-sm" onclick="openChatWithUser(${m.id})">💬 Message</button>
                    <button class="btn btn-secondary btn-sm" onclick="openFeedbackModal(${m.id}, '${escapeHtml(m.name)}')">⭐ Feedback</button>
                  </div>
                </div>
              ` : `
                <div class="empty-state" style="padding:2rem 1rem;">
                  <div class="empty-state-icon">⏳</div>
                  <div class="empty-state-title">Mentor Pairing Pending</div>
                  <div class="empty-state-desc">The administrator will match you with a mentor based on your department and interests soon.</div>
                </div>
              `}
            </div>

            <!-- Feedback Submitted Card -->
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">⭐ Feedback & Reviews (${feedbackList.length})</h4>
                ${m ? `<button class="btn btn-sm btn-outline" onclick="openFeedbackModal(${m.id}, '${escapeHtml(m.name)}')">+ Review</button>` : ''}
              </div>
              ${feedbackList.length === 0 ? `
                <div class="empty-state-desc">No reviews submitted yet. Share constructive feedback about your mentorship experience!</div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                  ${feedbackList.slice(0, 2).map(f => `
                    <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:var(--radius-md); padding:0.85rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                        <span style="font-weight:700; font-size:0.85rem;">For: ${escapeHtml(f.recipient_name)}</span>
                        <span style="color:#f59e0b; font-weight:bold;">${'★'.repeat(f.rating)}</span>
                      </div>
                      <p style="font-size:0.825rem; color:var(--text-muted); line-height:1.4;">"${escapeHtml(f.comments)}"</p>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("Overview error:", err);
  }
}

// ==========================================
// 2. Admin Users Directory
// ==========================================

async function loadAdminUsers() {
  const container = document.getElementById("tab-users-content");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading users directory...</div>';

  try {
    const res = await apiFetch("/api/admin/users");
    const users = res.users;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">👥 All Registered Users (${users.length})</h4>
          <div style="display:flex; gap:0.5rem;">
            <select class="form-select" id="admin-user-filter" onchange="filterAdminUsersTable(this.value)" style="width:160px; padding:0.35rem 0.65rem;">
              <option value="all">All Roles</option>
              <option value="mentor">Mentors</option>
              <option value="mentee">Mentees</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table" id="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Skills & Interests</th>
                <th>Mentorship Info</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              ${users
                .map(
                  (u) => `
                <tr data-role="${u.role}">
                  <td>
                    <div style="font-weight:700;">${escapeHtml(u.name)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(u.email)}</div>
                  </td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td>${escapeHtml(u.department || "-")}</td>
                  <td style="max-width:240px; font-size:0.8rem;">
                    <div><strong>Skills:</strong> ${escapeHtml(u.skills || "-")}</div>
                    <div><strong>Interests:</strong> ${escapeHtml(u.interests || "-")}</div>
                  </td>
                  <td>
                    ${
                      u.role === "mentor"
                        ? `<span style="font-weight:600; color:var(--primary);">${u.active_mentees_count} / 5 Mentees</span>`
                        : u.role === "mentee"
                        ? u.assigned_mentor_name
                          ? `<span style="color:var(--success); font-weight:600;">Mentor: ${escapeHtml(u.assigned_mentor_name)}</span>`
                          : `<span style="color:var(--warning); font-weight:600;">Unassigned</span>`
                        : "Administrator"
                    }
                  </td>
                  <td style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap;">${u.created_at.split(" ")[0]}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error loading users</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function filterAdminUsersTable(role) {
  const rows = document.querySelectorAll("#admin-users-table tbody tr");
  rows.forEach((row) => {
    if (role === "all" || row.getAttribute("data-role") === role) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

// ==========================================
// 3. Admin Matching Center
// ==========================================

async function loadAdminMatchingCenter() {
  const container = document.getElementById("tab-matching-content");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading matching center...</div>';

  try {
    const [assignmentsRes, usersRes] = await Promise.all([
      apiFetch("/api/admin/assignments"),
      apiFetch("/api/admin/users"),
    ]);

    const assignments = assignmentsRes.assignments;
    const mentors = usersRes.users.filter((u) => u.role === "mentor");
    const mentees = usersRes.users.filter((u) => u.role === "mentee");

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:340px 1fr; gap:1.5rem;" class="matching-grid">
        <div class="card">
          <div class="card-header">
            <h4 class="card-title">🤝 Assign / Reassign</h4>
          </div>
          <form id="admin-match-form" onsubmit="handleAdminMatchSubmit(event)">
            <div class="form-group">
              <label class="form-label" for="match-mentee-select">Select Mentee</label>
              <select class="form-select" id="match-mentee-select" required onchange="loadExplainableMatchingForAdmin(this.value)">
                <option value="">-- Choose Mentee --</option>
                ${mentees
                  .map(
                    (m) => `
                  <option value="${m.id}">
                    ${escapeHtml(m.name)} (${escapeHtml(m.department || "No Dept")}) ${m.assigned_mentor_name ? "[Currently: " + escapeHtml(m.assigned_mentor_name) + "]" : "[Unassigned]"}
                  </option>
                `
                  )
                  .join("")}
              </select>
              <div class="form-help">Select a student mentee to see AI explainable match recommendations.</div>
            </div>

            <!-- Explainable Matching AI Recommendations Container -->
            <div id="explainable-matching-results"></div>

            <div class="form-group">
              <label class="form-label" for="match-mentor-select">Assign to Mentor</label>
              <select class="form-select" id="match-mentor-select" required>
                <option value="">-- Choose Mentor --</option>
                ${mentors
                  .map(
                    (m) => `
                  <option value="${m.id}" ${m.active_mentees_count >= 5 ? "disabled" : ""}>
                    ${escapeHtml(m.name)} (${escapeHtml(m.department || "General")}) - [${m.active_mentees_count}/5 Mentees] ${m.active_mentees_count >= 5 ? "(FULL)" : ""}
                  </option>
                `
                  )
                  .join("")}
              </select>
              <div class="form-help">Mentors can take up to 5 mentees maximum.</div>
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:0.5rem;">
              Confirm Assignment
            </button>
          </form>
        </div>

        <div class="card">
          <div class="card-header">
            <h4 class="card-title">📋 Active Pairings (${assignments.length})</h4>
          </div>
          ${
            assignments.length === 0
              ? `<div class="empty-state">
                  <div class="empty-state-icon">🤝</div>
                  <div class="empty-state-title">No Active Pairings</div>
                  <div class="empty-state-desc">Use the assignment tool on the left to create mentor-mentee partnerships.</div>
                </div>`
              : `<div class="table-responsive">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Mentee</th>
                        <th>Assigned Mentor</th>
                        <th>Assigned Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${assignments
                        .map(
                          (a) => `
                        <tr>
                          <td>
                            <div style="font-weight:700;">${escapeHtml(a.mentee_name)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.mentee_department || "-")}</div>
                          </td>
                          <td>
                            <div style="font-weight:700; color:var(--primary);">${escapeHtml(a.mentor_name)}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.mentor_department || "-")}</div>
                          </td>
                          <td style="font-size:0.8rem; color:var(--text-muted);">${a.assigned_at}</td>
                          <td>
                            <button class="btn btn-sm btn-danger" onclick="confirmDeleteAssignment(${a.id}, '${escapeHtml(a.mentee_name)}', '${escapeHtml(a.mentor_name)}')">
                              Unassign
                            </button>
                          </td>
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>`
          }
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error loading matching center</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleAdminMatchSubmit(e) {
  e.preventDefault();
  const menteeId = document.getElementById("match-mentee-select").value;
  const mentorId = document.getElementById("match-mentor-select").value;

  try {
    const res = await apiFetch("/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ mentee_id: menteeId, mentor_id: mentorId }),
    });
    showToast("Assignment Updated", res.message, "success");
    loadAdminMatchingCenter();
  } catch (err) {
    showToast("Assignment Failed", err.message, "error");
  }
}

async function loadExplainableMatchingForAdmin(menteeId) {
  const container = document.getElementById("explainable-matching-results");
  if (!container) return;
  if (!menteeId) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:0.5rem 0;">Analyzing mentor compatibility & explanation reasons...</div>';

  try {
    const res = await apiFetch(`/api/matching/recommendations?mentee_id=${menteeId}`);
    const recs = res.recommendations || [];
    if (recs.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted);">No mentor recommendations found.</div>';
      return;
    }

    container.innerHTML = `
      <div style="background:rgba(238, 242, 255, 0.75); border:1px solid #c7d2fe; border-radius:var(--radius-sm); padding:0.85rem; margin-top:0.75rem; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
          <strong style="font-size:0.825rem; color:var(--primary); text-transform:uppercase; letter-spacing:0.04em;">💡 Explainable Matching Engine</strong>
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Top Matches</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.65rem;">
          ${recs.slice(0, 3).map(r => `
            <div style="background:white; border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.65rem; font-size:0.8rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <strong>${escapeHtml(r.mentor_name)}</strong>
                <span class="badge ${r.match_percentage >= 70 ? 'badge-success' : 'badge-scheduled'}" style="font-size:0.75rem; font-weight:800;">
                  ${r.match_percentage}% Match
                </span>
              </div>
              <ul style="margin:0 0 0.5rem 1.1rem; padding:0; font-size:0.75rem; color:var(--text-muted); line-height:1.4;">
                ${r.explanation_reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}
              </ul>
              <button type="button" class="btn btn-sm btn-outline" style="width:100%; padding:0.25rem 0.5rem; font-size:0.75rem;" ${r.is_full ? 'disabled' : ''} onclick="selectMentorForMatch(${r.mentor_id})">
                ${r.is_full ? 'Mentor Full (5/5)' : '✓ Select This Mentor'}
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="font-size:0.8rem; color:var(--danger);">Failed to calculate recommendations: ${escapeHtml(err.message)}</div>`;
  }
}

function selectMentorForMatch(mentorId) {
  const mentorSelect = document.getElementById("match-mentor-select");
  if (mentorSelect) {
    mentorSelect.value = mentorId;
    showToast("Mentor Selected", "Form updated with recommended mentor.", "info", 1500);
  }
}

function confirmDeleteAssignment(assignmentId, menteeName, mentorName) {
  showConfirmModal(
    "Remove Mentorship Pairing",
    `Are you sure you want to unassign ${menteeName} from mentor ${mentorName}? Both users will be notified.`,
    async () => {
      try {
        const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, {
          method: "DELETE",
        });
        showToast("Unassigned", res.message, "info");
        loadAdminMatchingCenter();
      } catch (err) {
        showToast("Error", err.message, "error");
      }
    }
  );
}

// ==========================================
// 4. Mentor Mentees & Mentee Mentor Views
// ==========================================

async function loadMentorMentees() {
  const container = document.getElementById("tab-mentees-content");
  if (!container) return;

  try {
    const res = await apiFetch("/api/auth/me");
    const mentees = res.extra.assigned_mentees || [];

    if (mentees.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎓</div>
          <div class="empty-state-title">No Mentees Assigned Yet</div>
          <div class="empty-state-desc">The administrator hasn't assigned any mentees to your profile yet. Once assigned, their profile and progress will appear here.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">🎓 Your Mentees (${mentees.length} / 5)</h4>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem;">
          ${mentees
            .map(
              (m) => `
            <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1.25rem;">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
                <div style="width:3rem; height:3rem; border-radius:50%; background:var(--primary-gradient); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.15rem;">
                  ${m.name.charAt(0)}
                </div>
                <div>
                  <h4 style="font-size:1.1rem; font-weight:700;">${escapeHtml(m.name)}</h4>
                  <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(m.email)}</div>
                </div>
              </div>
              <div style="font-size:0.85rem; margin-bottom:0.35rem;"><strong>Department:</strong> ${escapeHtml(m.department || "General")}</div>
              <div style="font-size:0.85rem; margin-bottom:0.35rem;"><strong>Skills:</strong> ${escapeHtml(m.skills || "Not specified")}</div>
              <div style="font-size:0.85rem; margin-bottom:0.35rem;"><strong>Interests:</strong> ${escapeHtml(m.interests || "Not specified")}</div>
              <p style="font-size:0.85rem; color:var(--text-muted); margin:0.65rem 0 1rem; line-height:1.4;">${escapeHtml(m.bio || "No biography.")}</p>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-sm btn-primary" onclick="openScheduleMeetingModal(${m.id}, '${escapeHtml(m.name)}')">📅 Schedule Meeting</button>
                <button class="btn btn-sm btn-secondary" onclick="openCreateTaskModal(${m.id}, '${escapeHtml(m.name)}')">📋 Assign Task</button>
                <button class="btn btn-sm btn-outline" onclick="openChatWithUser(${m.id})">💬 Message</button>
                <button class="btn btn-sm btn-secondary" onclick="openFeedbackModal(${m.id}, '${escapeHtml(m.name)}')">⭐ Feedback</button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function loadMenteeMentor() {
  const container = document.getElementById("tab-mentor-content");
  if (!container) return;

  try {
    const res = await apiFetch("/api/auth/me");
    const mentor = res.extra.assigned_mentor;

    if (!mentor) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⏳</div>
          <div class="empty-state-title">Awaiting Mentor Assignment</div>
          <div class="empty-state-desc">Your profile is registered! An administrator will pair you with a mentor shortly.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">🧑‍🏫 Mentor Profile</h4>
        </div>
        <div style="display:flex; align-items:flex-start; gap:1.75rem; flex-wrap:wrap;">
          <div style="width:5rem; height:5rem; border-radius:var(--radius-xl); background:var(--primary-gradient); color:white; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold;">
            ${mentor.name.charAt(0)}
          </div>
          <div style="flex:1; min-width:280px;">
            <h3 style="font-size:1.45rem; font-weight:800; margin-bottom:0.25rem;">${escapeHtml(mentor.name)}</h3>
            <div style="color:var(--primary); font-weight:600; margin-bottom:0.5rem;">${escapeHtml(mentor.department || "Academic Department")} &bull; ${escapeHtml(mentor.email)}</div>
            <p style="color:var(--text-muted); font-size:0.95rem; line-height:1.6; margin-bottom:1rem;">${escapeHtml(mentor.bio || "No biography provided.")}</p>
            <div style="background:var(--bg-subtle); padding:1rem; border-radius:var(--radius-md); margin-bottom:1.25rem;">
              <div style="font-size:0.875rem; margin-bottom:0.35rem;"><strong>Expertise & Skills:</strong> ${escapeHtml(mentor.skills || "Technical Mentorship")}</div>
              <div style="font-size:0.875rem;"><strong>Areas of Interest:</strong> ${escapeHtml(mentor.interests || "Research, Software Development")}</div>
            </div>
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="openRequestMeetingModal()">📅 Request Meeting</button>
              <button class="btn btn-outline" onclick="openChatWithUser(${mentor.id})">💬 Chat with Mentor</button>
              <button class="btn btn-secondary" onclick="openFeedbackModal(${mentor.id}, '${escapeHtml(mentor.name)}')">⭐ Submit Feedback</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// 5. Meetings Tab
// ==========================================

async function loadMeetingsTab() {
  const container = document.getElementById("tab-meetings-content");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading meetings...</div>';

  try {
    const res = await apiFetch("/api/meetings");
    const meetings = res.meetings;
    const role = MentorLink.currentUser.role;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">📅 Mentorship Meetings (${meetings.length})</h4>
          <div>
            ${
              role === "mentor"
                ? '<button class="btn btn-sm btn-primary" onclick="openScheduleMeetingModal()">+ Schedule Meeting</button>'
                : role === "mentee"
                ? '<button class="btn btn-sm btn-primary" onclick="openRequestMeetingModal()">+ Request Meeting</button>'
                : ""
            }
          </div>
        </div>
        ${
          meetings.length === 0
            ? `<div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-title">No Meetings Found</div>
                <div class="empty-state-desc">You do not have any scheduled or requested meetings at this time.</div>
              </div>`
            : `<div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Agenda & Notes</th>
                      <th>Mentor / Mentee</th>
                      <th>Date & Time</th>
                      <th>Mode & Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${meetings
                      .map(
                        (m) => `
                      <tr>
                        <td>
                          <div style="font-weight:700;">${escapeHtml(m.agenda)}</div>
                          ${m.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Notes: ${escapeHtml(m.notes)}</div>` : ""}
                        </td>
                        <td>
                          <div style="font-size:0.85rem;"><strong>Mentor:</strong> ${escapeHtml(m.mentor_name)}</div>
                          <div style="font-size:0.85rem;"><strong>Mentee:</strong> ${escapeHtml(m.mentee_name)}</div>
                        </td>
                        <td style="white-space:nowrap;">
                          <div style="font-weight:600;">${m.meeting_date}</div>
                          <div style="font-size:0.8rem; color:var(--text-muted);">${m.meeting_time}</div>
                        </td>
                        <td>
                          <span class="badge" style="background:#f1f5f9; color:var(--text-main); margin-bottom:4px;">${m.mode.toUpperCase()}</span>
                          <div style="font-size:0.8rem; word-break:break-all;">
                            ${
                              m.mode === "online" && m.location_or_link.startsWith("http")
                                ? `<a href="${escapeHtml(m.location_or_link)}" target="_blank" rel="noopener noreferrer">Join Link ↗</a>`
                                : escapeHtml(m.location_or_link || "TBD")
                            }
                          </div>
                        </td>
                        <td><span class="badge badge-${m.status.toLowerCase().replace(" ", "-")}">${m.status}</span></td>
                        <td>
                          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                            ${renderMeetingActions(m, role)}
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error loading meetings</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderMeetingActions(m, role) {
  let actions = "";
  if (role === "mentor" || role === "admin") {
    if (m.status === "Requested") {
      actions += `<button class="btn btn-sm btn-success" onclick="updateMeetingStatus(${m.id}, 'Scheduled')">Confirm</button>`;
      actions += `<button class="btn btn-sm btn-danger" onclick="updateMeetingStatus(${m.id}, 'Cancelled')">Decline</button>`;
    } else if (m.status === "Scheduled") {
      actions += `<button class="btn btn-sm btn-success" onclick="updateMeetingStatus(${m.id}, 'Completed')">Complete</button>`;
      actions += `<button class="btn btn-sm btn-danger" onclick="updateMeetingStatus(${m.id}, 'Cancelled')">Cancel</button>`;
    }
  } else if (role === "mentee") {
    if (m.status === "Requested" || m.status === "Scheduled") {
      actions += `<button class="btn btn-sm btn-danger" onclick="updateMeetingStatus(${m.id}, 'Cancelled')">Cancel</button>`;
    }
  }
  return actions || '<span style="color:var(--text-light); font-size:0.75rem;">None</span>';
}

async function updateMeetingStatus(meetingId, status) {
  const verb = status === "Cancelled" ? "cancel" : status === "Completed" ? "complete" : "confirm";
  showConfirmModal(
    "Update Meeting Status",
    `Are you sure you want to ${verb} this meeting?`,
    async () => {
      try {
        const res = await apiFetch(`/api/meetings/${meetingId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        showToast("Success", res.message, "success");
        loadMeetingsTab();
      } catch (err) {
        showToast("Error", err.message, "error");
      }
    }
  );
}

// Meeting Modals
function openScheduleMeetingModal(preselectedMenteeId = null, preselectedMenteeName = "") {
  let modal = document.getElementById("schedule-meeting-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "schedule-meeting-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">Schedule Meeting</h3>
          <button class="modal-close-btn" data-close-modal>&times;</button>
        </div>
        <form id="schedule-meeting-form" onsubmit="handleScheduleMeetingSubmit(event)">
          <div class="modal-body">
            <div class="form-group" id="schedule-mentee-group">
              <label class="form-label" for="schedule-mentee-select">Mentee</label>
              <select class="form-select" id="schedule-mentee-select" required></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="schedule-agenda">Agenda / Topic</label>
              <input type="text" class="form-control" id="schedule-agenda" required placeholder="e.g. Project Code Review & Guidance">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="schedule-date">Meeting Date</label>
                <input type="date" class="form-control" id="schedule-date" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="schedule-time">Meeting Time</label>
                <input type="time" class="form-control" id="schedule-time" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="schedule-mode">Mode</label>
              <select class="form-select" id="schedule-mode" required>
                <option value="online">Online (Video Call)</option>
                <option value="offline">In-Person (Offline)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="schedule-location">Location / Meeting URL</label>
              <input type="text" class="form-control" id="schedule-location" placeholder="e.g. https://meet.google.com/... or Room 304">
            </div>
            <div class="form-group">
              <label class="form-label" for="schedule-notes">Notes (Optional)</label>
              <textarea class="form-control" id="schedule-notes" rows="2" placeholder="Preparation tips, agenda items..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Schedule Meeting</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal("schedule-meeting-modal")));
  }

  // Populate mentees
  const menteeSelect = document.getElementById("schedule-mentee-select");
  const mentees = MentorLink.extra.assigned_mentees || [];
  menteeSelect.innerHTML = mentees
    .map((m) => `<option value="${m.id}" ${m.id === preselectedMenteeId ? "selected" : ""}>${escapeHtml(m.name)}</option>`)
    .join("");

  openModal("schedule-meeting-modal");
}

async function handleScheduleMeetingSubmit(e) {
  e.preventDefault();
  const menteeId = document.getElementById("schedule-mentee-select").value;
  const agenda = document.getElementById("schedule-agenda").value.trim();
  const meetingDate = document.getElementById("schedule-date").value;
  const meetingTime = document.getElementById("schedule-time").value;
  const mode = document.getElementById("schedule-mode").value;
  const locationOrLink = document.getElementById("schedule-location").value.trim();
  const notes = document.getElementById("schedule-notes").value.trim();

  try {
    const res = await apiFetch("/api/meetings", {
      method: "POST",
      body: JSON.stringify({
        mentee_id: menteeId,
        agenda,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        mode,
        location_or_link: locationOrLink,
        notes,
      }),
    });
    closeModal("schedule-meeting-modal");
    showToast("Meeting Scheduled", res.message, "success");
    loadMeetingsTab();
  } catch (err) {
    showToast("Failed", err.message, "error");
  }
}

function openRequestMeetingModal() {
  let modal = document.getElementById("request-meeting-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "request-meeting-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">Request a Meeting with Mentor</h3>
          <button class="modal-close-btn" data-close-modal>&times;</button>
        </div>
        <form id="request-meeting-form" onsubmit="handleRequestMeetingSubmit(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="req-agenda">Agenda / Discussion Topic</label>
              <input type="text" class="form-control" id="req-agenda" required placeholder="e.g. Need guidance on database relationships">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="req-date">Requested Date</label>
                <input type="date" class="form-control" id="req-date" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="req-time">Preferred Time</label>
                <input type="time" class="form-control" id="req-time" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="req-mode">Mode</label>
              <select class="form-select" id="req-mode" required>
                <option value="online">Online (Video Call)</option>
                <option value="offline">In-Person (Campus)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="req-location">Suggested Link or Location (Optional)</label>
              <input type="text" class="form-control" id="req-location" placeholder="e.g. Google Meet link or Department Lab">
            </div>
            <div class="form-group">
              <label class="form-label" for="req-notes">Message for Mentor (Optional)</label>
              <textarea class="form-control" id="req-notes" rows="2" placeholder="Brief explanation of what you would like to cover..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Request</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal("request-meeting-modal")));
  }

  openModal("request-meeting-modal");
}

async function handleRequestMeetingSubmit(e) {
  e.preventDefault();
  const agenda = document.getElementById("req-agenda").value.trim();
  const meetingDate = document.getElementById("req-date").value;
  const meetingTime = document.getElementById("req-time").value;
  const mode = document.getElementById("req-mode").value;
  const locationOrLink = document.getElementById("req-location").value.trim();
  const notes = document.getElementById("req-notes").value.trim();

  try {
    const res = await apiFetch("/api/meetings", {
      method: "POST",
      body: JSON.stringify({
        agenda,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        mode,
        location_or_link: locationOrLink,
        notes,
      }),
    });
    closeModal("request-meeting-modal");
    showToast("Request Sent", "Your meeting request was submitted to your mentor.", "success");
    loadMeetingsTab();
  } catch (err) {
    showToast("Request Failed", err.message, "error");
  }
}

// ==========================================
// 6. Task Management Tab
// ==========================================

async function loadTasksTab() {
  const container = document.getElementById("tab-tasks-content");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading tasks...</div>';

  try {
    const res = await apiFetch("/api/tasks");
    const tasks = res.tasks;
    const role = MentorLink.currentUser.role;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">📋 Task Assignments (${tasks.length})</h4>
          <div>
            ${
              role === "mentor"
                ? '<button class="btn btn-sm btn-primary" onclick="openCreateTaskModal()">+ New Task</button>'
                : ""
            }
          </div>
        </div>
        ${
          tasks.length === 0
            ? `<div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">No Tasks Assigned</div>
                <div class="empty-state-desc">There are no pending or completed tasks currently in the system.</div>
              </div>`
            : `<div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Task Title & Description</th>
                      <th>Mentor / Mentee</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tasks
                      .map(
                        (t) => `
                      <tr>
                        <td style="max-width:320px;">
                          <div style="font-weight:700;">${escapeHtml(t.title)}</div>
                          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(t.description || "No description provided.")}</div>
                        </td>
                        <td>
                          <div style="font-size:0.85rem;"><strong>By:</strong> ${escapeHtml(t.mentor_name)}</div>
                          <div style="font-size:0.85rem;"><strong>For:</strong> ${escapeHtml(t.mentee_name)}</div>
                        </td>
                        <td style="font-size:0.85rem; white-space:nowrap;">${t.due_date || "No deadline"}</td>
                        <td>
                          <span class="badge badge-${t.status.toLowerCase().replace(" ", "-")}">${t.status}</span>
                        </td>
                        <td>
                          <div style="display:flex; gap:0.4rem; align-items:center;">
                            ${
                              role === "mentee"
                                ? `
                                <select class="form-select" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:125px;" onchange="updateTaskStatus(${t.id}, this.value)">
                                  <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
                                  <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
                                  <option value="Completed" ${t.status === "Completed" ? "selected" : ""}>Completed</option>
                                </select>
                              `
                                : role === "mentor"
                                ? `
                                <select class="form-select" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:125px;" onchange="updateTaskStatus(${t.id}, this.value)">
                                  <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
                                  <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
                                  <option value="Completed" ${t.status === "Completed" ? "selected" : ""}>Completed</option>
                                </select>
                                <button class="btn btn-sm btn-danger" onclick="confirmDeleteTask(${t.id}, '${escapeHtml(t.title)}')">Delete</button>
                              `
                                : `<span>-</span>`
                            }
                          </div>
                        </td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error loading tasks</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    const res = await apiFetch(`/api/tasks/${taskId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    showToast("Task Updated", res.message, "success");
    loadTasksTab();
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

function confirmDeleteTask(taskId, taskTitle) {
  showConfirmModal("Delete Task", `Are you sure you want to delete task "${taskTitle}"?`, async () => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      showToast("Deleted", res.message, "info");
      loadTasksTab();
    } catch (err) {
      showToast("Error", err.message, "error");
    }
  });
}

function openCreateTaskModal(preselectedMenteeId = null, preselectedMenteeName = "") {
  let modal = document.getElementById("create-task-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "create-task-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">Assign New Task</h3>
          <button class="modal-close-btn" data-close-modal>&times;</button>
        </div>
        <form id="create-task-form" onsubmit="handleCreateTaskSubmit(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="task-mentee-select">Assign to Mentee</label>
              <select class="form-select" id="task-mentee-select" required></select>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-title">Task Title</label>
              <input type="text" class="form-control" id="task-title" required placeholder="e.g. Build Project Authentication Flow">
            </div>
            <div class="form-group">
              <label class="form-label" for="task-desc">Description & Instructions</label>
              <textarea class="form-control" id="task-desc" rows="3" placeholder="Provide step-by-step guidance or requirements..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-due-date">Due Date</label>
              <input type="date" class="form-control" id="task-due-date">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Assign Task</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal("create-task-modal")));
  }

  const select = document.getElementById("task-mentee-select");
  const mentees = MentorLink.extra.assigned_mentees || [];
  select.innerHTML = mentees
    .map((m) => `<option value="${m.id}" ${m.id === preselectedMenteeId ? "selected" : ""}>${escapeHtml(m.name)}</option>`)
    .join("");

  openModal("create-task-modal");
}

async function handleCreateTaskSubmit(e) {
  e.preventDefault();
  const menteeId = document.getElementById("task-mentee-select").value;
  const title = document.getElementById("task-title").value.trim();
  const description = document.getElementById("task-desc").value.trim();
  const dueDate = document.getElementById("task-due-date").value;

  try {
    const res = await apiFetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ mentee_id: menteeId, title, description, due_date: dueDate }),
    });
    closeModal("create-task-modal");
    showToast("Task Created", res.message, "success");
    loadTasksTab();
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

// ==========================================
// 7. Messages & Chat Tab
// ==========================================

async function loadMessagesTab() {
  const container = document.getElementById("tab-messages-content");
  if (!container) return;

  const role = MentorLink.currentUser.role;
  let partners = [];

  if (role === "mentor") {
    partners = MentorLink.extra.assigned_mentees || [];
  } else if (role === "mentee") {
    const mentor = MentorLink.extra.assigned_mentor;
    if (mentor) partners = [mentor];
  }

  if (partners.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">No Active Conversation Partners</div>
        <div class="empty-state-desc">Direct messaging requires an active mentor-mentee pairing. Once assigned, your chat will unlock here.</div>
      </div>
    `;
    return;
  }

  // Set default active partner if none
  if (!MentorLink.activePartnerId || !partners.some((p) => p.id === MentorLink.activePartnerId)) {
    MentorLink.activePartnerId = partners[0].id;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:260px 1fr; gap:1.25rem;" class="chat-container-grid">
      <div class="card" style="padding:1rem;">
        <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem;">Conversations</h4>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${partners
            .map(
              (p) => `
            <button class="dash-nav-item ${p.id === MentorLink.activePartnerId ? "active" : ""}" onclick="selectChatPartner(${p.id})">
              <div style="width:2rem; height:2rem; border-radius:50%; background:var(--primary-gradient); color:white; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">
                ${p.name.charAt(0)}
              </div>
              <div style="text-align:left; overflow:hidden; text-overflow:ellipsis;">
                <div style="font-weight:600; font-size:0.875rem;">${escapeHtml(p.name)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(p.department || p.role)}</div>
              </div>
            </button>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="chat-box">
        <div class="chat-header">
          <div>
            <h4 style="font-weight:700; font-size:1rem;" id="chat-partner-name">Loading...</h4>
            <div style="font-size:0.75rem; color:var(--text-muted);" id="chat-partner-role"></div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="fetchChatMessages()">🔄 Refresh</button>
        </div>
        <div class="chat-messages" id="chat-messages-container">
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading conversation...</div>
        </div>
        <form class="chat-footer" onsubmit="handleSendMessageSubmit(event)">
          <input type="text" class="form-control" id="chat-input" placeholder="Type a message..." required autocomplete="off">
          <button type="submit" class="btn btn-primary" id="chat-send-btn">Send</button>
        </form>
      </div>
    </div>
  `;

  selectChatPartner(MentorLink.activePartnerId);
}

function selectChatPartner(partnerId) {
  MentorLink.activePartnerId = partnerId;

  // Clear previous polling interval if any
  if (MentorLink.chatPollInterval) {
    clearInterval(MentorLink.chatPollInterval);
  }

  fetchChatMessages();

  // Poll for new messages every 5 seconds
  MentorLink.chatPollInterval = setInterval(fetchChatMessages, 5000);
}

async function fetchChatMessages() {
  if (!MentorLink.activePartnerId) return;

  try {
    const res = await apiFetch(`/api/messages?partner_id=${MentorLink.activePartnerId}`);
    const nameElem = document.getElementById("chat-partner-name");
    const roleElem = document.getElementById("chat-partner-role");
    const container = document.getElementById("chat-messages-container");

    if (nameElem && res.partner) nameElem.innerText = res.partner.name;
    if (roleElem && res.partner) roleElem.innerText = `${res.partner.role.toUpperCase()} • ${res.partner.department || ""}`;

    if (container) {
      if (res.messages.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; margin:auto; color:var(--text-muted); font-size:0.875rem;">
            No messages yet. Say hello to start the conversation!
          </div>
        `;
        return;
      }

      const myId = MentorLink.currentUser.id;
      container.innerHTML = res.messages
        .map(
          (m) => `
        <div class="message-bubble-wrapper ${m.sender_id === myId ? "sent" : "received"}">
          <div class="message-sender-name">${m.sender_id === myId ? "You" : escapeHtml(m.sender_name)}</div>
          <div class="message-bubble">${escapeHtml(m.message)}</div>
          <div class="message-timestamp">${m.created_at}</div>
        </div>
      `
        )
        .join("");

      // Auto-scroll to bottom
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error("Chat error:", err);
  }
}

async function handleSendMessageSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !MentorLink.activePartnerId) return;

  input.value = "";

  try {
    await apiFetch("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: MentorLink.activePartnerId,
        message: text,
      }),
    });
    fetchChatMessages();
  } catch (err) {
    showToast("Message Failed", err.message, "error");
  }
}

function openChatWithUser(userId) {
  MentorLink.activePartnerId = userId;
  switchTab("messages");
}

// ==========================================
// 8. Feedback & Reviews Tab
// ==========================================

async function loadFeedbackTab() {
  const container = document.getElementById("tab-feedback-content");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;">Loading feedback...</div>';

  try {
    const res = await apiFetch("/api/feedback");
    const list = res.feedback;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">⭐ Feedback & Reviews (${list.length})</h4>
          <div>
            ${
              MentorLink.currentUser.role !== "admin"
                ? '<button class="btn btn-sm btn-primary" onclick="openFeedbackModal()">+ Leave Feedback</button>'
                : ""
            }
          </div>
        </div>
        ${
          list.length === 0
            ? `<div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <div class="empty-state-title">No Reviews Submitted Yet</div>
                <div class="empty-state-desc">Constructive feedback helps mentors and mentees continuously improve and track mentorship quality.</div>
              </div>`
            : `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
                ${list
                  .map(
                    (f) => `
                  <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:var(--radius-lg); padding:1.25rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                      <div style="font-weight:700; color:var(--text-main);">
                        ${escapeHtml(f.author_name)} <span class="badge badge-${f.author_role}">${f.author_role}</span>
                      </div>
                      <div style="color:#f59e0b; font-size:1.15rem; font-weight:bold;">
                        ${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)}
                      </div>
                    </div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
                      For: <strong>${escapeHtml(f.recipient_name)}</strong> &bull; ${f.created_at}
                    </div>
                    <p style="font-size:0.9rem; color:var(--text-main); line-height:1.5;">"${escapeHtml(f.comments)}"</p>
                  </div>
                `
                  )
                  .join("")}
              </div>`
        }
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-title">Error loading feedback</div><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function openFeedbackModal(preselectedRecipientId = null, preselectedRecipientName = "") {
  let modal = document.getElementById("feedback-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "feedback-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">Submit Feedback & Rating</h3>
          <button class="modal-close-btn" data-close-modal>&times;</button>
        </div>
        <form id="feedback-form" onsubmit="handleFeedbackSubmit(event)">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" for="feedback-recipient-select">Recipient</label>
              <select class="form-select" id="feedback-recipient-select" required></select>
            </div>
            <div class="form-group">
              <label class="form-label">Rating</label>
              <div class="star-rating" id="star-rating-picker">
                <span class="star" data-rating="1">★</span>
                <span class="star" data-rating="2">★</span>
                <span class="star" data-rating="3">★</span>
                <span class="star" data-rating="4">★</span>
                <span class="star" data-rating="5">★</span>
              </div>
              <input type="hidden" id="feedback-rating-val" value="5" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="feedback-comments">Written Review</label>
              <textarea class="form-control" id="feedback-comments" rows="4" required placeholder="Describe your experience, mentorship highlights, or constructive feedback..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Review</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeModal("feedback-modal")));

    // Bind star rating picker
    const stars = modal.querySelectorAll(".star-rating .star");
    const valInput = modal.querySelector("#feedback-rating-val");

    stars.forEach((star) => {
      star.addEventListener("click", () => {
        const r = parseInt(star.getAttribute("data-rating"));
        valInput.value = r;
        stars.forEach((s, idx) => {
          s.classList.toggle("active", idx < r);
        });
      });
    });
  }

  // Populate recipient dropdown
  const select = document.getElementById("feedback-recipient-select");
  const role = MentorLink.currentUser.role;
  let options = [];

  if (role === "mentor") {
    options = MentorLink.extra.assigned_mentees || [];
  } else if (role === "mentee") {
    const mentor = MentorLink.extra.assigned_mentor;
    if (mentor) options = [mentor];
  }

  select.innerHTML = options
    .map((o) => `<option value="${o.id}" ${o.id === preselectedRecipientId ? "selected" : ""}>${escapeHtml(o.name)}</option>`)
    .join("");

  // Default to 5 stars active
  const stars = modal.querySelectorAll(".star-rating .star");
  stars.forEach((s) => s.classList.add("active"));
  document.getElementById("feedback-rating-val").value = "5";

  openModal("feedback-modal");
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const recipientId = document.getElementById("feedback-recipient-select").value;
  const rating = parseInt(document.getElementById("feedback-rating-val").value);
  const comments = document.getElementById("feedback-comments").value.trim();

  try {
    const res = await apiFetch("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipientId, rating, comments }),
    });
    closeModal("feedback-modal");
    showToast("Feedback Submitted", res.message, "success");
    loadFeedbackTab();
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

// ==========================================
// 9. Profile Tab
// ==========================================

function loadProfileTab() {
  const container = document.getElementById("tab-profile-content");
  if (!container) return;

  const u = MentorLink.currentUser;
  container.innerHTML = `
    <div class="card" style="max-width:680px;">
      <div class="card-header">
        <h4 class="card-title">⚙️ Manage Profile Information</h4>
      </div>
      <form id="profile-edit-form" onsubmit="handleProfileUpdateSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="profile-email">Email Address (Read-only)</label>
          <input type="text" class="form-control" id="profile-email" value="${escapeHtml(u.email)}" disabled>
          <div class="form-help">Email cannot be changed for account security reasons.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-role">Account Role (Read-only)</label>
          <input type="text" class="form-control" id="profile-role" value="${escapeHtml(u.role.toUpperCase())}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-name">Full Name</label>
          <input type="text" class="form-control" id="profile-name" value="${escapeHtml(u.name)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-dept">Department or Field of Study</label>
          <input type="text" class="form-control" id="profile-dept" value="${escapeHtml(u.department || "")}" placeholder="e.g. Computer Science, Mechanical Engineering">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-skills">Skills (Comma-separated)</label>
          <input type="text" class="form-control" id="profile-skills" value="${escapeHtml(u.skills || "")}" placeholder="e.g. Python, Machine Learning, React, SQL">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-interests">Interests (Comma-separated)</label>
          <input type="text" class="form-control" id="profile-interests" value="${escapeHtml(u.interests || "")}" placeholder="e.g. Open Source, Cloud Architecture, Robotics">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-bio">About Me / Bio</label>
          <textarea class="form-control" id="profile-bio" rows="4" placeholder="Tell others about your mentorship background, goals, or expectations...">${escapeHtml(u.bio || "")}</textarea>
        </div>
        <button type="submit" class="btn btn-primary" id="save-profile-btn">
          Save Changes
        </button>
      </form>
    </div>
  `;
}

async function handleProfileUpdateSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("save-profile-btn");
  btn.disabled = true;
  btn.innerText = "Saving...";

  const name = document.getElementById("profile-name").value.trim();
  const department = document.getElementById("profile-dept").value.trim();
  const skills = document.getElementById("profile-skills").value.trim();
  const interests = document.getElementById("profile-interests").value.trim();
  const bio = document.getElementById("profile-bio").value.trim();

  try {
    const res = await apiFetch("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ name, department, skills, interests, bio }),
    });
    MentorLink.currentUser = res.user;
    renderUserHeader();
    showToast("Profile Updated", "Your changes have been saved.", "success");
  } catch (err) {
    showToast("Update Failed", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Save Changes";
  }
}

// ==========================================
// 10. AI Skill-Gap Detective Tab
// ==========================================
async function loadSkillsTab() {
  const container = document.getElementById("tab-skills-content");
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Analyzing student skill gaps...</div>';

  try {
    const res = await apiFetch("/api/skills/gap-analysis");
    const { assessments, stats } = res;
    const isMentee = MentorLink.currentUser.role === "mentee";

    container.innerHTML = `
      <div class="welcome-hero-banner" style="background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%); margin-bottom: 1.5rem;">
        <div class="welcome-hero-content">
          <div class="welcome-hero-text">
            <h2>🔍 AI Skill-Gap Detective</h2>
            <p>Identifies students' weak skills and recommends targeted learning activities based on assessment results.</p>
          </div>
          <div class="welcome-hero-actions">
            <span class="badge" style="background:rgba(255,255,255,0.25); color:white; font-size:0.9rem; padding:0.5rem 1rem;">
              Avg Score: ${stats.average_score}%
            </span>
          </div>
        </div>
      </div>

      <!-- Stats Bar -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
        <div class="stat-card">
          <div class="stat-icon indigo">📚</div>
          <div>
            <div class="stat-number">${stats.total_skills}</div>
            <div class="stat-label">Total Skills Evaluated</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber">⚠️</div>
          <div>
            <div class="stat-number" style="color:#d97706;">${stats.gaps_detected}</div>
            <div class="stat-label">Skill Gaps Detected</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon emerald">🎯</div>
          <div>
            <div class="stat-number" style="color:#059669;">${stats.proficient_skills}</div>
            <div class="stat-label">Proficient Competencies</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">📊</div>
          <div>
            <div class="stat-number">${stats.average_score}%</div>
            <div class="stat-label">Readiness Index</div>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: ${isMentee ? '340px 1fr' : '1fr'}; gap:1.5rem;">
        ${isMentee ? `
        <!-- Self-Assessment Form -->
        <div class="card">
          <div class="card-header">
            <h4 class="card-title">📝 Self-Assess Skill</h4>
          </div>
          <form onsubmit="handleSkillAssessmentSubmit(event)">
            <div class="form-group">
              <label class="form-label" for="assess-skill-name">Skill or Topic</label>
              <input type="text" class="form-control" id="assess-skill-name" placeholder="e.g. Docker, TypeScript, Fast API" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="assess-skill-score">Proficiency Score (0 - 100)</label>
              <input type="number" class="form-control" id="assess-skill-score" min="0" max="100" placeholder="e.g. 65" required>
              <div class="form-help">Scores below 70 are flagged as Skill Gaps.</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="assess-skill-activity">Custom Recommended Activity (Optional)</label>
              <textarea class="form-control" id="assess-skill-activity" rows="3" placeholder="Leave blank for AI auto-recommendation..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" id="assess-submit-btn" style="width:100%;">
              🔍 Run Gap Diagnostic
            </button>
          </form>
        </div>
        ` : ''}

        <!-- Assessed Skills List -->
        <div class="card">
          <div class="card-header">
            <h4 class="card-title">🎯 Competency Diagnostics & Learning Recommendations (${assessments.length})</h4>
          </div>
          ${assessments.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">No assessments on record</div>
              <div class="empty-state-desc">Evaluate your technical skills to identify focus areas and get custom learning assignments.</div>
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:1.25rem;">
              ${assessments.map(a => `
                <div style="border:1px solid var(--border); border-radius:var(--radius-md); padding:1.25rem; background:${a.status === 'gap_detected' ? 'rgba(254, 242, 242, 0.5)' : 'rgba(240, 253, 244, 0.5)'}; border-left:4px solid ${a.status === 'gap_detected' ? '#ef4444' : '#10b981'};">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                    <div>
                      <strong style="font-size:1.05rem; color:var(--text-main);">${escapeHtml(a.skill_name)}</strong>
                      <span style="font-size:0.8rem; color:var(--text-muted); margin-left:0.5rem;">${a.created_at ? a.created_at.slice(0, 10) : ''}</span>
                    </div>
                    <div>
                      ${a.status === 'gap_detected' 
                        ? '<span class="badge badge-danger">⚠️ Gap Detected</span>' 
                        : '<span class="badge badge-success">✓ Proficient</span>'}
                      <span style="font-weight:800; margin-left:0.5rem; color:${a.score < 70 ? '#dc2626' : '#059669'};">${a.score}/100</span>
                    </div>
                  </div>
                  
                  <div class="progress-track" style="margin-bottom:0.75rem; height:8px;">
                    <div class="progress-fill" style="width:${a.score}%; background:${a.score < 70 ? 'linear-gradient(90deg, #ef4444, #f59e0b)' : 'linear-gradient(90deg, #10b981, #059669)'};"></div>
                  </div>

                  <div style="background:white; border:1px dashed var(--border); border-radius:var(--radius-sm); padding:0.85rem; font-size:0.875rem;">
                    <div style="font-weight:700; color:var(--primary); margin-bottom:0.25rem; display:flex; align-items:center; gap:0.4rem;">
                      <span>💡 AI Targeted Recommendation:</span>
                    </div>
                    <div style="color:var(--text-main);">${escapeHtml(a.recommended_activity)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:var(--danger);">Error loading skill analysis: ${escapeHtml(err.message)}</div>`;
  }
}

async function handleSkillAssessmentSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("assess-submit-btn");
  btn.disabled = true;
  btn.innerText = "Analyzing...";

  const skill_name = document.getElementById("assess-skill-name").value.trim();
  const score = parseInt(document.getElementById("assess-skill-score").value, 10);
  const recommended_activity = document.getElementById("assess-skill-activity").value.trim();

  try {
    const res = await apiFetch("/api/skills/assess", {
      method: "POST",
      body: JSON.stringify({ skill_name, score, recommended_activity }),
    });
    showToast("Assessment Recorded", res.message || "Skill diagnostic complete!", "success");
    loadSkillsTab();
  } catch (err) {
    showToast("Error", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "🔍 Run Gap Diagnostic";
  }
}

// ==========================================
// 11. Adaptive Mentoring Roadmap Tab
// ==========================================
async function loadRoadmapTab() {
  const container = document.getElementById("tab-roadmap-content");
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Generating adaptive roadmap...</div>';

  try {
    const res = await apiFetch("/api/roadmap");
    const { roadmap, progress_pct, completed_goals, total_goals } = res;

    container.innerHTML = `
      <div class="welcome-hero-banner" style="background: linear-gradient(135deg, #0e7490 0%, #06b6d4 100%); margin-bottom: 1.5rem;">
        <div class="welcome-hero-content">
          <div class="welcome-hero-text">
            <h2>🗺️ Adaptive Mentoring Roadmap</h2>
            <p>Creates personalized learning plans and adjusts weekly goals according to students' progress and completed tasks.</p>
          </div>
          <div class="welcome-hero-actions">
            <span class="badge" style="background:rgba(255,255,255,0.25); color:white; font-size:0.9rem; padding:0.5rem 1rem;">
              Overall Progress: ${progress_pct}%
            </span>
          </div>
        </div>
      </div>

      <!-- Roadmap Header Bar -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <div>
            <strong style="font-size:1.1rem; color:var(--text-main);">Milestone Journey Progress</strong>
            <div style="font-size:0.85rem; color:var(--text-muted);">${completed_goals} of ${total_goals} goals completed</div>
          </div>
          <span style="font-size:1.5rem; font-weight:900; color:var(--primary);">${progress_pct}%</span>
        </div>
        <div class="progress-track" style="height:12px;">
          <div class="progress-fill" style="width:${progress_pct}%; background:linear-gradient(90deg, #06b6d4, #4f46e5);"></div>
        </div>
      </div>

      <!-- Weekly Milestones Grid -->
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">📅 Personalized Weekly Milestones (${roadmap.length})</h4>
        </div>
        ${roadmap.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🗺️</div>
            <div class="empty-state-title">No roadmap items yet</div>
            <div class="empty-state-desc">Your roadmap will adapt automatically once weekly tasks are planned.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            ${roadmap.map(m => `
              <div style="border:1px solid var(--border); border-radius:var(--radius-md); padding:1.25rem; background:white; position:relative;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="background:var(--primary-gradient); color:white; font-weight:800; font-size:0.85rem; padding:0.35rem 0.65rem; border-radius:var(--radius-sm);">
                      Week ${m.week_number}
                    </div>
                    <h4 style="font-size:1.1rem; font-weight:800; margin:0; color:var(--text-main);">${escapeHtml(m.goal_title)}</h4>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="badge ${m.status === 'Completed' ? 'badge-success' : (m.status === 'In Progress' ? 'badge-scheduled' : 'badge-pending')}">
                      ${m.status === 'Completed' ? '✓ Completed' : (m.status === 'In Progress' ? '⚡ In Progress' : '⏳ Pending')}
                    </span>
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Target: ${m.target_completion_date}</span>
                  </div>
                </div>

                <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.5; margin-bottom:0.85rem;">
                  ${escapeHtml(m.goal_description || '')}
                </p>

                ${m.adjusted_reason ? `
                  <div style="background:rgba(238, 242, 255, 0.7); border-left:3px solid var(--primary); padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.825rem; margin-bottom:0.85rem; color:#3730a3;">
                    <strong>🔄 Adaptive Roadmap Adjustment:</strong> ${escapeHtml(m.adjusted_reason)}
                  </div>
                ` : ''}

                <!-- Status Update Controls -->
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; border-top:1px solid var(--border); padding-top:0.75rem; align-items:center;">
                  <span style="font-size:0.8rem; color:var(--text-muted); margin-right:auto;">
                    Mentee: <strong>${escapeHtml(m.mentee_name || 'Student')}</strong> &bull; Mentor: <strong>${escapeHtml(m.mentor_name || 'Faculty')}</strong>
                  </span>
                  ${m.status !== 'In Progress' ? `
                    <button class="btn btn-sm btn-outline" onclick="changeRoadmapStatus(${m.id}, 'In Progress')">
                      Mark In Progress
                    </button>
                  ` : ''}
                  ${m.status !== 'Completed' ? `
                    <button class="btn btn-sm btn-primary" onclick="changeRoadmapStatus(${m.id}, 'Completed')">
                      ✓ Mark Completed
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-secondary" onclick="changeRoadmapStatus(${m.id}, 'Pending')">
                      Reset to Pending
                    </button>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:var(--danger);">Error loading roadmap: ${escapeHtml(err.message)}</div>`;
  }
}

async function changeRoadmapStatus(roadmapId, status) {
  try {
    const res = await apiFetch(`/api/roadmap/${roadmapId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    showToast("Roadmap Updated", res.message || "Goal status updated!", "success");
    loadRoadmapTab();
  } catch (err) {
    showToast("Update Failed", err.message, "error");
  }
}

// ==========================================
// 12. Early Support Signal Engine Tab
// ==========================================
async function loadSupportSignalsTab() {
  const container = document.getElementById("tab-signals-content");
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Scanning for student support signals...</div>';

  try {
    const res = await apiFetch("/api/support-signals");
    const { signals, active_signals_count } = res;

    container.innerHTML = `
      <div class="welcome-hero-banner" style="background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%); margin-bottom: 1.5rem;">
        <div class="welcome-hero-content">
          <div class="welcome-hero-text">
            <h2>🚨 Early Support Signal Engine</h2>
            <p>Detects declining academic performance, missed assignments, and other patterns to alert mentors when students may need additional support.</p>
          </div>
          <div class="welcome-hero-actions">
            <span class="badge" style="background:rgba(255,255,255,0.25); color:white; font-size:0.9rem; padding:0.5rem 1rem;">
              ${active_signals_count} Active Alert${active_signals_count === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h4 class="card-title">⚠️ Real-Time Intervention Signals (${signals.length})</h4>
          <span style="font-size:0.8rem; color:var(--text-muted);">Continuously monitored by MentorLink Intelligence</span>
        </div>
        ${signals.length === 0 ? `
          <div class="empty-state" style="padding:3.5rem 1rem;">
            <div class="empty-state-icon" style="color:#10b981;">🛡️</div>
            <div class="empty-state-title" style="color:var(--text-main);">All Students On Track</div>
            <div class="empty-state-desc" style="max-width:480px; margin:0 auto;">No declining metrics or missed assignment alerts currently detected. The mentorship ecosystem is running smoothly.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.25rem;">
            ${signals.map(s => {
              const riskColor = s.risk_level === 'High' ? '#dc2626' : (s.risk_level === 'Medium' ? '#d97706' : '#2563eb');
              const riskBg = s.risk_level === 'High' ? 'rgba(254, 242, 242, 0.7)' : (s.risk_level === 'Medium' ? 'rgba(255, 251, 235, 0.7)' : 'rgba(239, 246, 255, 0.7)');
              return `
                <div style="border:1px solid var(--border); border-radius:var(--radius-md); padding:1.25rem; background:${riskBg}; border-left:5px solid ${riskColor};">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="badge" style="background:${riskColor}; color:white; font-weight:800; font-size:0.75rem;">
                          ${escapeHtml(s.risk_level.toUpperCase())} RISK
                        </span>
                        <strong style="font-size:1.1rem; color:var(--text-main);">${escapeHtml(s.signal_type.replace(/_/g, ' ').toUpperCase())}</strong>
                      </div>
                      <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.35rem;">
                        Student: <strong>${escapeHtml(s.mentee_name)}</strong> (${escapeHtml(s.mentee_email || '')}) &bull; Mentor: <strong>${escapeHtml(s.mentor_name || 'Assigned Mentor')}</strong>
                      </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="resolveSupportSignal(${s.id})" style="background:${riskColor}; border-color:${riskColor};">
                      ✓ Mark Resolved & Intervention Complete
                    </button>
                  </div>

                  <p style="font-size:0.9rem; color:var(--text-main); line-height:1.5; margin-bottom:0.65rem;">
                    ${escapeHtml(s.details || '')}
                  </p>

                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); background:white; padding:0.5rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <span>📊 <strong>Trigger Metric:</strong> ${escapeHtml(s.trigger_metric || 'Threshold crossed')}</span>
                    <span>Detected: ${s.created_at ? s.created_at.slice(0, 16).replace('T', ' ') : 'Recently'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:var(--danger);">Error loading support signals: ${escapeHtml(err.message)}</div>`;
  }
}

async function resolveSupportSignal(signalId) {
  try {
    const res = await apiFetch(`/api/support-signals/${signalId}/resolve`, { method: "PUT" });
    showToast("Signal Resolved", res.message || "Intervention recorded and alert cleared.", "success");
    loadSupportSignalsTab();
  } catch (err) {
    showToast("Error", err.message, "error");
  }
}

// ==========================================
// 13. Mentoring Impact Analyzer Tab
// ==========================================
async function loadImpactTab() {
  const container = document.getElementById("tab-impact-content");
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Evaluating mentorship outcome metrics...</div>';

  try {
    const res = await apiFetch("/api/impact/analytics");
    const { metrics, summary } = res;

    container.innerHTML = `
      <div class="welcome-hero-banner" style="background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); margin-bottom: 1.5rem;">
        <div class="welcome-hero-content">
          <div class="welcome-hero-text">
            <h2>📈 Mentoring Impact Analyzer</h2>
            <p>Tracks students' progress before and after mentoring sessions to evaluate improvements in academic performance, skills, and goal completion.</p>
          </div>
          <div class="welcome-hero-actions">
            <span class="badge" style="background:rgba(255,255,255,0.25); color:white; font-size:0.95rem; font-weight:800; padding:0.5rem 1rem;">
              Avg Growth: +${summary.average_improvement_pct}%
            </span>
          </div>
        </div>
      </div>

      <!-- 3 Summary KPI Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
        <div class="stat-card">
          <div class="stat-icon emerald">🚀</div>
          <div>
            <div class="stat-number" style="color:#059669;">+${summary.average_improvement_pct}%</div>
            <div class="stat-label">Average Performance Boost</div>
            <div class="stat-trend">Post-mentorship baseline gain</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon indigo">🤝</div>
          <div>
            <div class="stat-number">${summary.total_mentoring_sessions}</div>
            <div class="stat-label">Completed Sessions</div>
            <div class="stat-trend">Direct faculty contact hours</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cyan">✅</div>
          <div>
            <div class="stat-number">${summary.total_milestones_completed}</div>
            <div class="stat-label">Milestones Completed</div>
            <div class="stat-trend">Verified technical goals</div>
          </div>
        </div>
      </div>

      <!-- Comparative Impact Table -->
      <div class="card">
        <div class="card-header">
          <h4 class="card-title">📊 Before & After Mentorship Outcome Evaluations (${metrics.length})</h4>
        </div>
        ${metrics.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📈</div>
            <div class="empty-state-title">No impact records available yet</div>
            <div class="empty-state-desc">Performance analytics are compiled after sessions and task milestones are logged.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1.5rem;">
            ${metrics.map(m => `
              <div style="border:1px solid var(--border); border-radius:var(--radius-md); padding:1.25rem; background:white;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                  <div>
                    <h4 style="font-size:1.15rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem;">
                      ${escapeHtml(m.mentee_name)} <span style="font-size:0.85rem; font-weight:normal; color:var(--text-muted);">(${escapeHtml(m.mentee_department || 'General')})</span>
                    </h4>
                    <div style="font-size:0.85rem; color:var(--text-muted);">
                      Mentored by <strong>${escapeHtml(m.mentor_name)}</strong> &bull; ${m.mentoring_hours} Total Mentoring Hours
                    </div>
                  </div>
                  <span class="badge badge-success" style="font-size:0.95rem; font-weight:800; padding:0.4rem 0.85rem;">
                    +${m.improvement_pct}% Academic Gain
                  </span>
                </div>

                <!-- Before vs After Score Gauge -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; background:var(--bg-subtle); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:0.4rem;">
                      <span>Before Mentoring (Baseline)</span>
                      <span>${m.baseline_score}/100</span>
                    </div>
                    <div class="progress-track" style="height:10px;">
                      <div class="progress-fill" style="width:${m.baseline_score}%; background:#94a3b8;"></div>
                    </div>
                  </div>
                  <div>
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700; color:#059669; margin-bottom:0.4rem;">
                      <span>After Mentoring (Current)</span>
                      <span>${m.current_score}/100</span>
                    </div>
                    <div class="progress-track" style="height:10px;">
                      <div class="progress-fill" style="width:${m.current_score}%; background:linear-gradient(90deg, #10b981, #059669);"></div>
                    </div>
                  </div>
                </div>

                <!-- Qualitative Results -->
                <div style="font-size:0.875rem; color:var(--text-main); background:rgba(255, 251, 235, 0.6); border-left:3px solid #f59e0b; padding:0.75rem 1rem; border-radius:var(--radius-sm);">
                  <strong>Verified Outcome:</strong> ${escapeHtml(m.outcome_notes || 'Continuous growth across core domain skills.')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:2rem; text-align:center; color:var(--danger);">Error loading impact analytics: ${escapeHtml(err.message)}</div>`;
  }
}
