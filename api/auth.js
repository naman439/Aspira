const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const router = express.Router();

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
        "INSERT INTO users (id, name, email, provider, provider_id) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, email || null, provider, providerId);
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
// HELPER: Set session from DB user row
// ============================================================
function setSession(req, dbUser) {
    const userObj = {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        isPro: 1, // Treat everyone as Pro now
        plan: 'pro',
        industry: dbUser.industry,
        experience: dbUser.experience,
        provider: dbUser.provider
    };
    req.session.userId = dbUser.id;
    req.session.user = userObj;
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
        db.prepare("INSERT INTO users (id, name, email, password, provider) VALUES (?, ?, ?, ?, 'email')").run(id, name, email, hashed);

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
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ user: req.session.user });
});

// PUT /api/auth/onboard
router.put('/onboard', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const { industry, experience } = req.body;
    const db = getDb();
    db.prepare('UPDATE users SET industry = ?, experience = ? WHERE id = ?').run(industry, experience, req.session.user.id);
    req.session.user.industry = industry;
    req.session.user.experience = experience;
    res.json({ success: true });
});

// PUT /api/auth/me - Full profile update
router.put('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const { name, industry, experience } = req.body;
    const db = getDb();
    db.prepare('UPDATE users SET name = ?, industry = ?, experience = ? WHERE id = ?').run(name, industry, experience, req.session.user.id);
    req.session.user.name = name;
    req.session.user.industry = industry;
    req.session.user.experience = experience;
    res.json({ success: true });
});

// DELETE /api/auth/me - Delete account
router.delete('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    const db = getDb();
    const userId = req.session.user.id;
    db.prepare('DELETE FROM applications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM resumes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM quizzes WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM interviews WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    req.session.destroy(() => res.json({ success: true }));
});

module.exports = router;
module.exports.passport = passport;
