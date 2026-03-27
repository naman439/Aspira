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

// POST /api/interview/generate - Generate interview questions
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { role, level, techStack, type } = req.body;
        const user = req.session.user;

        // Random seed to ensure uniqueness every call (prevents repetition)
        const randomSeed = Math.floor(Math.random() * 10000);
        const timestamp = Date.now();

        const levelDescription = level === 'fresher'
            ? 'Fresher (0 years experience, fresh graduate — ask introductory, foundational and conceptual questions only. No deep implementation. Focus on basics, academic projects, and learning attitude.)'
            : level === 'junior'
            ? 'Junior (0–2 years experience — ask practical beginner questions, fundamentals, and simple problem-solving)'
            : level === 'mid'
            ? 'Mid-level (2–5 years experience — ask applied questions, system design basics, and moderate coding concepts)'
            : level === 'senior'
            ? 'Senior (5+ years — ask architecture, leadership, complex system design and advanced technical decisions)'
            : 'Lead/Principal (ask strategic decisions, team leadership, architecture trade-offs and scalability)';

        const prompt = `You are an expert technical interviewer. Generate exactly 6 UNIQUE interview questions for the role below.

ROLE: ${role}
EXPERIENCE LEVEL: ${levelDescription}
INTERVIEW TYPE: ${type || 'mixed'}
${techStack ? `TECH STACK FOCUS: ${techStack}` : ''}
UNIQUE SEED (use this to vary questions): #${randomSeed}-${timestamp}

RULES:
1. ALL questions must be directly relevant to the "${role}" role.
2. Questions must match the experience level — NOT too hard for ${level === 'fresher' ? 'a fresher' : 'this level'}.
3. NO generic or repetitive questions. Each question must be distinctly different.
4. ${type === 'behavioral' ? 'All questions should be behavioral (STAR format)' : type === 'technical' ? 'All questions should be technical/coding focused' : 'Mix of behavioral and technical questions'}.
5. Make questions fresh and varied — avoid cliché "tell me about yourself" type questions.

Return ONLY a JSON array: [{"question": "...", "type": "technical|behavioral", "category": "..."}]`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            temperature: 1.0
        });

        const text = completion.choices[0].message.content.trim();
        const data = JSON.parse(text);
        // Sometimes LLMs wrap the array in an object
        const questionsRaw = Array.isArray(data) ? data : (data.questions || Object.values(data)[0]);
        // Shuffle for extra randomness
        const questions = questionsRaw.sort(() => Math.random() - 0.5);

        const id = uuidv4();
        const db = getDb();
        db.prepare(`
      INSERT INTO interviews (id, user_id, role, level, tech_stack, questions, type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, req.session.user.id, role, level, techStack || '', JSON.stringify(questions), type || 'voice');

        res.json({ interviewId: id, questions });
    } catch (e) {
        console.error(e);
        if (e.status === 429) {
            return res.status(429).json({ error: 'Groq API Quota Exceeded. Please wait a moment.' });
        }
        res.status(500).json({ error: 'Failed to generate questions' });
    }
});

// POST /api/interview/feedback - Save feedback after interview
router.post('/feedback', requireAuth, async (req, res) => {
    try {
        const { interviewId, transcript } = req.body;
        const db = getDb();
        const interview = db.prepare('SELECT * FROM interviews WHERE id = ? AND user_id = ?').get(interviewId, req.session.user.id);
        if (!interview) return res.status(404).json({ error: 'Interview not found' });

        const prompt = `Analyze this interview transcript and provide feedback.
    Role: ${interview.role}
    Transcript: ${transcript}
    
    Return JSON: {
      "score": <0-100>,
      "softSkillsScore": <0-100>,
      "techSkillsScore": <0-100>,
      "overallFeedback": "...",
      "strengths": ["...", "..."],
      "improvements": ["...", "..."],
      "categoryScores": {"communication": <0-100>, "technical": <0-100>, "problemSolving": <0-100>}
    }
    Return ONLY the JSON.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        const feedback = JSON.parse(completion.choices[0].message.content.trim());

        db.prepare(`
      UPDATE interviews SET transcript = ?, score = ?, soft_skills_score = ?, tech_skills_score = ?, feedback = ?, status = 'completed'
      WHERE id = ?
    `).run(transcript, feedback.score, feedback.softSkillsScore || 0, feedback.techSkillsScore || 0, JSON.stringify(feedback), interviewId);

        res.json({ feedback });
    } catch (e) {
        console.error(e);
        if (e.status === 429) {
            return res.status(429).json({ error: 'Groq API Quota Exceeded. Please wait a moment.' });
        }
        res.status(500).json({ error: 'Failed to generate feedback' });
    }
});

// GET /api/interview/list
router.get('/list', requireAuth, (req, res) => {
    const db = getDb();
    const interviews = db.prepare(`
    SELECT id, role, level, type, status, score, created_at FROM interviews
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.session.user.id);
    res.json({ interviews });
});

// GET /api/interview/:id
router.get('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const interview = db.prepare('SELECT * FROM interviews WHERE id = ? AND user_id = ?').get(req.params.id, req.session.user.id);
    if (!interview) return res.status(404).json({ error: 'Not found' });
    interview.questions = JSON.parse(interview.questions || '[]');
    interview.feedback = interview.feedback ? JSON.parse(interview.feedback) : null;
    res.json({ interview });
});

module.exports = router;
