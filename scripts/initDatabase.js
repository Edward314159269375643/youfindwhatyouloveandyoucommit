const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'hospital_guidance.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const createTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin', 'doctor', 'operator')),
            real_name TEXT,
            department TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT UNIQUE NOT NULL,
            nickname TEXT,
            avatar_url TEXT,
            last_active TEXT DEFAULT (datetime('now', 'localtime')),
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_user_sessions_openid ON user_sessions(openid);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active);

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            openid TEXT NOT NULL,
            message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'voice')),
            content TEXT NOT NULL,
            is_from_user INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_openid ON conversations(openid);
        CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

        CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            keywords TEXT,
            vector_embedding TEXT,
            image_urls TEXT,
            attachments TEXT,
            version INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
        CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
        CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_at ON knowledge_base(created_at);

        CREATE TABLE IF NOT EXISTS knowledge_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            knowledge_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            keywords TEXT,
            image_urls TEXT,
            attachments TEXT,
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (knowledge_id) REFERENCES knowledge_base(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_versions_knowledge_id ON knowledge_versions(knowledge_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_versions_version ON knowledge_versions(version);

        CREATE TABLE IF NOT EXISTS question_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            normalized_question TEXT NOT NULL,
            question_hash TEXT NOT NULL,
            frequency INTEGER DEFAULT 1,
            last_occurrence TEXT DEFAULT (datetime('now', 'localtime')),
            first_occurrence TEXT DEFAULT (datetime('now', 'localtime')),
            related_knowledge_id INTEGER,
            FOREIGN KEY (related_knowledge_id) REFERENCES knowledge_base(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_question_stats_question_hash ON question_stats(question_hash);
        CREATE INDEX IF NOT EXISTS idx_question_stats_frequency ON question_stats(frequency DESC);
        CREATE INDEX IF NOT EXISTS idx_question_stats_last_occurrence ON question_stats(last_occurrence);

        CREATE TABLE IF NOT EXISTS daily_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stat_date TEXT NOT NULL UNIQUE,
            total_visits INTEGER DEFAULT 0,
            unique_users INTEGER DEFAULT 0,
            total_messages INTEGER DEFAULT 0,
            new_users INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_daily_stats_stat_date ON daily_stats(stat_date);

        CREATE TABLE IF NOT EXISTS admin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_admin_logs_user_id ON admin_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
        CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);
    `);
};

const insertDefaultAdmin = () => {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO users (username, password, role, real_name, department)
        VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjQ0dV7GvXY4jCQvPFx0q1Q5rL.ykq', 'admin', '系统管理员', '信息中心')
    `);
    stmt.run();
};

try {
    console.log('正在创建数据库和表...');
    createTables();
    console.log('数据库初始化成功！');
    
    insertDefaultAdmin();
    console.log('默认管理员账户已创建 (admin/admin123)');
    
    db.close();
    console.log('数据库文件位置:', dbPath);
} catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
}
