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

// POST /api/chat/message - Send a message with streaming response
router.post('/message', requireAuth, async (req, res) => {
    try {
        const { message, chatId } = req.body;
        const db = getDb();
        let currentChatId = chatId;

        if (!currentChatId) {
            currentChatId = uuidv4();
            const title = message.substring(0, 50);
            db.prepare('INSERT INTO chats (id, user_id, title) VALUES (?, ?, ?)').run(currentChatId, req.session.user.id, title);
        }

        // Save user message
        db.prepare('INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), currentChatId, 'user', message);

        // Get history for context
        const history = db.prepare('SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(currentChatId);

        const systemPrompt = `You are an expert AI Career Coach for Aspira. You help users with:
- Interview preparation and practice
- Resume writing and optimization  
- Career advice and job search strategies
- Salary negotiation tips
- Tech career guidance

Be concise, friendly, and actionable in your responses. Format with markdown where helpful.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }))
        ];

        // Setup SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send chatId immediately
        res.write(`data: ${JSON.stringify({ chatId: currentChatId })}\n\n`);

        const stream = await groq.chat.completions.create({
            messages,
            model: 'llama-3.3-70b-versatile',
            stream: true,
        });

        let aiResponse = '';
        for await (const chunk of stream) {
            const chunkText = chunk.choices[0]?.delta?.content || '';
            aiResponse += chunkText;
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }

        // Save AI message after stream ends
        db.prepare('INSERT INTO messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), currentChatId, 'assistant', aiResponse);

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (e) {
        console.error(e);
        const isQuotaError = e.status === 429;
        const errorMsg = isQuotaError ? 'Groq API Quota Exceeded. Please wait a moment.' : 'Failed to get AI response';
        
        if (!res.headersSent) {
            res.status(isQuotaError ? 429 : 500).json({ error: errorMsg });
        } else {
            res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
            res.end();
        }
    }
});

// GET /api/chat/history - All user chats
router.get('/history', requireAuth, (req, res) => {
    const db = getDb();
    const chats = db.prepare('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC').all(req.session.user.id);
    res.json({ chats });
});

// GET /api/chat/:chatId - Chat messages
router.get('/:chatId', requireAuth, (req, res) => {
    const db = getDb();
    const chat = db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(req.params.chatId, req.session.user.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.params.chatId);
    res.json({ chat, messages });
});

// DELETE /api/chat/:chatId
router.delete('/:chatId', requireAuth, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE chat_id = ?').run(req.params.chatId);
    db.prepare('DELETE FROM chats WHERE id = ? AND user_id = ?').run(req.params.chatId, req.session.user.id);
    res.json({ success: true });
});

module.exports = router;
