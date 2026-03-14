const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const Groq = require('groq-sdk');
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

// GET /api/resume - List all resumes
router.get('/', requireAuth, (req, res) => {
    const db = getDb();
    const resumes = db.prepare('SELECT id, title, created_at, updated_at FROM resumes WHERE user_id = ? ORDER BY updated_at DESC').all(req.session.user.id);
    res.json({ resumes });
});

// POST /api/resume - Create new resume
router.post('/', requireAuth, (req, res) => {
    const { title, template, theme } = req.body;
    const id = uuidv4();
    const db = getDb();
    db.prepare('INSERT INTO resumes (id, user_id, title, template, theme) VALUES (?, ?, ?, ?, ?)').run(
        id, req.session.user.id, title || 'Untitled Resume', template || 'classic', theme || 'classic-black'
    );
    res.json({ id });
});

// GET /api/resume/:id
router.get('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const resume = db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(req.params.id, req.session.user.id);
    if (!resume) return res.status(404).json({ error: 'Not found' });
    resume.personal_details = resume.personal_details ? JSON.parse(resume.personal_details) : {};
    resume.experiences = resume.experiences ? JSON.parse(resume.experiences) : [];
    resume.education = resume.education ? JSON.parse(resume.education) : [];
    resume.skills = resume.skills ? JSON.parse(resume.skills) : [];
    res.json({ resume });
});

// PUT /api/resume/:id
router.put('/:id', requireAuth, (req, res) => {
    const { title, personal_details, summary, experiences, education, skills, template, theme } = req.body;
    const db = getDb();
    db.prepare(`
    UPDATE resumes SET title=?, personal_details=?, summary=?, experiences=?, education=?, skills=?, template=?, theme=?, updated_at=datetime('now')
    WHERE id=? AND user_id=?
  `).run(
        title, JSON.stringify(personal_details), summary,
        JSON.stringify(experiences), JSON.stringify(education), JSON.stringify(skills),
        template || 'classic', theme || 'classic-black',
        req.params.id, req.session.user.id
    );
    res.json({ success: true });
});

// DELETE /api/resume/:id
router.delete('/:id', requireAuth, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM resumes WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
    res.json({ success: true });
});

// POST /api/resume/ai-suggest - Get AI writing suggestions
router.post('/ai-suggest', requireAuth, async (req, res) => {
    try {
        const { section, content, role } = req.body;
        
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: `You are an expert resume writer. Improve this ${section} section for a ${role || 'professional'} resume.
    Current content: ${content}
    
    Return ONLY the improved text, no explanations. Make it ATS-friendly, concise, and impactful. Use action verbs.` }],
            model: 'llama-3.3-70b-versatile',
        });

        res.json({ suggestion: completion.choices[0].message.content.trim() });
    } catch (e) {
        console.error(e);
        if (e.status === 429) {
            return res.status(429).json({ error: 'Groq API Quota Exceeded. Please wait a moment.' });
        }
        res.status(500).json({ error: 'AI suggestion failed' });
    }
});

// POST /api/resume/ats-check - Perform ATS score analysis
router.post('/ats-check', requireAuth, async (req, res) => {
    try {
        const { resumeText, jobRole, jobDescription, resumeName } = req.body;
        if (!resumeText) return res.status(400).json({ error: 'Resume content is required' });

        const prompt = `You are an expert Applicant Tracking System (ATS) and Senior Technical Recruiter.
Analyze the following resume against the provided Job Role and Job Description.

Target Job Role: ${jobRole || 'Professional Role'}
Job Description: ${jobDescription || 'Standard industry requirements'}

Resume Content:
${resumeText}

Provide a detailed ATS compatibility report in JSON format with the following structure:
{
  "score": number (0-100),
  "match_summary": "string briefing highlights",
  "categories": {
    "brevity": { "score": 0-100, "feedback": ["list of tips"] },
    "impact": { "score": 0-100, "feedback": ["list of tips"] },
    "style": { "score": 0-100, "feedback": ["list of tips"] },
    "content": { "score": 0-100, "feedback": ["list of tips"] }
  },
  "missing_keywords": ["list of key technical or soft skills missing"],
  "formatting_issues": ["any issues with fonts, dates, or contact info"]
}
Return ONLY the JSON. No markdown backticks.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0].message.content.trim();
        const analysis = JSON.parse(responseText);
        
        // Save to database
        const db = getDb();
        const reportId = uuidv4();
        db.prepare(`
            INSERT INTO ats_reports (id, user_id, resume_name, job_role, score, analysis_json)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(reportId, req.session.user.id, resumeName || 'Untitled Resume', jobRole || 'Professional Role', analysis.score, JSON.stringify(analysis));
        
        res.json({ ...analysis, reportId });
    } catch (e) {
        console.error('ATS Check Error:', e);
        if (e.status === 429) {
            return res.status(429).json({ error: 'Groq API Quota Exceeded. Please wait a moment.' });
        }
        res.status(500).json({ error: 'ATS analysis failed' });
    }
});

// GET /api/resume/ats-history - Get past ATS checks
router.get('/ats-history', requireAuth, (req, res) => {
    const db = getDb();
    const reports = db.prepare('SELECT id, resume_name, job_role, score, created_at FROM ats_reports WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
    res.json({ reports });
});

// GET /api/resume/ats-report/:id - Get a specific report
router.get('/ats-report/:id', requireAuth, (req, res) => {
    const db = getDb();
    const report = db.prepare('SELECT * FROM ats_reports WHERE id = ? AND user_id = ?').get(req.params.id, req.session.user.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(JSON.parse(report.analysis_json));
});

module.exports = router;
