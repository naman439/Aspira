/* 
 * Settings / Profile Dashboard Logic
 */

let isEditMode = false;
// currentUser is already declared in shared.js

async function initSettings() {
    try {
        currentUser = await checkAuth('/sign-in');
        if (currentUser) {
            console.log('[Settings] User authenticated:', currentUser.id);
            buildNav(currentUser);
            buildFooter();
            populateProfile(currentUser);
            fetchStats();
            fetchActivity();
            initIcons();
            showToast('Profile Dashboard Ready', 'success');
            
            // Re-bind listeners after load
            bindEvents();
        }
    } catch (err) {
        console.error('[Settings] Initialization failed:', err);
        showToast('Failed to load profile. Please refresh.', 'error');
    }
}

function bindEvents() {
    const editBtn = document.getElementById('editToggleBtn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
    
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarUpload);
    }
}

function toggleEditMode() {
    try {
        isEditMode = !isEditMode;
        const form = document.getElementById('profileForm');
        const btn = document.getElementById('editToggleBtn');
        const saveBtn = document.getElementById('saveBtn');
        const avatarUploadBtn = document.getElementById('avatarUploadBtn');

        if (!form || !btn || !saveBtn) return;

        if (isEditMode) {
            showToast('Editing enabled ✓', 'info');
            form.classList.remove('view-mode');
            form.classList.add('edit-mode');
            btn.innerHTML = '<i data-lucide="x" style="width: 16px; margin-right: 6px;"></i> Cancel';
            btn.className = 'btn btn-secondary btn-sm';
            saveBtn.style.display = 'block';
            if (avatarUploadBtn) avatarUploadBtn.style.display = 'flex';
        } else {
            form.classList.remove('edit-mode');
            form.classList.add('view-mode');
            btn.innerHTML = '<i data-lucide="edit-3" style="width: 16px; margin-right: 6px;"></i> Edit Profile';
            btn.className = 'btn btn-primary';
            saveBtn.style.display = 'none';
            if (avatarUploadBtn) avatarUploadBtn.style.display = 'none';
            populateProfile(currentUser);
        }

        form.querySelectorAll('input, textarea, .custom-select-btn').forEach(el => {
            el.disabled = !isEditMode;
        });

        initIcons();
    } catch (err) {
        console.error('[Settings] Toggle edit failed:', err);
    }
}

