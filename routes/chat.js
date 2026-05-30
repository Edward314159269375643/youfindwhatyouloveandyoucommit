const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const crypto = require('crypto');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || 'uploads');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|image\/|audio\/|wav|mp3/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname || mimetype) {
            return cb(null, true);
        }
        cb(new Error('只支持图片和音频文件上传'));
    }
});

const normalizeQuestion = (question) => {
    return question.toLowerCase()
        .replace(/[？?，。.!！,]/g, '')
        .replace(/\s+/g, '')
        .trim();
};

const hashQuestion = (question) => {
    return crypto.createHash('sha256').update(normalizeQuestion(question)).digest('hex');
};

const findBestMatch = async (question, threshold = 0.7) => {
    const normalized = normalizeQuestion(question);
    const words = normalized.split('');
    
    const [knowledgeBase] = await pool.query(
        'SELECT * FROM knowledge_base WHERE status = "active"'
    );

    let bestMatch = null;
    let highestScore = 0;

    for (const item of knowledgeBase) {
        const keywords = item.keywords ? item.keywords.split(',').map(k => k.trim().toLowerCase()) : [];
        const questionWords = normalized;
        
        let matchCount = 0;
        for (const keyword of keywords) {
            if (questionWords.includes(keyword)) {
                matchCount++;
            }
        }
        
        const score = keywords.length > 0 ? matchCount / keywords.length : 0;
        
        if (score > highestScore && score >= threshold) {
            highestScore = score;
            bestMatch = item;
        }
    }

    if (!bestMatch) {
        for (const item of knowledgeBase) {
            const itemQuestion = normalizeQuestion(item.question);
            const similarity = calculateSimilarity(normalized, itemQuestion);
            
            if (similarity > highestScore && similarity >= threshold) {
                highestScore = similarity;
                bestMatch = item;
            }
        }
    }

    return bestMatch;
};

const calculateSimilarity = (str1, str2) => {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
        if (str1[i] === str2[i]) {
            matches++;
        }
    }
    
    return matches / maxLen;
};

const updateQuestionStats = async (question) => {
    try {
        const normalized = normalizeQuestion(question);
        const hash = hashQuestion(question);
        
        const [existing] = await pool.query(
            'SELECT id, frequency FROM question_stats WHERE question_hash = ?',
            [hash]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE question_stats SET frequency = frequency + 1 WHERE id = ?',
                [existing[0].id]
            );
        } else {
            const bestMatch = await findBestMatch(question, 0.6);
            await pool.query(
                'INSERT INTO question_stats (normalized_question, question_hash, frequency, related_knowledge_id) VALUES (?, ?, 1, ?)',
                [normalized, hash, bestMatch ? bestMatch.id : null]
            );
        }
    } catch (error) {
        console.error('更新问题统计失败:', error);
    }
};

const generateResponse = async (question, context = []) => {
    const bestMatch = await findBestMatch(question);
    
    if (bestMatch) {
        let response = bestMatch.answer;
        
        if (bestMatch.image_urls) {
            const images = JSON.parse(bestMatch.image_urls);
            if (images.length > 0) {
                response += '\n\n[图片信息]';
            }
        }
        
        return {
            type: 'text',
            content: response,
            related_knowledge_id: bestMatch.id,
            confidence: 1
        };
    }

    const defaultResponses = [
        '抱歉，我无法理解您的问题。建议您拨打医院热线 123-4567-890 获取人工帮助。',
        '这个问题我暂时无法回答，您可以尝试咨询医院导诊台或查看常见问题列表。',
        '感谢您的提问，这个问题我需要转交给专业医护人员为您解答，请稍后。'
    ];

    return {
        type: 'text',
        content: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
        related_knowledge_id: null,
        confidence: 0
    };
};

router.post('/message', async (req, res) => {
    try {
        const { openid, message, messageType, sessionId } = req.body;

        if (!openid || !message) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const userSessionId = sessionId || `session_${openid}_${Date.now()}`;

        await pool.query(
            `INSERT INTO user_sessions (openid) VALUES (?) 
             ON DUPLICATE KEY UPDATE last_active = CURRENT_TIMESTAMP`,
            [openid]
        );

        await pool.query(
            'INSERT INTO conversations (session_id, openid, message_type, content, is_from_user) VALUES (?, ?, ?, ?, ?)',
            [userSessionId, openid, messageType || 'text', message, true]
        );

        const [recentMessages] = await pool.query(
            'SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at DESC LIMIT 10',
            [userSessionId]
        );

        const context = recentMessages.reverse().map(msg => ({
            role: msg.is_from_user ? 'user' : 'assistant',
            content: msg.content
        }));

        const response = await generateResponse(message, context);

        await pool.query(
            'INSERT INTO conversations (session_id, openid, message_type, content, is_from_user) VALUES (?, ?, ?, ?, ?)',
            [userSessionId, openid, response.type, response.content, false]
        );

        await updateQuestionStats(message);

        res.json({
            success: true,
            response: response.content,
            sessionId: userSessionId,
            relatedKnowledgeId: response.related_knowledge_id
        });
    } catch (error) {
        console.error('处理消息错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/history/:openid', async (req, res) => {
    try {
        const { openid } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const [sessions] = await pool.query(
            `SELECT DISTINCT session_id, MAX(created_at) as last_time 
             FROM conversations 
             WHERE openid = ? 
             GROUP BY session_id 
             ORDER BY last_time DESC 
             LIMIT ? OFFSET ?`,
            [openid, parseInt(limit), parseInt(offset)]
        );

        const sessionsWithMessages = await Promise.all(
            sessions.map(async (session) => {
                const [messages] = await pool.query(
                    'SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at ASC',
                    [session.session_id]
                );
                return {
                    sessionId: session.session_id,
                    lastTime: session.last_time,
                    messages
                };
            })
        );

        const [totalResult] = await pool.query(
            'SELECT COUNT(DISTINCT session_id) as total FROM conversations WHERE openid = ?',
            [openid]
        );

        res.json({
            success: true,
            sessions: sessionsWithMessages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult[0].total,
                totalPages: Math.ceil(totalResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取历史记录错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.delete('/conversation/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        await pool.query('DELETE FROM conversations WHERE session_id = ?', [sessionId]);
        
        res.json({ success: true, message: '对话记录已删除' });
    } catch (error) {
        console.error('删除对话错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.delete('/batch-delete', async (req, res) => {
    try {
        const { sessionIds } = req.body;
        
        if (!sessionIds || !Array.isArray(sessionIds)) {
            return res.status(400).json({ error: '缺少会话ID列表' });
        }

        const placeholders = sessionIds.map(() => '?').join(',');
        await pool.query(`DELETE FROM conversations WHERE session_id IN (${placeholders})`, sessionIds);
        
        res.json({ success: true, message: '已删除多条对话记录', deletedCount: sessionIds.length });
    } catch (error) {
        console.error('批量删除对话错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/upload/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('上传图片错误:', error);
        res.status(500).json({ error: '上传失败' });
    }
});

router.post('/upload/voice', upload.single('voice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('上传语音错误:', error);
        res.status(500).json({ error: '上传失败' });
    }
});

module.exports = router;
