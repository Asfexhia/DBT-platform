import axios from 'axios';
import User from '../models/userModel.js';
import Usage from '../models/usageModel.js';
import Chat from '../models/chatModel.js';
import { checkAndUnlockAchievements, updateLoginStreak } from './achievement-controller.js';

const COZE_API_TOKEN = 'pat_4wMiaXeC0PQaQbzZ3mZl4oADqDPytW0qlGrgqN1IEQHwefoQaqu4nEbqHrzN9KOf';
const COZE_API_BASE = 'https://api.coze.cn';
const BOT_ID = '7517945743194734630';

// New API credentials for Test therapist
const TEST_API_TOKEN = 'pat_k4m2Uj9g2T4yFH3HzI5DEeAB0L8QLANxpY9wlXzNJO135EvUdIFcbH3MLyfHfPU3';
const TEST_BOT_ID = '7541689670422511631';

// AI Therapist chat with Coze
export const chatWithTherapist = async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    
    // Build the prompt with conversation context
    let contextPrompt = '';
    if (conversationHistory && conversationHistory.length > 0) {
      contextPrompt = conversationHistory.map(msg => 
        `${msg.sender === 'user' ? 'User' : 'Therapist'}: ${msg.text}`
      ).join('\n') + '\n';
    }
    
    const fullPrompt = `${contextPrompt}Analyse the user's input and give suggestions or talk with them and provide an answer in paragraphs with spaces between paragraphs and points. Respond as if you are talking to the user in the first person, not the third person:\n\nUser: ${message}\nTherapist:`;
    
    // 调用 Coze API
    const response = await axios.post(`${COZE_API_BASE}/open_api/v2/chat`, {
      bot_id: BOT_ID,
      user: req.user?.id || 'anonymous_user_' + Date.now(),
      query: fullPrompt,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${COZE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Extract the AI response
    console.log('Coze API Response:', JSON.stringify(response.data, null, 2));
    // If Coze indicates an error (non-zero code), return a clear error to the client
    if (response.data && typeof response.data.code !== 'undefined' && response.data.code !== 0) {
      console.error('Coze API returned error code:', response.data.code, response.data.msg || response.data);
      return res.status(502).json({ success: false, message: response.data.msg || 'Coze API error', code: response.data.code, detail: response.data.detail || null });
    }
    
  let aiResponse = 'No response received';
  let aiResponseText = aiResponse;
    
    if (response.data && response.data.messages && response.data.messages.length > 0) {
      // Find the assistant's answer message
      const answerMessage = response.data.messages.find(msg => 
        msg.role === 'assistant' && msg.type === 'answer'
      );
      
      if (answerMessage && answerMessage.content) {
        aiResponse = answerMessage.content;
      } else {
        // Fallback to last assistant message
        const lastAssistantMessage = response.data.messages
          .filter(msg => msg.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage && lastAssistantMessage.content) {
          aiResponse = lastAssistantMessage.content;
        }
      }
    } else if (response.data && response.data.reply) {
      aiResponse = response.data.reply;
    } else if (response.data && response.data.answer) {
      aiResponse = response.data.answer;
    }
    // Normalize aiResponse to a string for safe checks and for returning to clients
    if (typeof aiResponse === 'string') {
      aiResponseText = aiResponse;
    } else if (aiResponse && typeof aiResponse === 'object') {
      // attempt to extract common text properties
      aiResponseText = aiResponse.text || aiResponse.content || JSON.stringify(aiResponse);
    } else {
      aiResponseText = String(aiResponse);
    }

    // Check for training success marker and update user progress
    const isTrainingSuccess = String(aiResponseText || '').includes('[本次教学成功]');
    let newAchievements = [];

    // Update user progress (non-blocking)
    try {
      // Get username from Authorization header or request body
      const authHeader = req.headers.authorization;
      let username = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        username = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
      
      // Fallback to other sources
      username = username || req.user?.username || req.body?.username || req.user?.id || req.body?.userId;
      
      console.log('Attempting to find user with identifier:', username);
      
      if (username) {
        // Try to find user by username first, then by _id if it looks like an ObjectId
        let query;
        if (username.match && username.match(/^[0-9a-fA-F]{24}$/)) {
          query = { _id: username };
        } else {
          query = { username: username };
        }
        
        console.log('Using query:', query);
        const user = await User.findOne(query).exec();
        
        if (user) {
          console.log('Found user:', user.username, 'Training success:', isTrainingSuccess);
          
          // Update login streak
          await updateLoginStreak(user._id);

          if (isTrainingSuccess) {
            console.log('Updating user progress - before:', { train_result: user.train_result, totalTrainingCount: user.totalTrainingCount });
            
            // Increment experience points (train_result) and total training count
            user.train_result = (user.train_result || 0) + 1;
            user.totalTrainingCount = (user.totalTrainingCount || 0) + 1;
            await user.save();
            
            console.log('Updated user progress - after:', { train_result: user.train_result, totalTrainingCount: user.totalTrainingCount });

            // Check for achievements
            newAchievements = await checkAndUnlockAchievements(user._id, 'training_success');
          }
          // Note: No else clause - only update when training is successful
        } else {
          console.log('User not found with identifier:', username);
        }
      } else {
        console.log('No user identifier found in request');
      }
    } catch (incErr) {
      console.error('Failed to update user progress:', incErr.message);
      // don't fail the response on DB errors
    }

    res.json({
      success: true,
      response: aiResponseText,
      trainingSuccess: isTrainingSuccess,
      newAchievements: newAchievements
    });

    // Create a Usage log document (non-blocking)
    try {
      const userId = req.user?.id || null;
      const username = req.user?.username || req.body?.username || '';
      await Usage.create({
        user: userId || null,
        username,
        type: 'train',
        bot_id: BOT_ID,
        connector_uid: req.body?.connector_uid || '',
        conversation_id: '',
        chat_id: '',
        success: true,
        meta: { promptLength: String(fullPrompt.length) }
      });
    } catch (logErr) {
      console.error('Failed to create Usage log (train):', logErr.message);
    }

    // Persist chat history for user (non-blocking)
    try {
      const username = req.user?.username || req.body?.username || '';
      const userId = req.user?.id || null;
      if (username) {
        await Chat.create({
          user: userId || null,
          username,
          bot_id: BOT_ID,
          conversation_id: '',
          messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: aiResponse }
          ]
        });
      }
    } catch (chatErr) {
      console.error('Failed to persist chat (train):', chatErr.message);
    }

  } catch (error) {
    console.error('Error with Coze API (Therapist):', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'An error occurred while generating the response.',
      error: error.message
    });
  }
};

