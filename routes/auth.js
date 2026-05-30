const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { generateToken, logAdminAction } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = generateToken(user.id, user.role);

        await logAdminAction(user.id, 'login', 'user', user.id, '用户登录', req.ip);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                real_name: user.real_name,
                department: user.department
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { username, password, role, real_name, department } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }

        const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'operator';

        const [result] = await pool.query(
            'INSERT INTO users (username, password, role, real_name, department) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, userRole, real_name || username, department || '']
        );

        res.status(201).json({
            success: true,
            message: '用户注册成功',
            userId: result.insertId
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.post('/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '旧密码和新密码不能为空' });
        }

        const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
        const isValidPassword = await bcrypt.compare(oldPassword, users[0].password);

        if (!isValidPassword) {
            return res.status(401).json({ error: '旧密码错误' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        await logAdminAction(userId, 'change_password', 'user', userId, '修改密码', req.ip);

        res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/profile', async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

module.exports = router;
