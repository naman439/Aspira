const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

// GET /api/tracker - List all applications
router.get('/', requireAuth, (req, res) => {
    const db = getDb();
    const apps = db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY applied_at DESC').all(req.session.user.id);
    res.json({ applications: apps });
});

// POST /api/tracker - Create new application
router.post('/', requireAuth, (req, res) => {
    const { company, role, status, location, salary, notes, job_type, work_mode } = req.body;
    const id = uuidv4();
    const db = getDb();
    db.prepare(`
        INSERT INTO applications (id, user_id, company, role, status, location, salary, notes, job_type, work_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.session.user.id, company, role, status || 'applied', location, salary, notes, job_type || 'full-time', work_mode || 'remote');
    res.json({ success: true, id });
});

// PUT /api/tracker/:id - Update application
router.put('/:id', requireAuth, (req, res) => {
    const { company, role, status, location, salary, notes, job_type, work_mode } = req.body;
    const db = getDb();
    db.prepare(`
        UPDATE applications 
        SET company=?, role=?, status=?, location=?, salary=?, notes=?, job_type=?, work_mode=?, updated_at=datetime('now')
        WHERE id=? AND user_id=?
    `).run(company, role, status, location, salary, notes, job_type, work_mode, req.params.id, req.session.user.id);
    res.json({ success: true });
});

// DELETE /api/tracker/:id
router.delete('/:id', requireAuth, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').run(req.params.id, req.session.user.id);
    res.json({ success: true });
});

module.exports = router;
