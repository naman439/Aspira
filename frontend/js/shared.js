// =============================================
// FRONTEND CONFIGURATION (The "Frontend .env")
// =============================================
const API_CONFIG = {
    // 🛠️ SET THIS TO YOUR RENDER URL FOR PRODUCTION
    // 🏠 FOR LOCAL TESTING: Use "" (Empty String)
    BACKEND_URL: 'https://aspira-2h9i.onrender.com'
};

const API_BASE_URL = window.location.hostname.includes('onrender.com')
    ? API_CONFIG.BACKEND_URL
    : '';

console.log(`%c[Aspira] API Targeting Backend: ${API_BASE_URL || "Local Server"}`, "color: #3b82f6; font-weight: bold;");

// --- Toast Notification ---
function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- API Helper ---
// Supports both (url, options) and (url, method, data) calling conventions
async function api(endpoint, methodOrOptions = {}, bodyData = null) {
    let options = {};
    if (typeof methodOrOptions === 'string') {
        // Called as api(url, 'POST', data)
        options = {
            method: methodOrOptions,
            body: bodyData ? JSON.stringify(bodyData) : undefined
        };
    } else {
        options = methodOrOptions;
    }
    const defaults = {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store'
    };

    // Build full URL if needed
    const fullUrl = endpoint.startsWith('http') ? endpoint : API_BASE_URL + endpoint;

    console.log(`[API] ${options.method || 'GET'} ${fullUrl}`, options.body ? JSON.parse(options.body) : '');

    const res = await fetch(fullUrl, { ...defaults, ...options, headers: { ...defaults.headers, ...(options.headers || {}) } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// Alias for backward compatibility
function toast(message, type = 'info') { showToast(message, type); }

// --- Auth State ---
let currentUser = null;

async function checkAuth(redirectIfNot = '/sign-in') {
    try {
        const data = await api('/api/auth/me');
        currentUser = data.user;
        return currentUser;
    } catch (e) {
        if (redirectIfNot) window.location.href = redirectIfNot;
        return null;
    }
}

async function checkAuthNoRedirect() {
    try {
        const data = await api('/api/auth/me');
        currentUser = data.user;
        return currentUser;
    } catch (e) {
        return null;
    }
}

async function signOut() {
    try {
        await api('/api/auth/signout', { method: 'POST' });
        window.location.href = '/';
    } catch (e) {
        showToast('Sign out failed', 'error');
    }
}

// --- Navbar Builder ---
function buildNav(user) {
    if (!user) return;
    const navName = document.getElementById('nav-name');
    const navAvatar = document.getElementById('nav-avatar');

    if (navName && user.name) {
        navName.textContent = user.name.split(' ')[0];
    }

    if (navAvatar) {
        if (user.avatarUrl) {
            navAvatar.innerHTML = `<img src="${user.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            navAvatar.textContent = '';
        } else if (user.name) {
            navAvatar.textContent = user.name.charAt(0).toUpperCase();
            navAvatar.innerHTML = ''; // Clear any previous image
        }
    }
}

// --- Format Date ---
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Loading State for Buttons ---
function setLoading(btn, loading, originalText) {
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Please wait...`;
    } else {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// --- Simple Markdown to HTML (for chat) ---
function markdownToHtml(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]+?<\/li>)+/g, '<ul>$&</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[h|u|l|p|p])(.+)$/gm, '<p>$1</p>');
}

// Aspira Logo SVG inline
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="50%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- Speech bubble background -->
  <path d="M10,15 Q10,5 20,5 L80,5 Q90,5 90,15 L90,70 Q90,80 80,80 L55,80 L45,95 L35,80 L20,80 Q10,80 10,70 Z" 
    fill="url(#logoGrad)" opacity="0.9"/>
  <!-- A letter -->
  <text x="50" y="57" text-anchor="middle" font-size="42" font-weight="900" fill="white" font-family="Arial, sans-serif"
    style="font-style: italic">A</text>
</svg>`;
// --- Lucide Icons initialization ---
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// --- Global Footer ---
function buildFooter() {
    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <div class="footer-logo">${LOGO_SVG}</div>
                    <span>Aspira</span>
                    <p class="text-xs mt-1">Elevate your career with AI.</p>
                </div>
                <div class="footer-links">
                    <a href="/dashboard">Dashboard</a>
                    <a href="/ats-checker">ATS Check</a>
                    <a href="/sign-in">Sign In</a>
                </div>
                <div class="footer-links">
                    <a href="#">Privacy Policy</a>
                    <a href="https://github.com/naman439/Aspira" target="_blank">GitHub</a>
                    <a href="#">Contact</a>
                </div>
            </div>
            <div class="footer-bottom">
                &copy; 2026 Aspira. Built with passion for students.
            </div>
        </div>
    `;
    const main = document.querySelector('main');
    if (main) {
        main.after(footer);
    } else {
        document.body.appendChild(footer);
    }
}

// Auto-run on load
window.addEventListener('DOMContentLoaded', () => {
    initIcons();

    // 1. Add Back Button to Navbar
    const nav = document.querySelector('.navbar');
    const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';

    if (nav && !isHome) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-ghost btn-sm back-btn';
        // Use inline SVG instead of lucide for absolute reliability
        backBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
        backBtn.onclick = () => window.history.back();
        nav.prepend(backBtn);
    }

    // 2. Brand (Static)
    // Removed click redirect as per user request
});
