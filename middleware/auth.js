const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-guidance-secret-key';

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await pool.query('SELECT id, username, role, real_name, department FROM users WHERE id = ?', [decoded.userId]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: '用户不存在' });
        }

        req.user = users[0];
        next();
    } catch (error) {
        return res.status(403).json({ error: '令牌无效或已过期' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: '权限不足' });
        }
        next();
    };
};

const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const logAdminAction = async (userId, action, targetType, targetId, details, ipAddress) => {
    try {
        await pool.query(
            'INSERT INTO admin_logs (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, action, targetType, targetId, details, ipAddress]
        );
    } catch (error) {
        console.error('记录管理日志失败:', error);
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    generateToken,
    logAdminAction
};
