import axios from 'axios';

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
    
    let aiResponse = 'No response received';
    
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

    res.json({
      success: true,
      response: aiResponse
    });

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
    return res.json({
      success: true,
      response: { text: finalText, images }
    });

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
