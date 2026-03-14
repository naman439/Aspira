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

// POST /api/quiz/generate - Generate MCQ questions
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { role, skill, count = 10 } = req.body;
        const user = req.session.user;
        
        const prompt = `Generate ${count} multiple choice questions for a ${role} interview focusing on ${skill || 'general technical knowledge'}.
    User Industry: ${user.industry || 'Tech'}
    User Experience Level: ${user.experience || 'Entry-level'}
    
    Format as JSON object with a "questions" array: {
      "questions": [{
        "question": "...",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correct": "A",
        "explanation": "..."
      }]
    }
    Return ONLY JSON.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

        const data = JSON.parse(completion.choices[0].message.content.trim());
        const questions = data.questions || Object.values(data)[0];

        const id = uuidv4();
        const db = getDb();
        db.prepare('INSERT INTO quizzes (id, user_id, role, skill, questions) VALUES (?, ?, ?, ?, ?)')
            .run(id, req.session.user.id, role, skill || '', JSON.stringify(questions));

        res.json({ quizId: id, questions });
    } catch (e) {
        console.error(e);
        if (e.status === 429) {
            return res.status(429).json({ error: 'Groq API Quota Exceeded. Please wait a moment.' });
        }
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

// POST /api/quiz/submit
router.post('/submit', requireAuth, (req, res) => {
    const { quizId, answers } = req.body;
    const db = getDb();
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(quizId, req.session.user.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const questions = JSON.parse(quiz.questions);
    let score = 0;
    questions.forEach((q, i) => {
        if (answers[i] && answers[i] === q.correct) score++;
    });

    db.prepare('UPDATE quizzes SET answers = ?, score = ?, total = ? WHERE id = ?')
        .run(JSON.stringify(answers), score, questions.length, quizId);

    res.json({ score, total: questions.length, percentage: Math.round((score / questions.length) * 100) });
});

// GET /api/quiz/list
router.get('/list', requireAuth, (req, res) => {
    const db = getDb();
    const quizzes = db.prepare('SELECT id, role, skill, score, total, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
    res.json({ quizzes });
});

module.exports = router;
