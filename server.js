const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    const allowedSubdomain = /\.vercel\.app$/;
    if (!origin || origin.startsWith('http://localhost') || allowedSubdomain.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'aspira-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Required for sameSite: 'none'
    sameSite: 'none', // Required for cross-domain cookies (Vercel -> Render)
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Initialize DB
const { initDb } = require('./api/db');
initDb();

// Initialize Passport (must be after session, after initDb)
const authModule = require('./api/auth');
const passport = authModule.passport;
app.use(passport.initialize());
app.use(passport.session());

// API Routes
const interviewRoutes = require('./api/interview');
const chatRoutes = require('./api/chat');
const resumeRoutes = require('./api/resume');
const quizRoutes = require('./api/quiz');
const dashboardRoutes = require('./api/dashboard');
const trackerRoutes = require('./api/tracker');

app.use('/api/auth', authModule);
app.use('/api/interview', interviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tracker', trackerRoutes);

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/sign-in', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sign-in.html')));
app.get('/sign-up', (req, res) => res.sendFile(path.join(__dirname, 'public', 'sign-up.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/interview', (req, res) => res.sendFile(path.join(__dirname, 'public', 'interview.html')));
app.get('/feedback', (req, res) => res.sendFile(path.join(__dirname, 'public', 'feedback.html')));
app.get('/analytics', (req, res) => res.sendFile(path.join(__dirname, 'public', 'analytics.html')));
app.get('/ai-chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ai-chat.html')));
app.get('/resume', (req, res) => res.redirect('/ats-checker'));
app.get('/resume-edit', (req, res) => res.redirect('/ats-checker'));
app.get('/resume-templates', (req, res) => res.redirect('/ats-checker'));
app.get('/ats-checker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ats-checker.html')));
app.get('/quiz', (req, res) => res.sendFile(path.join(__dirname, 'public', 'quiz.html')));
app.get('/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'public', 'onboarding.html')));
app.get('/tracker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracker.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));
app.get('/interview/details/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'interview-details.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 Aspira server running at http://localhost:${PORT}\n`);
});