function populateProfile(user) {
    if (!user) return;
    
    document.getElementById('heroName').textContent = user.fullName || user.name || 'User Name';
    document.getElementById('heroEmail').textContent = user.email || 'user@example.com';
    document.getElementById('heroIndustry').textContent = user.industry || 'Tech';
    document.getElementById('heroExp').textContent = user.experience || 'Junior';

    if (user.avatarUrl) {
        document.getElementById('avatarPreview').innerHTML = `<img src="${user.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }

    // Form fields
    document.getElementById('fullName').value = user.fullName || user.name || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('location').value = user.location || '';
    document.getElementById('bio').value = user.bio || '';
    document.getElementById('github').value = user.github_url || '';
    document.getElementById('linkedin').value = user.linkedin_url || '';
    document.getElementById('portfolio').value = user.portfolio_url || '';
    document.getElementById('naukri').value = user.naukri_url || '';
    document.getElementById('internshala').value = user.internshala_url || '';
    document.getElementById('glassdoor').value = user.glassdoor_url || '';
    document.getElementById('wellfound').value = user.wellfound_url || '';
    document.getElementById('indeed').value = user.indeed_url || '';
    document.getElementById('google').value = user.google_url || '';
    document.getElementById('otta').value = user.otta_url || '';
    document.getElementById('ziprecruiter').value = user.ziprecruiter_url || '';

    if (user.industry) selectOptionCustom('industry', user.industry, document.querySelector(`#industry-list [onclick*="'${user.industry}'"]`)?.textContent || user.industry);
    if (user.experience) selectOptionCustom('experience', user.experience, document.querySelector(`#experience-list [onclick*="'${user.experience}'"]`)?.textContent || user.experience);
    
    updateCompletion();
}

async function fetchStats() {
    try {
        const stats = await api('/api/auth/profile-stats');
        const sInt = document.getElementById('statInterviews');
        const sAts = document.getElementById('statAts');
        const sRes = document.getElementById('statResumes');
        const sDays = document.getElementById('statDays');

        if (sInt) sInt.textContent = stats.totalInterviews || '0';
        if (sAts) sAts.textContent = (Math.round(stats.avgAtsScore) || '0') + '%';
        if (sRes) sRes.textContent = stats.totalResumes || '0';
        
        if (sDays && stats.memberSince) {
            const created = new Date(stats.memberSince);
            const diff = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
            sDays.textContent = diff || 1;
        }
    } catch (e) {
        console.warn('[Settings] Failed to fetch stats:', e);
    }
}

async function fetchActivity() {
    try {
        const activities = await api('/api/auth/recent-activity');
        const feed = document.getElementById('activityFeed');
        if (!activities || activities.length === 0) {
            feed.innerHTML = '<div class="text-muted text-sm" style="text-align: center; padding: 2rem;">No recent activity found.</div>';
            return;
        }

        feed.innerHTML = activities.map(act => {
            const date = new Date(act.created_at).toLocaleDateString();
            let icon = 'clock';
            if (act.type === 'interview') icon = 'mic';
            if (act.type === 'ats') icon = 'file-search';
            if (act.type === 'quiz') icon = 'zap';

            return `
                <div class="activity-item" style="display: flex; gap: 15px; margin-bottom: 20px; position: relative; z-index: 1;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${icon}" style="width: 18px; color: var(--accent-blue);"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 2px;">${act.type.toUpperCase()}: ${act.role}</div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.5);">${date}</div>
                    </div>
                </div>
            `;
        }).join('');
        initIcons();
    } catch (e) {
        console.warn('[Settings] Failed to fetch activity:', e);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    if (!currentUser) return;

    const submitBtn = document.getElementById('saveBtn');
    const originalText = submitBtn.textContent;
    setLoading(submitBtn, true, 'Saving...');

    const data = {
        fullName: document.getElementById('fullName').value.trim(),
        industry: document.getElementById('industry').value,
        experience: document.getElementById('experience').value,
        phone: document.getElementById('phone').value.trim(),
        location: document.getElementById('location').value.trim(),
        bio: document.getElementById('bio').value.trim(),
        github_url: document.getElementById('github').value.trim(),
        linkedin_url: document.getElementById('linkedin').value.trim(),
        portfolio_url: document.getElementById('portfolio').value.trim(),
        naukri_url: document.getElementById('naukri').value.trim(),
        internshala_url: document.getElementById('internshala').value.trim(),
        glassdoor_url: document.getElementById('glassdoor').value.trim(),
        wellfound_url: document.getElementById('wellfound').value.trim(),
        indeed_url: document.getElementById('indeed').value.trim(),
        google_url: document.getElementById('google').value.trim(),
        otta_url: document.getElementById('otta').value.trim(),
        ziprecruiter_url: document.getElementById('ziprecruiter').value.trim(),
        skills: currentUser.skills || '',
        currentTitle: currentUser.currentTitle || ''
    };

    try {
        await api('/api/auth/me', 'PUT', data);
        showToast('Profile updated ✓', 'success');
        currentUser = { ...currentUser, ...data };
        toggleEditMode();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setLoading(submitBtn, false, originalText);
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        showToast('Uploading avatar...', 'info');
        const res = await fetch(API_BASE_URL + '/api/auth/avatar', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('Avatar updated!', 'success');
            document.getElementById('avatarPreview').innerHTML = `<img src="${data.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            currentUser.avatarUrl = data.avatarUrl;
            buildNav(currentUser);
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Dropdown Helpers
function toggleDropdown(id) {
    if (!isEditMode) return;
    const list = document.getElementById(id + '-list');
    const btn = document.getElementById(id + '-btn');
    const allLists = document.querySelectorAll('.custom-select-list');
    
    const isOpen = list.classList.contains('open');
    allLists.forEach(l => l.classList.remove('open'));
    
    if (!isOpen) {
        list.classList.add('open');
        btn.classList.add('open');
    } else {
        btn.classList.remove('open');
    }
}

function selectOptionCustom(id, val, text) {
    document.getElementById(id).value = val;
    document.getElementById(id + '-display').textContent = text;
    
    const items = document.querySelectorAll(`#${id}-list .custom-select-item`);
    items.forEach(item => {
        item.classList.remove('selected');
        if (item.textContent === text) item.classList.add('selected');
    });
    
    document.getElementById(id + '-list').classList.remove('open');
    document.getElementById(id + '-btn').classList.remove('open');
    updateCompletion();
}

function updateCompletion() {
    const fields = ['fullName', 'phone', 'location', 'bio', 'github', 'linkedin', 'portfolio', 'naukri', 'internshala', 'glassdoor', 'wellfound', 'indeed', 'google', 'otta', 'ziprecruiter'];
    const filled = fields.filter(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    }).length;
    
    const pct = Math.round((filled / fields.length) * 100);
    const bar = document.getElementById('completionBar');
    const text = document.getElementById('completionPct');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = pct + '%';
}

async function confirmDelete() {
    if (confirm('Are you sure you want to delete your account? This action is permanent and will remove all your data.')) {
        try {
            await api('/api/auth/me', 'DELETE');
            showToast('Account deleted successfully', 'success');
            setTimeout(() => window.location.href = '/', 1000);
        } catch (e) {
            showToast('Failed to delete account: ' + e.message, 'error');
        }
    }
}

// Global Nav Logo
window.addEventListener('load', () => {
    const logo = document.getElementById('nav-logo');
    if (logo && typeof LOGO_SVG !== 'undefined') {
        logo.innerHTML = LOGO_SVG;
    }
});

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-list').forEach(l => l.classList.remove('open'));
        document.querySelectorAll('.custom-select-btn').forEach(b => b.classList.remove('open'));
    }
});

// Initialize on load
window.addEventListener('DOMContentLoaded', initSettings);
