const express = require('express');
const { getDb } = require('./db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

// GET /api/dashboard/stats
router.get('/stats', requireAuth, (req, res) => {
    const db = getDb();
    const userId = req.session.user.id;

    const totalInterviews = db.prepare("SELECT COUNT(*) as count FROM interviews WHERE user_id = ? AND status = 'completed'").get(userId);
    const avgScore = db.prepare("SELECT AVG(score) as avg FROM interviews WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL").get(userId);
    const totalQuizzes = db.prepare('SELECT COUNT(*) as count FROM quizzes WHERE user_id = ? AND score IS NOT NULL').get(userId);
    const avgQuizScore = db.prepare('SELECT AVG(CAST(score AS FLOAT)/total*100) as avg FROM quizzes WHERE user_id = ? AND score IS NOT NULL').get(userId);

    // Skill scores for Radar chart
    const skillMetrics = db.prepare(`
        SELECT 
            AVG(soft_skills_score) as soft,
            AVG(tech_skills_score) as tech
        FROM interviews 
        WHERE user_id = ? AND status = 'completed' AND (soft_skills_score > 0 OR tech_skills_score > 0)
    `).get(userId);

    const recentInterviews = db.prepare("SELECT id, role, level, score, soft_skills_score, tech_skills_score, created_at FROM interviews WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 5").all(userId);
    const recentQuizzes = db.prepare('SELECT id, role, skill, score, total, created_at FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);

    // Chart data - last 7 interviews
    const chartData = db.prepare("SELECT role, score, created_at FROM interviews WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL ORDER BY created_at DESC LIMIT 7").all(userId);

    res.json({
        stats: {
            totalInterviews: totalInterviews.count,
            avgInterviewScore: Math.round(avgScore.avg || 0),
            totalQuizzes: totalQuizzes.count,
            avgQuizScore: Math.round(avgQuizScore.avg || 0),
            skills: {
                soft: Math.round(skillMetrics.soft || 0),
                tech: Math.round(skillMetrics.tech || 0)
            }
        },
        recentInterviews,
        recentQuizzes,
        chartData: chartData.reverse()
    });
});

module.exports = router;
