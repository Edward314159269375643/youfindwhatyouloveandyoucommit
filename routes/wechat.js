const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/database');
const xml2js = require('xml2js');

const router = express.Router();

const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

const getAccessToken = async () => {
    return process.env.WECHAT_ACCESS_TOKEN || '';
};

const verifySignature = (signature, timestamp, nonce, token) => {
    const arr = [token, timestamp, nonce].sort();
    const sha1 = crypto.createHash('sha1');
    sha1.update(arr.join(''));
    return sha1.digest('hex') === signature;
};

router.get('/wechat', (req, res) => {
    const { signature, timestamp, nonce, echostr } = req.query;
    const token = process.env.WECHAT_TOKEN || 'hospital_guidance_token';

    if (verifySignature(signature, timestamp, nonce, token)) {
        console.log('微信公众号验证成功');
        res.send(echostr);
    } else {
        console.log('微信公众号验证失败');
        res.status(403).send('验证失败');
    }
});

router.post('/wechat', async (req, res) => {
    try {
        const { signature, timestamp, nonce } = req.query;
        const token = process.env.WECHAT_TOKEN || 'hospital_guidance_token';

        if (!verifySignature(signature, timestamp, nonce, token)) {
            return res.status(403).send('验证失败');
        }

        const xml = req.body;
        const result = await parser.parseStringPromise(xml);
        const message = result.xml;

        const msgType = message.MsgType[0];
        const fromUserName = message.FromUserName[0];
        const toUserName = message.ToUserName[0];

        await pool.query(
            `INSERT INTO user_sessions (openid) VALUES (?) 
             ON CONFLICT(openid) DO UPDATE SET last_active = datetime('now', 'localtime')`,
            [fromUserName]
        );

        let replyContent = '';

        if (msgType === 'text') {
            const content = message.Content[0];
            
            await pool.query(
                'INSERT INTO conversations (session_id, openid, message_type, content, is_from_user) VALUES (?, ?, ?, ?, ?)',
                [fromUserName, fromUserName, 'text', content, 1]
            );

            const [knowledgeBase] = await pool.query(
                "SELECT * FROM knowledge_base WHERE status = 'active'"
            );

            let bestMatch = null;
            let highestScore = 0;

            for (const item of knowledgeBase) {
                const keywords = item.keywords ? item.keywords.split(',').map(k => k.trim().toLowerCase()) : [];
                const normalizedContent = content.toLowerCase();
                
                let matchCount = 0;
                for (const keyword of keywords) {
                    if (normalizedContent.includes(keyword)) {
                        matchCount++;
                    }
                }
                
                const score = keywords.length > 0 ? matchCount / keywords.length : 0;
                
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = item;
                }
            }

            if (bestMatch && highestScore > 0.3) {
                replyContent = bestMatch.answer;
            } else {
                replyContent = '感谢您的咨询！您的问题已收到，我们的工作人员会尽快回复您。\n\n您也可以拨打医院热线：123-4567-890\n或前往医院导诊台咨询。';
            }

            await pool.query(
                'INSERT INTO conversations (session_id, openid, message_type, content, is_from_user) VALUES (?, ?, ?, ?, ?)',
                [fromUserName, fromUserName, 'text', replyContent, 0]
            );

        } else if (msgType === 'event') {
            const event = message.Event[0];
            
            if (event === 'subscribe') {
                replyContent = '欢迎关注医院导诊服务！\n\n我是您的智能导诊助手，可以帮您：\n✅ 科室导航\n✅ 专家排班查询\n✅ 常见问题解答\n✅ 预约挂号指引\n\n请直接输入您想咨询的问题，我会尽力为您解答！';
            } else if (event === 'CLICK') {
                const eventKey = message.EventKey ? message.EventKey[0] : '';
                replyContent = `您点击了菜单：${eventKey}`;
            }
        } else if (msgType === 'image') {
            replyContent = '图片已收到，我们的工作人员会尽快处理。如有紧急情况，请拨打医院热线：123-4567-890';
        } else if (msgType === 'voice') {
            const recognition = message.Recognition ? message.Recognition[0] : '';
            if (recognition) {
                replyContent = `您说的是："${recognition}"\n\n正在为您查询相关信息...`;
            } else {
                replyContent = '语音已收到，我们的工作人员会尽快处理。';
            }
        }

        const replyXml = builder.buildObject({
            xml: {
                ToUserName: fromUserName,
                FromUserName: toUserName,
                CreateTime: Math.floor(Date.now() / 1000),
                MsgType: 'text',
                Content: replyContent
            }
        });

        res.set('Content-Type', 'text/xml');
        res.send(replyXml);

    } catch (error) {
        console.error('处理微信消息错误:', error);
        res.status(500).send('success');
    }
});

router.get('/wechat/menu', async (req, res) => {
    try {
        const menu = {
            button: [
                {
                    name: '导诊服务',
                    sub_button: [
                        { type: 'click', name: '科室导航', key: 'dept_nav' },
                        { type: 'click', name: '专家排班', key: 'expert_schedule' },
                        { type: 'click', name: '预约挂号', key: 'appointment' }
                    ]
                },
                {
                    name: '常用功能',
                    sub_button: [
                        { type: 'click', name: '就诊流程', key: 'process' },
                        { type: 'click', name: '交通指引', key: 'traffic' },
                        { type: 'click', name: '联系方式', key: 'contact' }
                    ]
                },
                {
                    type: 'view',
                    name: '在线咨询',
                    url: process.env.WECHAT_CHAT_URL || 'https://your-domain.com/chat.html'
                }
            ]
        };

        res.json({
            success: true,
            menu,
            message: '请在微信公众平台手动配置菜单，或使用以下 JSON：',
            menuJson: JSON.stringify(menu, null, 2)
        });
    } catch (error) {
        console.error('获取菜单配置错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

router.get('/wechat/jsconfig', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: '缺少 url 参数' });
        }

        const appId = process.env.WECHAT_APP_ID;
        const appSecret = process.env.WECHAT_APP_SECRET;

        if (!appId || !appSecret) {
            return res.json({
                success: false,
                message: '请先配置微信公众号 AppID 和 AppSecret'
            });
        }

        const nonceStr = Math.random().toString(36).substr(2, 15);
        const timestamp = Math.floor(Date.now() / 1000);
        const jsapiTicket = 'your_jsapi_ticket';
        
        const string1 = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const signature = crypto.createHash('sha1').update(string1).digest('hex');

        res.json({
            success: true,
            config: {
                appId,
                timestamp,
                nonceStr,
                signature
            }
        });
    } catch (error) {
        console.error('获取 JS-SDK 配置错误:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

module.exports = router;