// Test AI Therapist chat with different Coze API
export const chatWithTestTherapist = async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    const additionalMessages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        additionalMessages.push({
          content: msg.text,
          content_type: "text",
          role: msg.sender === 'user' ? 'user' : 'assistant',
          type: msg.sender === 'user' ? 'question' : 'answer'
        });
      });
    }
    additionalMessages.push({
      content: message,
      content_type: "text",
      role: "user",
      type: "question"
    });

    // 1) 发起对话（v3）
    const startResp = await axios.post(`${COZE_API_BASE}/v3/chat`, {
      bot_id: TEST_BOT_ID,
      user_id: req.user?.id || 'user_' + Date.now(),
      stream: false,
      auto_save_history: true,
      additional_messages: additionalMessages,
      parameters: {}
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Check for error codes from Coze v3 start response
    if (startResp.data && typeof startResp.data.code !== 'undefined' && startResp.data.code !== 0) {
      console.error('Coze v3 start API error:', startResp.data.code, startResp.data.msg || startResp.data);
      return res.status(502).json({ success: false, message: startResp.data.msg || 'Coze v3 API error', code: startResp.data.code, detail: startResp.data.detail || null });
    }

    const startData = startResp.data?.data;
    if (!startData) {
      return res.status(500).json({
        success: false,
        message: 'Invalid Coze v3 start response format',
        details: startResp.data
      });
    }

    const conversationId = startData.conversation_id;
    const chatId = startData.id;

    // 2) 轮询检索状态（retrieve）
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const MAX_POLLS = 20;
    const POLL_INTERVAL_MS = 1200;

    let status = startData.status;
    for (let i = 0; i < MAX_POLLS && status === 'in_progress'; i++) {
      await sleep(POLL_INTERVAL_MS);
      const retrieveResp = await axios.get(`${COZE_API_BASE}/v3/chat/retrieve`, {
        params: { conversation_id: conversationId, chat_id: chatId },
        headers: { 'Authorization': `Bearer ${TEST_API_TOKEN}` }
      });
      status = retrieveResp.data?.data?.status;
      if (status === 'failed') {
        throw new Error('Coze chat failed to complete');
      }
    }

    // 3) 拉取最终消息（message/list）
    const listResp = await axios.get(`${COZE_API_BASE}/v3/chat/message/list`, {
      params: { conversation_id: conversationId, chat_id: chatId },
      headers: { 'Authorization': `Bearer ${TEST_API_TOKEN}` }
    });

    const allMessages = Array.isArray(listResp.data?.data) ? listResp.data.data : [];
    const texts = [];
    const images = [];

    const resolveFileUrl = async (fileId) => {
      try {
        const fileResp = await axios.get(`${COZE_API_BASE}/v1/files/retrieve`, {
          params: { file_id: fileId },
          headers: { 'Authorization': `Bearer ${TEST_API_TOKEN}` }
        });
        const info = fileResp.data?.data || {};
        return info.url || info.file_url || info.download_url || null;
      } catch {
        return null;
      }
    };

    // 仅保留助手的有效文本/多模态答复，排除元事件与检索类
    const META_TYPES = new Set([
      'knowledge_recall',
      'time_capsule_recall',
      'tool_output',
      'tool_input',
      'function_call',
      'function_output',
      'generate_answer',
      'generate_answer_finish',
      'chat_end',
      'retrieval_result',
      'citation',
      'card',
      'system',
      'debug'
    ]);

    const isTextualAssistantMessage = (m) => {
      const role = String(m?.role || '').toLowerCase();
      const msgType = String(m?.msg_type || m?.type || '').toLowerCase();
      const ctype = String(m?.content_type || '').toLowerCase();
      if (role !== 'assistant') return false;
      if (META_TYPES.has(msgType)) return false;
      return ctype === 'text' || ctype === 'object_string';
    };

    // 优先选择最后一个 msg_type: answer 的助手消息
    const preferred = (() => {
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const m = allMessages[i];
        const role = String(m?.role || '').toLowerCase();
        const ctype = String(m?.content_type || '').toLowerCase();
        const msgType = String(m?.msg_type || m?.type || '').toLowerCase();
        if (role === 'assistant' && (msgType === 'answer') && (ctype === 'text' || ctype === 'object_string')) {
          return m;
        }
      }
      return null;
    })();

    // 其次选择最后一个有效的文本/多模态助手消息
    const fallback = (() => {
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const m = allMessages[i];
        if (isTextualAssistantMessage(m)) return m;
      }
      return null;
    })();

    const candidate = preferred || fallback;

    const pushParts = async (msg) => {
      if (!msg) return;
      if (msg.content_type === 'text' && typeof msg.content === 'string') {
        texts.push(msg.content);
        return;
      }
      if (msg.content_type === 'object_string' && typeof msg.content === 'string') {
        try {
          const parsed = JSON.parse(msg.content);
          const parts = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.parts) ? parsed.parts : null;
          if (!parts) return;
          for (const part of parts) {
            if (part?.type === 'text' && part.text) {
              texts.push(part.text);
            } else if (part?.type === 'image') {
              const directUrl = part.url || part.image_url || part.file_url || null;
              if (directUrl) {
                images.push(directUrl);
              } else if (part.file_id) {
                const resolved = await resolveFileUrl(part.file_id);
                if (resolved) images.push(resolved);
              }
            }
          }
        } catch {
          // ignore malformed object_string
        }
      }
    };

    await pushParts(candidate);

    const finalText = texts.join('\n\n').trim();

    // Check for test result markers and update user progress
    const isTestPass = finalText.includes('[本次测试通过]');
    const isTestFail = finalText.includes('[本次测试不通过]');
    let newAchievements = [];

    // Update user progress based on test results (non-blocking)
    try {
      const userId = req.user?.id || req.body?.userId || req.body?.username || null;
      if (userId) {
        const query = userId.match && userId.match(/^[0-9a-fA-F]{24}$/) ? { _id: userId } : { username: userId };
        const user = await User.findOne(query).exec();
        if (user) {
          if (isTestPass) {
            // Test passed: level up and reset experience
            user.test_result = (user.test_result || 0) + 1;
            user.train_result = 0;
            await user.save();

            // Check for level-based achievements
            newAchievements = await checkAndUnlockAchievements(user._id, 'level_up');
          } else if (isTestFail) {
            // Test failed: increment failure count and reduce experience
            user.testFailureCount = (user.testFailureCount || 0) + 1;
            user.train_result = Math.max(0, (user.train_result || 0) - 3);
            await user.save();

            // Check for failure-based achievements
            newAchievements = await checkAndUnlockAchievements(user._id, 'test_failure');
          }
          // Note: No else clause - only update when test result is explicit
        }
      }
    } catch (incErr) {
      console.error('Failed to update test progress:', incErr.message);
    }

  // Create a Usage log document (non-blocking) with conversation/chat ids
    try {
      const userId = req.user?.id || null;
      const username = req.user?.username || req.body?.username || '';
      await Usage.create({
        user: userId || null,
        username,
        type: 'test',
        bot_id: TEST_BOT_ID,
        connector_uid: req.body?.connector_uid || '',
        conversation_id: conversationId || '',
        chat_id: chatId || '',
        success: true,
        meta: { messagesCount: allMessages.length }
      });
    } catch (logErr) {
      console.error('Failed to create Usage log (test):', logErr.message);
    }

    return res.json({
      success: true,
      response: { text: finalText, images },
      testResult: isTestPass ? 'pass' : isTestFail ? 'fail' : 'none',
      newAchievements: newAchievements
    });

    // Persist chat history for user (non-blocking)
    try {
      const username = req.user?.username || req.body?.username || '';
      const userId = req.user?.id || null;
      if (username) {
        await Chat.create({
          user: userId || null,
          username,
          bot_id: TEST_BOT_ID,
          conversation_id: conversationId || '',
          messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: finalText }
          ]
        });
      }
    } catch (chatErr) {
      console.error('Failed to persist chat (test):', chatErr.message);
    }

  } catch (error) {
    console.error('Error with Test Coze API:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({
      success: false,
      message: 'An error occurred while generating the response.',
      error: error.message,
      details: error.response?.data
    });
  }
};

