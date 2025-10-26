import React, { useState, useEffect, useRef } from 'react';
import Loader from 'react-js-loader';
import Navbar from '../navbar/Navbar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Therapist.css';

const TypingAnimation = ({ color }) => (
  <div className="item text-2xl">
    <Loader type="ping-cube" bgColor={color} color={color} size={100} />
  </div>
);

const TestTherapist = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef(null);
  // Entry hint modal: show once per session for Test Therapist
  const [showEntryHint, setShowEntryHint] = useState(false);
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('seenFloatingHintTestTherapist');
      if (!seen) setShowEntryHint(true);
    } catch (e) {}
  }, []);

  const closeEntryHint = () => {
    try { sessionStorage.setItem('seenFloatingHintTestTherapist', '1'); } catch (e) {}
    setShowEntryHint(false);
  };

  const handleSend = async (messageText = null) => {
    const textToSend = messageText || input;
    if (!textToSend.trim()) return;

    const newMessage = { sender: 'user', text: textToSend };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const user = localStorage.getItem('tokenUser');
      const response = await fetch('http://localhost:4000/api/coze/test-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user}`
        },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory: messages
        })
      });

      const data = await response.json();

  if (data.success) {
        let aiText = '';
        let aiImages = [];

        // 回退：仅处理字符串或 { text, images }
        if (typeof data.response === 'string') {
          aiText = data.response;
        } else if (data.response && typeof data.response === 'object') {
          aiText = data.response.text || '';
          aiImages = Array.isArray(data.response.images) ? data.response.images : [];
        }

  // Extract image URLs from text and convert to markdown images
  // Use constructor to avoid escaping issues in JS string context
  const urlRegex = new RegExp('(https?:\\/\\/[^\\s"\'<>]+\\.(?:png|jpe?g|gif|webp|svg))(?![^\\n])', 'gi');
        // Collect markdown image/link syntax (![alt](url) and [text](url)) first
        const mdImageRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
        const mdLinkRegex = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
        const found = [];
        aiText = aiText.replace(mdImageRegex, (m, p1) => { if (p1) found.push(p1); return ''; })
                       .replace(mdLinkRegex, (m, p1) => { if (p1) found.push(p1); return ''; });

        // Also collect any direct image URLs (file extensions)
        aiText = aiText.replace(urlRegex, (m) => {
          found.push(m);
          return '';
        }).trim();

        // Do not append markdown image lines to the text to avoid double-rendering.
        // Keep a separate images array and render images explicitly below.
        if (found.length) {
          aiImages = [...aiImages, ...found];
        }

        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '$1');
        await new Promise(resolve => setTimeout(resolve, 600));
        setMessages([
          ...updatedMessages,
          { sender: 'ai', text: aiText, images: aiImages }
        ]);
        // if test result included in response from backend, mark for mood prompt
        if (data.testResult && data.testResult !== 'none') {
          try { sessionStorage.setItem('needsMoodPrompt', '1'); } catch (e) {}
        }
      } else {
        throw new Error(data.message || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages([...updatedMessages, { sender: 'ai', text: 'An error occurred while generating the response.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => setInput(e.target.value);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  // 新增：处理选项按钮点击事件
  const handleOptionClick = (option) => {
    handleSend(option);
  };

  useEffect(() => {
    // Scroll to the bottom of the chat box whenever messages change
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <React.Fragment>
      <Navbar />
        {/* Entry hint modal for Test Therapist */}
        {showEntryHint && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'white', padding:20, borderRadius:12, minWidth:300, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
              <h3 style={{ marginBottom:8, fontSize:18, fontWeight:600 }}>DBT Coach Test</h3>
              <p style={{ marginBottom:12 }}>When you're ready, double-click the floating mood ball to record how you're feeling.</p>
              <div style={{ textAlign:'right' }}>
                <button onClick={closeEntryHint} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>Got it</button>
              </div>
            </div>
          </div>
        )}
      <div className="therapist-container">
        <h1 className="heading">DBT Coach Test</h1>
        <div ref={chatBoxRef} className="chat-box">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}>
              <div className="ai-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>
              {Array.isArray(msg.images) && msg.images.length > 0 && (
                <div className="ai-images" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {msg.images.map((url, i) => (
                    <img key={i} src={url} alt={`ai-${i}`} style={{ maxWidth: '200px', borderRadius: '8px' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <TypingAnimation color="#007BFF" />}
        </div>
        
        {/* 新增：选项按钮容器 */}
        <div className="option-buttons-container">
          <button 
            onClick={() => handleOptionClick('A')} 
            className="option-button"
            disabled={loading}
          >
            A
          </button>
          <button 
            onClick={() => handleOptionClick('B')} 
            className="option-button"
            disabled={loading}
          >
            B
          </button>
          <button 
            onClick={() => handleOptionClick('C')} 
            className="option-button"
            disabled={loading}
          >
            C
          </button>
          <button 
            onClick={() => handleOptionClick('D')} 
            className="option-button"
            disabled={loading}
          >
            D
          </button>
        </div>

        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="input-field"
          />
          <button onClick={() => handleSend()} className="send-button">Send</button>
        </div>
      </div>
    </React.Fragment>
  );
};

export default TestTherapist;