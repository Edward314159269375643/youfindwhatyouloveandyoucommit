const bcrypt = require('bcryptjs');

let users = [
    {
        id: 1,
        username: 'admin',
        password: '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjQ0dV7GvXY4jCQvPFx0q1Q5rL.ykq',
        role: 'admin',
        real_name: '系统管理员',
        department: '信息中心',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

let conversations = [];
let knowledgeBase = [
    {
        id: 1,
        category: '就诊流程',
        question: '如何预约挂号？',
        answer: '您可以通过以下方式预约挂号：\n\n1. 医院官网预约\n2. 手机App预约\n3. 电话预约：123-4567-890\n4. 现场窗口预约\n\n建议提前7天预约，专家号源紧张。',
        keywords: '预约,挂号,专家',
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 2,
        category: '科室导航',
        question: '急诊科在哪里？',
        answer: '急诊科位于医院门诊楼1层东侧，24小时开放。\n\n路线指引：\n- 从南门进入，直走50米左转\n- 从北门进入，右转后直行30米\n\n如有紧急情况，请拨打急救电话：120',
        keywords: '急诊,急救,科室',
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 3,
        category: '常见问题',
        question: '医院的上班时间是什么？',
        answer: '医院工作时间：\n\n门诊：\n- 周一至周五：8:00-12:00, 14:00-17:30\n- 周六：8:30-11:30\n- 周日及节假日：休息\n\n急诊：24小时全天候服务\n\n建议就诊前查看官网最新通知。',
        keywords: '时间,上班,工作',
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 4,
        category: '交通指引',
        question: '怎么去医院？',
        answer: '医院地址：北京市朝阳区健康路100号\n\n公共交通：\n- 地铁：2号线健康路站B出口\n- 公交：101、202、303路医院站下车\n\n停车场：地下停车场可容纳500辆车，首小时免费。',
        keywords: '交通,地址,停车',
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },
    {
        id: 5,
        category: '报告查询',
        question: '如何查询检查报告？',
        answer: '检查报告查询方式：\n\n1. 医院官网：登录个人中心查询\n2. 手机App：实时推送报告\n3. 自助打印机：携带就诊卡打印\n4. 科室护士站领取\n\n常规检查报告一般在24-48小时内出结果。',
        keywords: '报告,检查,查询',
        status: 'active',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

let questionStats = [];
let adminLogs = [];

let nextUserId = 2;
let nextConversationId = 1;
let nextKnowledgeId = 6;
let nextStatId = 1;
let nextLogId = 1;

const query = async (sql, params = []) => {
    try {
        sql = sql.toLowerCase();
        
        if (sql.includes('select') && sql.includes('users')) {
            let result = [...users];
            
            if (sql.includes('where username =')) {
                const username = params[0];
                result = result.filter(u => u.username === username);
            } else if (sql.includes('where id =')) {
                const id = parseInt(params[0]);
                result = result.filter(u => u.id === id);
            }
            
            return [result, []];
        }
        
        if (sql.includes('insert') && sql.includes('users')) {
            const user = {
                id: nextUserId++,
                username: params[0],
                password: params[1],
                role: params[2] || 'operator',
                real_name: params[3] || params[0],
                department: params[4] || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            users.push(user);
            return [{ insertId: user.id, affectedRows: 1 }, []];
        }
        
        if (sql.includes('update') && sql.includes('users')) {
            const userId = parseInt(params[params.length - 1]);
            const user = users.find(u => u.id === userId);
            if (user) {
                user.updated_at = new Date().toISOString();
                return [{ affectedRows: 1 }, []];
            }
            return [{ affectedRows: 0 }, []];
        }
        
        if (sql.includes('delete') && sql.includes('users')) {
            const userId = parseInt(params[0]);
            const initialLength = users.length;
            users = users.filter(u => u.id !== userId);
            return [{ affectedRows: initialLength - users.length }, []];
        }
        
        if (sql.includes('select') && sql.includes('knowledge_base')) {
            let result = [...knowledgeBase];
            
            if (sql.includes('where status =')) {
                const status = params[0];
                result = result.filter(k => k.status === status);
            } else if (sql.includes('where id =')) {
                const id = parseInt(params[0]);
                result = result.filter(k => k.id === id);
            }
            
            return [result, []];
        }
        
        if (sql.includes('insert') && sql.includes('conversations')) {
            const conversation = {
                id: nextConversationId++,
                session_id: params[0],
                openid: params[1],
                message_type: params[2],
                content: params[3],
                is_from_user: params[4],
                created_at: new Date().toISOString()
            };
            conversations.push(conversation);
            return [{ insertId: conversation.id, affectedRows: 1 }, []];
        }
        
        if (sql.includes('select') && sql.includes('conversations')) {
            let result = [...conversations];
            
            if (sql.includes('where session_id =')) {
                const sessionId = params[0];
                result = result.filter(c => c.session_id === sessionId);
            } else if (sql.includes('where openid =')) {
                const openid = params[0];
                result = result.filter(c => c.openid === openid);
            }
            
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            return [result, []];
        }
        
        if (sql.includes('delete') && sql.includes('conversations')) {
            const sessionId = params[0];
            const initialLength = conversations.length;
            conversations = conversations.filter(c => c.session_id !== sessionId);
            return [{ affectedRows: initialLength - conversations.length }, []];
        }
        
        if (sql.includes('insert') && sql.includes('question_stats')) {
            const stat = {
                id: nextStatId++,
                normalized_question: params[0],
                question_hash: params[1],
                frequency: params[2] || 1,
                related_knowledge_id: params[3] || null,
                last_occurrence: new Date().toISOString(),
                first_occurrence: new Date().toISOString()
            };
            questionStats.push(stat);
            return [{ insertId: stat.id, affectedRows: 1 }, []];
        }
        
        if (sql.includes('update') && sql.includes('question_stats')) {
            const statId = parseInt(params[0]);
            const stat = questionStats.find(s => s.id === statId);
            if (stat) {
                stat.frequency++;
                stat.last_occurrence = new Date().toISOString();
                return [{ affectedRows: 1 }, []];
            }
            return [{ affectedRows: 0 }, []];
        }
        
        if (sql.includes('select') && sql.includes('question_stats')) {
            let result = [...questionStats];
            
            if (sql.includes('where question_hash =')) {
                const hash = params[0];
                result = result.filter(s => s.question_hash === hash);
            }
            
            result.sort((a, b) => b.frequency - a.frequency);
            
            return [result, []];
        }
        
        if (sql.includes('insert') && sql.includes('admin_logs')) {
            const log = {
                id: nextLogId++,
                user_id: params[0],
                action: params[1],
                target_type: params[2],
                target_id: params[3],
                details: params[4],
                ip_address: params[5],
                created_at: new Date().toISOString()
            };
            adminLogs.push(log);
            return [{ insertId: log.id, affectedRows: 1 }, []];
        }
        
        if (sql.includes('select') && sql.includes('admin_logs')) {
            let result = [...adminLogs];
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return [result, []];
        }
        
        return [[], []];
    } catch (error) {
        console.error('Memory DB Error:', error.message);
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
    end: () => {}
};

const testConnection = async () => {
    try {
        console.log('内存数据库连接成功');
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error.message);
        return false;
    }
};

module.exports = { pool, testConnection };
