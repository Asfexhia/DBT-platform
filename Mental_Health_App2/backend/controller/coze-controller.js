import axios from 'axios';
import User from '../models/userModel.js';
import Usage from '../models/usageModel.js';
import Chat from '../models/chatModel.js';
import { checkAndUnlockAchievements, updateLoginStreak } from './achievement-controller.js';

// Doubao (Ark) Chat settings (use env vars; support ARK_API_KEY and Endpoint ID)
const DOUBAO_API_BASE = process.env.DOUBAO_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3';
// Prefer an Endpoint ID (推理接入点)，然后 fallback 到 model id
const DOUBAO_ENDPOINT_ID = process.env.DOUBAO_ENDPOINT_ID || process.env.ENDPOINT_ID || process.env.ENDPOINT || null;
const DOUBAO_MODEL = DOUBAO_ENDPOINT_ID || process.env.DOUBAO_MODEL || 'doubao-pro-32k-240615';
// Support standard name ARK_API_KEY per docs, fallback to previous var
const DOUBAO_API_TOKEN = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || '0f939bc9-1359-466c-b1e5-f744a0d79978'; // recommend moving to env

async function callDoubao(messages) {
  const body = { model: DOUBAO_MODEL, messages };
  try {
    const resp = await axios.post(`${DOUBAO_API_BASE}/chat/completions`, body, {
      headers: {
        Authorization: `Bearer ${DOUBAO_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    const choice = resp.data?.choices?.[0];
    const assistant = choice?.message?.content ?? choice?.text ?? '';
    return assistant;
  } catch (err) {
    // Normalize error info (avoid circular structures)
    const respData = err?.response?.data;
    const safeCause = {
      status: err?.response?.status || null,
      message: err?.message || String(err),
      error: respData?.error || respData || null,
    };
    const wrapped = new Error('Doubao API call failed');
    wrapped.cause = safeCause;
    wrapped.status = safeCause.status;
    // log concise info
    console.error('Doubao API error:', safeCause.status, safeCause.error?.code || '', safeCause.message);
    throw wrapped;
  }
}

// POST /api/coze/chat
export const chatWithTherapist = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user?._id || null;

    const systemMessage = {
      role: 'system',
      content:
        '.'
    };

    const messages = [systemMessage];
    for (const h of conversationHistory) {
      const role = h.role || (h.sender === 'assistant' ? 'assistant' : 'user');
      const content = h.content || h.text || h.message || '';
      if (content && content.trim()) messages.push({ role, content });
    }
    messages.push({ role: 'user', content: message });

    let assistantText = '';
    try {
      assistantText = await callDoubao(messages);
    } catch (e) {
      const cause = e.cause || {};
      // Detect Doubao model/endpoint not found response
      const code = cause?.error?.code || cause?.code || null;
      const msg = cause?.error?.message || cause?.message || String(cause);
      console.error('callDoubao error cause:', code, msg);

      if (code === 'InvalidEndpointOrModel.NotFound' || (e.status === 404 && /model/i.test(msg))) {
        return res.status(400).json({
          success: false,
          message: '模型或 endpoint 不存在或不可用。请确认 DOUBAO_MODEL 是否正确，且当前 API Key 有该模型权限。',
          details: cause
        });
      }

      // generic failure
      return res.status(502).json({ success: false, message: '调用 AI 服务失败', details: cause });
    }

    const trainingSuccess = String(assistantText || '').includes('[本次教学成功]');
    let newAchievements = [];

    // Update user progress if marker present
    try {
      // identify user by a few possible fields
      const authHeader = req.headers.authorization;
      let identifier = null;
      if (authHeader && authHeader.startsWith('Bearer ')) identifier = authHeader.substring(7);
      identifier = identifier || req.user?.username || req.body?.username || req.user?._id || req.body?.userId;

      if (identifier) {
        const query = identifier.match && identifier.match(/^[0-9a-fA-F]{24}$/) ? { _id: identifier } : { username: identifier };
        const user = await User.findOne(query).exec();
        if (user) {
          await updateLoginStreak(user._id);
          if (trainingSuccess) {
            user.train_result = (user.train_result || 0) + 1;
            user.totalTrainingCount = (user.totalTrainingCount || 0) + 1;
            await user.save();
            newAchievements = await checkAndUnlockAchievements(user._id, 'training_success');
          }
        }
      }
    } catch (err) {
      console.error('Failed to update user progress:', err?.message || err);
    }

    // Persist usage & chat asynchronously
    (async () => {
      try {
        await Usage.create({ user: userId || null, username: req.user?.username || req.body?.username || '', type: 'train', model: DOUBAO_MODEL, success: true, meta: {} });
      } catch (e) {
        console.warn('Usage create failed', e?.message || e);
      }
      try {
        await Chat.create({ user: userId || null, username: req.user?.username || req.body?.username || '', bot_id: '', conversation_id: '', messages: [{ role: 'user', content: message }, { role: 'assistant', content: assistantText }] });
      } catch (e) {
        console.warn('Chat persist failed', e?.message || e);
      }
    })();

    return res.json({ success: true, response: assistantText, trainingSuccess, newAchievements });
  } catch (err) {
    console.error('chatWithTherapist error', err?.response?.data || err.message || err);
    return res.status(500).json({ success: false, error: 'Chat failed' });
  }
};

// POST /api/coze/test-chat
export const chatWithTestTherapist = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user?._id || null;

    const systemMessage = {
      role: 'system',
      content: 'You are a test evaluator. Provide clear feedback and include markers like [本次测试通过] when the user passes the test.'
    };

    const messages = [systemMessage];
    for (const h of conversationHistory) {
      const role = h.role || (h.sender === 'assistant' ? 'assistant' : 'user');
      const content = h.content || h.text || h.message || '';
      if (content && content.trim()) messages.push({ role, content });
    }
    messages.push({ role: 'user', content: message });

    let assistantText = '';
    try {
      assistantText = await callDoubao(messages);
    } catch (e) {
      const cause = e.cause || {};
      const code = cause?.error?.code || cause?.code || null;
      const msg = cause?.error?.message || cause?.message || String(cause);
      console.error('callDoubao error cause (test):', code, msg);
      if (code === 'InvalidEndpointOrModel.NotFound' || (e.status === 404 && /model/i.test(msg))) {
        return res.status(400).json({
          success: false,
          message: '模型或 endpoint 不存在或不可用。请确认 DOUBAO_MODEL 是否正确，且当前 API Key 有该模型权限。',
          details: cause
        });
      }
      return res.status(502).json({ success: false, message: '调用 AI 服务失败', details: cause });
    }

    const testPass = assistantText.includes('[本次测试通过]');
    const testFail = assistantText.includes('[本次测试不通过]');
    let newAchievements = [];

    try {
      const identifier = req.user?.username || req.body?.username || req.user?._id || req.body?.userId || null;
      if (identifier) {
        const query = identifier.match && identifier.match(/^[0-9a-fA-F]{24}$/) ? { _id: identifier } : { username: identifier };
        const user = await User.findOne(query).exec();
        if (user) {
          if (testPass) {
            user.test_result = (user.test_result || 0) + 1;
            user.train_result = 0;
            await user.save();
            newAchievements = await checkAndUnlockAchievements(user._id, 'level_up');
          } else if (testFail) {
            user.testFailureCount = (user.testFailureCount || 0) + 1;
            user.train_result = Math.max(0, (user.train_result || 0) - 3);
            await user.save();
            newAchievements = await checkAndUnlockAchievements(user._id, 'test_failure');
          }
        }
      }
    } catch (err) {
      console.error('Failed to update test progress', err?.message || err);
    }

    // Persist usage and chat
    (async () => {
      try {
        await Usage.create({ user: userId || null, username: req.user?.username || req.body?.username || '', type: 'test', model: DOUBAO_MODEL, success: true, meta: {} });
      } catch (e) {
        console.warn('Usage create failed', e?.message || e);
      }
      try {
        await Chat.create({ user: userId || null, username: req.user?.username || req.body?.username || '', bot_id: '', conversation_id: '', messages: [{ role: 'user', content: message }, { role: 'assistant', content: assistantText }] });
      } catch (e) {
        console.warn('Chat persist failed', e?.message || e);
      }
    })();

    return res.json({ success: true, response: { text: assistantText, images: [] }, testResult: testPass ? 'pass' : testFail ? 'fail' : 'none', newAchievements });
  } catch (err) {
    console.error('testChat error', err?.response?.data || err.message || err);
    return res.status(500).json({ success: false, error: 'Test chat failed' });
  }
};

// Quiz analysis (replaces analyzeWithCoze)
export const analyzeWithCoze = async (req, res) => {
  try {
    const { questions, answers } = req.body;
    const prompt = `Analyze the following mental health quiz answers and generate a short summary regarding the person's mental health and recommended actions, use bullet points and headings, separate paragraphs with blank lines.\n\n${questions.map((q, i) => `${i+1}. ${q} ${answers[i]}`).join('\n')}`;

    const systemMessage = { role: 'system', content: 'You are an assistant that summarizes quiz results concisely.' };
    const messages = [systemMessage, { role: 'user', content: prompt }];

    const assistantText = await callDoubao(messages);
    return res.json({ success: true, result: assistantText });
  } catch (err) {
    console.error('analyzeWithCoze error', err?.response?.data || err.message || err);
    return res.status(500).json({ success: false, error: 'Analysis failed' });
  }
};

export const getUserAiUsage = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ success: false, message: 'username required' });
    const user = await User.findOne({ username }).exec();
    const userId = user?._id || null;
    const train_result = user?.train_result || 0;
    const test_result = user?.test_result || 0;
    const recent = await Usage.find({ $or: [{ user: userId }, { username }] }).sort({ createdAt: -1 }).limit(10).lean().exec();
    return res.json({ success: true, data: { train_result, test_result, recent } });
  } catch (err) {
    console.error('getUserAiUsage error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to fetch usage' });
  }
};

export const getUserChats = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ success: false, message: 'username required' });
    const chats = await Chat.find({ username }).sort({ createdAt: -1 }).limit(50).lean().exec();
    return res.json({ success: true, data: chats });
  } catch (err) {
    console.error('getUserChats error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to fetch chats' });
  }
};
