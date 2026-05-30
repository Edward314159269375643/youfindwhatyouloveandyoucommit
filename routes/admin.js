const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requireRole, logAdminAction } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/dashboard/today-questions', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', date } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT c.*, u.nickname 
            FROM conversations c
            LEFT JOIN user_sessions u ON c.openid = u.openid
            WHERE c.is_from_user = 1
        `;
        const params = [];

        if (date) {
            query += ' AND DATE(c.created_at) = ?';
            params.push(date);
        } else {
            query += ' AND DATE(c.created_at) = CURDATE()';
        }

        if (search) {
            query += ' AND c.content LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [questions] = await pool.query(query, params);

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM conversations c 
             WHERE c.is_from_user = 1 
             ${date ? 'AND DATE(c.created_at) = ?' : 'AND DATE(c.created_at) = CURDATE()'}
             ${search ? 'AND c.content LIKE ?' : ''}`,
            date ? [date, `%${search}%`] : [`%${search}%`]
        );

        res.json({
            success: true,
            questions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取今日问题列表错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/dashboard/stats', async (req, res) => {
    try {
        const [todayStats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT c.openid) as unique_users,
                COUNT(*) as total_messages,
                COUNT(DISTINCT c.session_id) as total_sessions
             FROM conversations c
             WHERE DATE(c.created_at) = CURDATE()`
        );

        const [weekStats] = await pool.query(
            `SELECT 
                COUNT(DISTINCT c.openid) as unique_users,
                COUNT(*) as total_messages
             FROM conversations c
             WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
        );

        const [hourlyStats] = await pool.query(
            `SELECT 
                HOUR(created_at) as hour,
                COUNT(*) as count
             FROM conversations
             WHERE DATE(created_at) = CURDATE()
             GROUP BY HOUR(created_at)
             ORDER BY hour`
        );

        const [dailyTrend] = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                COUNT(DISTINCT openid) as users,
                COUNT(*) as messages
             FROM conversations
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date`
        );

        res.json({
            success: true,
            stats: {
                today: todayStats[0],
                week: weekStats[0],
                hourlyDistribution: hourlyStats,
                dailyTrend: dailyTrend
            }
        });
    } catch (error) {
        console.error('获取统计数据错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/frequent-questions', async (req, res) => {
    try {
        const { page = 1, limit = 20, minFrequency = 2 } = req.query;
        const offset = (page - 1) * limit;

        const [questions] = await pool.query(
            `SELECT qs.*, kb.question as matched_question, kb.answer
             FROM question_stats qs
             LEFT JOIN knowledge_base kb ON qs.related_knowledge_id = kb.id
             WHERE qs.frequency >= ?
             ORDER BY qs.frequency DESC, qs.last_occurrence DESC
             LIMIT ? OFFSET ?`,
            [parseInt(minFrequency), parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM question_stats WHERE frequency >= ?',
            [parseInt(minFrequency)]
        );

        res.json({
            success: true,
            questions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取高频问题错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/frequent-questions/add-to-knowledge-base', async (req, res) => {
    try {
        const { questionStatId, category, answer, keywords } = req.body;
        const userId = req.user.id;

        const [questionStat] = await pool.query(
            'SELECT * FROM question_stats WHERE id = ?',
            [questionStatId]
        );

        if (questionStat.length === 0) {
            return res.status(404).json({ error: '问题记录不存在' });
        }

        const [result] = await pool.query(
            `INSERT INTO knowledge_base (category, question, answer, keywords, created_by, status)
             VALUES (?, ?, ?, ?, ?, 'active')`,
            [category || '高频问题', questionStat[0].normalized_question, answer || '', keywords || '', userId]
        );

        await pool.query(
            'UPDATE question_stats SET related_knowledge_id = ? WHERE id = ?',
            [result.insertId, questionStatId]
        );

        await logAdminAction(userId, 'add_to_knowledge_base', 'question_stats', questionStatId, 
            `将高频问题添加到知识库: ${questionStat[0].normalized_question}`, req.ip);

        res.json({
            success: true,
            message: '已添加到知识库',
            knowledgeId: result.insertId
        });
    } catch (error) {
        console.error('添加到知识库错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.delete('/frequent-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await pool.query('DELETE FROM question_stats WHERE id = ?', [id]);
        
        await logAdminAction(userId, 'delete_frequent_question', 'question_stats', id, '删除高频问题记录', req.ip);

        res.json({ success: true, message: '高频问题已删除' });
    } catch (error) {
        console.error('删除高频问题错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/users', requireRole('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20, role } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT id, username, role, real_name, department, created_at, updated_at FROM users WHERE 1=1';
        const params = [];

        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await pool.query(query, params);

        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');

        res.json({
            success: true,
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.put('/users/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role, real_name, department } = req.body;
        const adminId = req.user.id;

        const updates = [];
        const params = [];

        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        if (real_name) {
            updates.push('real_name = ?');
            params.push(real_name);
        }
        if (department) {
            updates.push('department = ?');
            params.push(department);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: '没有要更新的字段' });
        }

        params.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        await logAdminAction(adminId, 'update_user', 'users', id, `更新用户信息`, req.ip);

        res.json({ success: true, message: '用户信息已更新' });
    } catch (error) {
        console.error('更新用户错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.delete('/users/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        if (parseInt(id) === adminId) {
            return res.status(400).json({ error: '不能删除自己的账户' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        
        await logAdminAction(adminId, 'delete_user', 'users', id, '删除用户', req.ip);

        res.json({ success: true, message: '用户已删除' });
    } catch (error) {
        console.error('删除用户错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/logs', requireRole('admin', 'operator'), async (req, res) => {
    try {
        const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT al.*, u.username, u.real_name
            FROM admin_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (action) {
            query += ' AND al.action = ?';
            params.push(action);
        }
        if (userId) {
            query += ' AND al.user_id = ?';
            params.push(userId);
        }
        if (startDate) {
            query += ' AND al.created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND al.created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [logs] = await pool.query(query, params);

        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM admin_logs');

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取日志错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

module.exports = router;
