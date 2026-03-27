const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Multer Config for Avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads', 'avatars'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// ============================================================
// PASSPORT CONFIGURATION
// ============================================================

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || APP_URL;

// Helper: find or create an OAuth user
function findOrCreateOAuthUser(provider, providerId, email, name) {
    const db = getDb();

    // 1. Check if user already signed in with this OAuth provider
    const byProvider = db.prepare(
        'SELECT * FROM users WHERE provider = ? AND provider_id = ?'
    ).get(provider, providerId);
    if (byProvider) return byProvider;

    // 2. Check if user with same email exists (link their account)
    if (email) {
        const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (byEmail) {
            // Link OAuth provider to existing account
            db.prepare('UPDATE users SET provider = ?, provider_id = ? WHERE id = ?')
                .run(provider, providerId, byEmail.id);
            return db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
        }
    }

    // 3. Create brand-new user
    const id = uuidv4();
    db.prepare(
        "INSERT INTO users (id, name, full_name, email, provider, provider_id) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, name, email || null, provider, providerId);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${APP_URL}/api/auth/google/callback`,
        scope: ['profile', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || null;
            const name = profile.displayName || 'Google User';
            const user = findOrCreateOAuthUser('google', profile.id, email, name);
            return done(null, user);
        } catch (e) {
            return done(e);
        }
    }));
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${APP_URL}/api/auth/github/callback`,
        scope: ['user:email']
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value || null;
            const name = profile.displayName || profile.username || 'GitHub User';
            const user = findOrCreateOAuthUser('github', profile.id.toString(), email, name);
            return done(null, user);
        } catch (e) {
            return done(e);
        }
    }));
}

// Minimal passport session serialization (we use express-session for the real user object)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        done(null, user);
    } catch (e) { done(e); }
});

// ============================================================
// HELPER: Set session from DB user row (Always fresh)
// ============================================================
function setSession(req, dbUser) {
    if (!dbUser) return null;
    
    const userObj = {
        id: dbUser.id,
        name: dbUser.full_name || dbUser.name || '',
        fullName: dbUser.full_name || dbUser.name || '',
        email: dbUser.email || '',
        isPro: 1, 
        plan: 'pro',
        industry: dbUser.industry || '',
        experience: dbUser.experience || '',
        bio: dbUser.bio || '',
        skills: dbUser.skills || '',
        phone: dbUser.phone || '',
        location: dbUser.location || '',
        currentTitle: dbUser.current_title || '',
        avatarUrl: dbUser.avatar_url || '',
        github_url: dbUser.github_url || '',
        linkedin_url: dbUser.linkedin_url || '',
        portfolio_url: dbUser.portfolio_url || '',
        naukri_url: dbUser.naukri_url || '',
        internshala_url: dbUser.internshala_url || '',
        glassdoor_url: dbUser.glassdoor_url || '',
        wellfound_url: dbUser.wellfound_url || '',
        indeed_url: dbUser.indeed_url || '',
        provider: dbUser.provider || 'email'
    };
    
    req.session.userId = dbUser.id;
    req.session.user = userObj;
    
    // Explicitly save the session to ensure persistence before responding
    req.session.save();
    
    return userObj;
}

// ============================================================
// GOOGLE OAUTH ROUTES
// ============================================================

router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.redirect('/sign-in?error=google_not_configured');
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
    (req, res, next) => {
        passport.authenticate('google', { session: false }, (err, user) => {
            if (err || !user) return res.redirect('/sign-in?error=google_failed');
            const dbUser = typeof user === 'object' && user.id ? user : null;
            if (!dbUser) return res.redirect('/sign-in?error=google_failed');

            const userObj = setSession(req, dbUser);
            // New user (no industry set) → onboarding, else dashboard
            const redirectPath = dbUser.industry ? '/dashboard' : '/onboarding';
            res.redirect(`${FRONTEND_URL}${redirectPath}`);
        })(req, res, next);
    }
);

// ============================================================
// GITHUB OAUTH ROUTES
// ============================================================

router.get('/github', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.redirect('/sign-in?error=github_not_configured');
    }
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback',
    (req, res, next) => {
        passport.authenticate('github', { session: false }, (err, user) => {
            if (err || !user) return res.redirect('/sign-in?error=github_failed');
            const dbUser = typeof user === 'object' && user.id ? user : null;
            if (!dbUser) return res.redirect('/sign-in?error=github_failed');

            const userObj = setSession(req, dbUser);
            const redirectPath = dbUser.industry ? '/dashboard' : '/onboarding';
            res.redirect(`${FRONTEND_URL}${redirectPath}`);
        })(req, res, next);
    }
);

// ============================================================
// EMAIL AUTH ROUTES
// ============================================================

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: 'Email already in use' });

        const hashed = await bcrypt.hash(password, 10);
        const id = uuidv4();
        db.prepare("INSERT INTO users (id, name, full_name, email, password, provider) VALUES (?, ?, ?, ?, ?, 'email')").run(id, name, name, email, hashed);

        const user = { id, name, email, isPro: 1, plan: 'pro', provider: 'email' };
        req.session.userId = id;
        req.session.user = user;
        res.json({ success: true, user });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'All fields required' });

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        if (!user.password) return res.status(401).json({ error: `This account uses ${user.provider} login. Please sign in with ${user.provider}.` });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

        const userObj = setSession(req, user);
        res.json({ success: true, user: userObj });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/signout
router.post('/signout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const userId = req.session.userId || (req.user ? req.user.id : null);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) return res.status(401).json({ error: 'User not found' });
        
        // Always reconstruct user object from DB to avoid staleness
        const userObj = setSession(req, user);
        res.json({ user: userObj });
    } catch (e) {
        console.error('Error in /me:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// DEBUG: Check session status (Remove in production)
router.get('/debug', (req, res) => {
    res.json({
        hasSession: !!req.session,
        userId: req.session.userId,
        sessionUser: req.session.user,
        passportUser: req.user,
        cookies: req.headers.cookie
    });
});

// PUT /api/auth/onboard
router.put('/onboard', (req, res) => {
    if (!req.session.userId && !req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId || req.user.id;
    const { industry, experience } = req.body;
    const db = getDb();
    db.prepare('UPDATE users SET industry = ?, experience = ? WHERE id = ?').run(industry, experience, userId);
    
    // Refresh session
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    setSession(req, updated);
    req.session.save(() => {
        res.json({ success: true });
    });
});

// PUT /api/auth/me - Full profile update
router.put('/me', async (req, res) => {
    const userId = req.session.userId || (req.user ? req.user.id : null);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const body = req.body;
    const { 
        fullName = '', 
        industry = '', 
        experience = '', 
        bio = '', 
        skills = '', 
        github_url = '', 
        linkedin_url = '', 
        portfolio_url = '', 
        naukri_url = '', 
        internshala_url = '', 
        glassdoor_url = '', 
        wellfound_url = '', 
        indeed_url = '',
        google_url = '',
        otta_url = '',
        ziprecruiter_url = '',
        phone = '', 
        location = '', 
        currentTitle = '' 
    } = body;
    
    console.log(`[Auth] Updating profile for user ${userId}`);
    
    const db = getDb();
    try {
        const result = db.prepare(`
            UPDATE users 
            SET full_name = ?, name = ?, industry = ?, experience = ?, bio = ?, skills = ?, 
                github_url = ?, linkedin_url = ?, portfolio_url = ?, 
                naukri_url = ?, internshala_url = ?, glassdoor_url = ?, wellfound_url = ?, indeed_url = ?,
                google_url = ?, otta_url = ?, ziprecruiter_url = ?,
                phone = ?, location = ?, current_title = ?
            WHERE id = ?
        `).run(
            fullName || 'User', fullName || 'User', industry, experience, bio, skills, 
            github_url, linkedin_url, portfolio_url, 
            naukri_url, internshala_url, glassdoor_url, wellfound_url, indeed_url,
            google_url, otta_url, ziprecruiter_url,
            phone, location, currentTitle, userId
        );
        
        if (result.changes === 0) {
            console.warn(`[Auth] No rows updated for user ${userId}`);
            return res.status(404).json({ error: 'User not found' });
        }

        // Refresh user from DB
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const userObj = setSession(req, updatedUser);
        
        req.session.save((err) => {
            if (err) {
                console.error('[Auth] Session save error:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            res.json({ success: true, user: userObj });
        });
    } catch (e) {
        console.error('[Auth] Profile update error:', e);
        res.status(500).json({ error: 'Database update failed: ' + e.message });
    }
});

// POST /api/auth/avatar - Upload profile picture
router.post('/avatar', upload.single('avatar'), (req, res) => {
    if (!req.session.userId && !req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.session.userId || req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const db = getDb();

    try {
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);
        
        // Refresh session
        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        setSession(req, updated);
        
        req.session.save(() => {
            res.json({ success: true, avatarUrl });
        });
    } catch (e) {
        console.error('[Auth] Avatar upload error:', e);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

// DELETE /api/auth/me - Delete account
router.delete('/me', (req, res) => {
    const userId = req.session.userId || (req.session.user ? req.session.user.id : null);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const db = getDb();
    db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM resumes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM quizzes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM interviews WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/profile-stats - Aggregate user statistics
router.get('/profile-stats', (req, res) => {
    if (!req.session.userId && !req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId || req.user.id;
    const db = getDb();

    try {
        const stats = {
            totalInterviews: db.prepare('SELECT COUNT(*) as count FROM interviews WHERE user_id = ?').get(userId).count,
            avgAtsScore: db.prepare('SELECT AVG(score) as avg FROM ats_reports WHERE user_id = ?').get(userId).avg || 0,
            totalResumes: db.prepare('SELECT COUNT(*) as count FROM resumes WHERE user_id = ?').get(userId).count,
            memberSince: db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId).created_at
        };
        res.json(stats);
    } catch (e) {
        console.error('[Auth] Stats error:', e);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/auth/recent-activity - Fetch last 10 actions
router.get('/recent-activity', (req, res) => {
    if (!req.session.userId && !req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId || req.user.id;
    const db = getDb();

    try {
        const interviews = db.prepare('SELECT "interview" as type, role, created_at FROM interviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
        const ats = db.prepare('SELECT "ats" as type, job_role as role, created_at FROM ats_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
        const quizzes = db.prepare('SELECT "quiz" as type, role, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);

        const activity = [...interviews, ...ats, ...quizzes]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);

        res.json(activity);
    } catch (e) {
        console.error('[Auth] Activity error:', e);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

module.exports = router;
module.exports.passport = passport;
