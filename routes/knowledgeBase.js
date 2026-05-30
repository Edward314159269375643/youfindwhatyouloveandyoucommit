const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticateToken, requireRole, logAdminAction } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

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
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('不支持的文件类型'));
    }
});

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, category, status, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM knowledge_base WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [items] = await pool.query(query, params);

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM knowledge_base WHERE 1=1' +
            (category ? ' AND category = ?' : '') +
            (status ? ' AND status = ?' : '') +
            (search ? ' AND (question LIKE ? OR answer LIKE ? OR keywords LIKE ?)' : ''),
            category ? [category, status, `%${search}%`, `%${search}%`, `%${search}%`] :
                       status ? [status, `%${search}%`, `%${search}%`, `%${search}%`] :
                               [`%${search}%`, `%${search}%`, `%${search}%`]
        );

        const [categories] = await pool.query('SELECT DISTINCT category FROM knowledge_base WHERE category IS NOT NULL');

        res.json({
            success: true,
            items,
            categories: categories.map(c => c.category),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取知识库列表错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [item] = await pool.query('SELECT * FROM knowledge_base WHERE id = ?', [id]);

        if (item.length === 0) {
            return res.status(404).json({ error: '知识库条目不存在' });
        }

        const [versions] = await pool.query(
            'SELECT * FROM knowledge_versions WHERE knowledge_id = ? ORDER BY version DESC',
            [id]
        );

        res.json({
            success: true,
            item: item[0],
            versions
        });
    } catch (error) {
        console.error('获取知识库详情错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/', requireRole('admin', 'doctor'), async (req, res) => {
    try {
        const { category, question, answer, keywords, image_urls, attachments } = req.body;
        const userId = req.user.id;

        if (!question || !answer) {
            return res.status(400).json({ error: '问题和答案不能为空' });
        }

        const [result] = await pool.query(
            `INSERT INTO knowledge_base (category, question, answer, keywords, image_urls, attachments, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                category || '未分类',
                question,
                answer,
                keywords || '',
                image_urls || '[]',
                attachments || '[]',
                userId
            ]
        );

        await pool.query(
            `INSERT INTO knowledge_versions (knowledge_id, version, question, answer, keywords, image_urls, attachments, created_by)
             VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
            [result.insertId, question, answer, keywords || '', image_urls || '[]', attachments || '[]', userId]
        );

        await logAdminAction(userId, 'create_knowledge', 'knowledge_base', result.insertId, 
            `创建知识库条目: ${question.substring(0, 50)}`, req.ip);

        res.status(201).json({
            success: true,
            message: '知识库条目已创建',
            id: result.insertId
        });
    } catch (error) {
        console.error('创建知识库条目错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.put('/:id', requireRole('admin', 'doctor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { category, question, answer, keywords, image_urls, attachments, status } = req.body;
        const userId = req.user.id;

        const [existing] = await pool.query('SELECT * FROM knowledge_base WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '知识库条目不存在' });
        }

        const currentVersion = existing[0].version || 1;
        const newVersion = currentVersion + 1;

        await pool.query(
            `INSERT INTO knowledge_versions (knowledge_id, version, question, answer, keywords, image_urls, attachments, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                newVersion,
                question || existing[0].question,
                answer || existing[0].answer,
                keywords || existing[0].keywords || '',
                image_urls || existing[0].image_urls || '[]',
                attachments || existing[0].attachments || '[]',
                userId
            ]
        );

        const updates = ['version = ?'];
        const params = [newVersion];

        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category);
        }
        if (question !== undefined) {
            updates.push('question = ?');
            params.push(question);
        }
        if (answer !== undefined) {
            updates.push('answer = ?');
            params.push(answer);
        }
        if (keywords !== undefined) {
            updates.push('keywords = ?');
            params.push(keywords);
        }
        if (image_urls !== undefined) {
            updates.push('image_urls = ?');
            params.push(image_urls);
        }
        if (attachments !== undefined) {
            updates.push('attachments = ?');
            params.push(attachments);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }

        params.push(id);
        await pool.query(`UPDATE knowledge_base SET ${updates.join(', ')} WHERE id = ?`, params);

        await logAdminAction(userId, 'update_knowledge', 'knowledge_base', id, 
            `更新知识库条目 v${newVersion}`, req.ip);

        res.json({
            success: true,
            message: '知识库条目已更新',
            version: newVersion
        });
    } catch (error) {
        console.error('更新知识库条目错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [existing] = await pool.query('SELECT * FROM knowledge_base WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: '知识库条目不存在' });
        }

        await pool.query('DELETE FROM knowledge_base WHERE id = ?', [id]);

        await logAdminAction(userId, 'delete_knowledge', 'knowledge_base', id, 
            `删除知识库条目: ${existing[0].question.substring(0, 50)}`, req.ip);

        res.json({ success: true, message: '知识库条目已删除' });
    } catch (error) {
        console.error('删除知识库条目错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/batch-update', requireRole('admin', 'doctor'), async (req, res) => {
    try {
        const { ids, updates } = req.body;
        const userId = req.user.id;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: '缺少要更新的ID列表' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const [existing] = await pool.query(`SELECT * FROM knowledge_base WHERE id IN (${placeholders})`, ids);

        const [maxVersionResult] = await pool.query('SELECT MAX(version) as max_version FROM knowledge_base');
        let currentMaxVersion = maxVersionResult[0].max_version || 0;

        for (const item of existing) {
            currentMaxVersion++;
            
            await pool.query(
                `INSERT INTO knowledge_versions (knowledge_id, version, question, answer, keywords, image_urls, attachments, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.id,
                    currentMaxVersion,
                    updates.question !== undefined ? updates.question : item.question,
                    updates.answer !== undefined ? updates.answer : item.answer,
                    updates.keywords !== undefined ? updates.keywords : (item.keywords || ''),
                    updates.image_urls !== undefined ? updates.image_urls : (item.image_urls || '[]'),
                    updates.attachments !== undefined ? updates.attachments : (item.attachments || '[]'),
                    userId
                ]
            );
        }

        let updateQuery = 'UPDATE knowledge_base SET version = ?';
        const params = [currentMaxVersion];

        if (updates.category !== undefined) {
            updateQuery += ', category = ?';
            params.push(updates.category);
        }
        if (updates.status !== undefined) {
            updateQuery += ', status = ?';
            params.push(updates.status);
        }

        updateQuery += ` WHERE id IN (${placeholders})`;
        params.push(...ids);

        await pool.query(updateQuery, params);

        await logAdminAction(userId, 'batch_update_knowledge', 'knowledge_base', null, 
            `批量更新 ${ids.length} 条知识库条目`, req.ip);

        res.json({
            success: true,
            message: `已更新 ${ids.length} 条记录`,
            updatedCount: ids.length
        });
    } catch (error) {
        console.error('批量更新知识库错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/upload', requireRole('admin', 'doctor'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传文件' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('上传文件错误:', error);
        res.status(500).json({ error: '上传失败' });
    }
});

router.get('/version/:id/:version', async (req, res) => {
    try {
        const { id, version } = req.params;

        const [versionData] = await pool.query(
            'SELECT * FROM knowledge_versions WHERE knowledge_id = ? AND version = ?',
            [id, version]
        );

        if (versionData.length === 0) {
            return res.status(404).json({ error: '版本不存在' });
        }

        res.json({
            success: true,
            version: versionData[0]
        });
    } catch (error) {
        console.error('获取版本详情错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/rollback/:id/:version', requireRole('admin', 'doctor'), async (req, res) => {
    try {
        const { id, version } = req.params;
        const userId = req.user.id;

        const [versionData] = await pool.query(
            'SELECT * FROM knowledge_versions WHERE knowledge_id = ? AND version = ?',
            [id, version]
        );

        if (versionData.length === 0) {
            return res.status(404).json({ error: '版本不存在' });
        }

        const targetVersion = versionData[0];

        const [maxVersionResult] = await pool.query('SELECT MAX(version) as max_version FROM knowledge_base WHERE id = ?', [id]);
        const newVersion = (maxVersionResult[0].max_version || 0) + 1;

        await pool.query(
            `INSERT INTO knowledge_versions (knowledge_id, version, question, answer, keywords, image_urls, attachments, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                newVersion,
                targetVersion.question,
                targetVersion.answer,
                targetVersion.keywords,
                targetVersion.image_urls,
                targetVersion.attachments,
                userId
            ]
        );

        await pool.query(
            `UPDATE knowledge_base SET 
             question = ?, answer = ?, keywords = ?, image_urls = ?, attachments = ?, version = ?
             WHERE id = ?`,
            [
                targetVersion.question,
                targetVersion.answer,
                targetVersion.keywords,
                targetVersion.image_urls,
                targetVersion.attachments,
                newVersion,
                id
            ]
        );

        await logAdminAction(userId, 'rollback_knowledge', 'knowledge_base', id, 
            `回滚到版本 ${version}`, req.ip);

        res.json({
            success: true,
            message: `已回滚到版本 ${version}`,
            newVersion
        });
    } catch (error) {
        console.error('回滚版本错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

module.exports = router;