// Quiz analysis with Coze (existing function)
export const analyzeWithCoze = async (req, res) => {
  try {
    const { questions, answers } = req.body;
    
    // 构建prompt
    const prompt = `Analyze the following mental health quiz answers and generate a short summary regarding the persons mental health and what can he do, use points and headings and generate answer separated by paragraphs, also give a space between different paragraphs:\n\n${questions.map((q, i) => `${i+1}. ${q} ${answers[i]}`).join('\n')}`;
    
    // 调用 Coze API
    const response = await axios.post(`${COZE_API_BASE}/open_api/v2/chat`, {
      bot_id: BOT_ID,
      user: req.user?.id || 'anonymous_user_' + Date.now(),
      query: prompt,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${COZE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Coze API Response (Quiz):', JSON.stringify(response.data, null, 2));
    
    let result = 'No response received';
    if (response.data && response.data.messages && response.data.messages.length > 0) {
      // Find the assistant's answer message
      const answerMessage = response.data.messages.find(msg => 
        msg.role === 'assistant' && msg.type === 'answer'
      );
      
      if (answerMessage && answerMessage.content) {
        result = answerMessage.content;
      } else {
        // Fallback to last assistant message
        const lastAssistantMessage = response.data.messages
          .filter(msg => msg.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage && lastAssistantMessage.content) {
          result = lastAssistantMessage.content;
        }
      }
    } else if (response.data && response.data.reply) {
      result = response.data.reply;
    } else if (response.data && response.data.answer) {
      result = response.data.answer;
    }

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Error with Coze API:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'An error occurred while analyzing the answers.',
      error: error.message
    });
  }
};

// GET user AI usage: counts and recent usage entries
export const getUserAiUsage = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ success: false, message: 'username required' });

    // Try to locate the user document
    const user = await User.findOne({ username }).exec();
    const userId = user?._id || null;

    // Get counts from user doc (fallback to 0)
    const train_result = user?.train_result || 0;
    const test_result = user?.test_result || 0;

    // Fetch last 10 usages
    const recent = await Usage.find({ $or: [{ user: userId }, { username }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .exec();

    res.json({
      success: true,
      data: { train_result, test_result, recent }
    });
  } catch (error) {
    console.error('Error fetching AI usage for user:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch usage', error: error.message });
  }
};

// GET user chat history
export const getUserChats = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ success: false, message: 'username required' });

    const chats = await Chat.find({ username }).sort({ createdAt: -1 }).limit(50).lean().exec();
    res.json({ success: true, data: chats });
  } catch (error) {
    console.error('Error fetching user chats:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch chats', error: error.message });
  }
};
