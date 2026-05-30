const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hospital_guidance.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const query = async (sql, params = []) => {
    sql = sql.replace(/\?/g, (match, offset) => {
        const paramIndex = sql.substring(0, offset).split('?').length - 1;
        return `$${paramIndex + 1}`;
    });

    sql = sql.replace(/CURDATE\(\)/gi, "date('now')");
    sql = sql.replace(/DATE_SUB\(CURDATE\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "date('now', '-$1 days')");
    sql = sql.replace(/HOUR\(([^)]+)\)/gi, "strftime('%H', $1)");
    sql = sql.replace(/DATE\(([^)]+)\)/gi, "date($1)");
    sql = sql.replace(/ON DUPLICATE KEY UPDATE\s+([^;]+)/gi, '');
    sql = sql.replace(/INSERT IGNORE/gi, 'INSERT OR IGNORE');

    const isSelect = sql.trim().toLowerCase().startsWith('select');
    const isInsert = sql.trim().toLowerCase().startsWith('insert');
    const isUpdate = sql.trim().toLowerCase().startsWith('update');
    const isDelete = sql.trim().toLowerCase().startsWith('delete');

    try {
        if (isSelect) {
            const stmt = db.prepare(sql);
            const rows = stmt.all(...params);
            return [rows, []];
        } else if (isInsert) {
            const stmt = db.prepare(sql);
            const result = stmt.run(...params);
            return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }, []];
        } else if (isUpdate || isDelete) {
            const stmt = db.prepare(sql);
            const result = stmt.run(...params);
            return [{ affectedRows: result.changes, insertId: null }, []];
        } else {
            const stmt = db.prepare(sql);
            stmt.run(...params);
            return [{}, []];
        }
    } catch (error) {
        console.error('SQL Error:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    }
};

const pool = {
    query,
    getConnection: async () => {
        return {
            query,
            release: () => {},
            end: () => {}
        };
    },
    end: () => {
        db.close();
    }
};

const testConnection = async () => {
    try {
        db.prepare("SELECT 1").get();
        console.log('数据库连接成功 (SQLite)');
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        return false;
    }
};

const getDb = () => db;

module.exports = { pool, testConnection, getDb };
