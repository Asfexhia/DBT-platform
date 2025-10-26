import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Loader from 'react-js-loader';
import Navbar from '../navbar/Navbar';
import './Therapist.css';

// Small image component with onError fallback that shows a link to open the image
const ImageWithFallback = ({ src, alt }) => {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div style={{ width: 200, height: 120, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
        <a href={src} target="_blank" rel="noreferrer" style={{ color: '#0366d6', textDecoration: 'underline' }}>Open image</a>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: '200px', borderRadius: '8px' }}
      onError={() => setErrored(true)}
    />
  );
};

const TypingAnimation = ({ color }) => (
  <div className="item text-2xl">
    <Loader type="ping-cube" bgColor={color} color={color} size={100} />
  </div>
);

const Therapist = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState({ level: 0, experience: 0 });
  const [notification, setNotification] = useState(null);
  const [cozeErrorMessage, setCozeErrorMessage] = useState(null);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    fetchUserStats();
  }, []);

  // Entry hint modal: show once per session for Therapist
  const [showEntryHint, setShowEntryHint] = useState(false);
  const [showPostTrainingPrompt, setShowPostTrainingPrompt] = useState(false);
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('seenFloatingHintTherapist');
      if (!seen) setShowEntryHint(true);
    } catch (e) {}
  }, []);

  const closeEntryHint = () => {
    try { sessionStorage.setItem('seenFloatingHintTherapist', '1'); } catch (e) {}
    setShowEntryHint(false);
  };

  const fetchUserStats = async () => {
    try {
      const username = localStorage.getItem('tokenUser');
      if (!username) return;

      const response = await fetch(`http://localhost:4000/api/achievements/${username}`);
      const data = await response.json();

      if (data.success) {
        setUserStats({
          level: data.data.user.level,        // test_result (等级)
          experience: data.data.user.experience // train_result (经验值)
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = { sender: 'user', text: input };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const user = localStorage.getItem('tokenUser');
      const response = await fetch('http://localhost:4000/api/coze/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user}`
        },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages // Send conversation history for context
        })
      });

      // try to parse JSON body
      const data = await response.json().catch(() => null);

      // If backend returned non-2xx (e.g., 502 from Coze errors), surface a friendly message
      if (!response.ok) {
        const friendly = (data && (data.msg || data.message)) || `Server error ${response.status}`;
        console.warn('Coze/backend error:', response.status, data);
        setCozeErrorMessage(friendly);
        // Add an AI message indicating an error occurred
        setMessages(prev => [...prev, { sender: 'ai', text: 'Image generation or AI service is temporarily unavailable. Please try again later.' }]);
        setLoading(false);
        return;
      }

      // clear any previous coze error
      setCozeErrorMessage(null);

      if (data && data.success) {
        let aiMessage = data.response;
        let aiImages = [];

        // Replace **word** with plain text
        aiMessage = aiMessage.replace(/\*\*(.*?)\*\*/g, '$1');

        // Collect markdown links like [text](https://...) and image markdown ![alt](url)
        const mdLinkRegex = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
        const mdImageRegex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
        const found = [];
        aiMessage = aiMessage.replace(mdImageRegex, (m, p1) => {
          if (p1) found.push(p1);
          return '';
        }).replace(mdLinkRegex, (m, p1) => {
          if (p1) found.push(p1);
          return '';
        }).trim();

        // Collect direct image URLs (file extensions)
  const urlRegex = new RegExp('(https?:\\/\\/[^\\s<>]+\\.(?:png|jpe?g|gif|webp|svg))(?![^\\n])', 'gi');
        aiMessage = aiMessage.replace(urlRegex, (m) => {
          found.push(m);
          return '';
        }).trim();

        if (found.length) {
          // Do not append markdown image lines to the text to avoid double-rendering.
          // Keep a separate images array and render images explicitly below.
          aiImages = [...found];
        }

        // Simulate typing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        setMessages([...updatedMessages, { sender: 'ai', text: aiMessage, images: aiImages }]);

        // If the assistant text contains an explicit training-success marker, trigger the post-training prompt
        try {
          if (typeof aiMessage === 'string' && aiMessage.includes('[本次教学成功]')) {
            try { sessionStorage.setItem('needsMoodPrompt', '1'); } catch (e) {}
            setShowPostTrainingPrompt(true);
          }
        } catch (e) {}

        // Check for training success and new achievements
        if (data.trainingSuccess) {
          setUserStats(prev => ({
            ...prev,
            experience: prev.experience + 1
          }));
          showNotification('训练成功！获得1点经验值');
          // mark that user completed training during this session
          try { sessionStorage.setItem('needsMoodPrompt', '1'); } catch (e) {}
          // show immediate prompt to record mood
          setShowPostTrainingPrompt(true);
        }

        if (data.newAchievements && data.newAchievements.length > 0) {
          data.newAchievements.forEach(achievement => {
            showNotification(`🎉 解锁新成就: ${achievement.name} - ${achievement.description}`);
          });
        }

        // Refresh user stats
        fetchUserStats();
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

  useEffect(() => {
    // Scroll to the bottom of the chat box whenever messages change
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const getProgressPercentage = () => {
    return Math.min((userStats.experience / 10) * 100, 100);
  };

  return (
    <>
      <Navbar />
      {/* Coze / backend error banner */}
      {cozeErrorMessage && (
        <div style={{ position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 11000, background: '#fff4ed', color: '#7a2e0a', border: '1px solid #ffd2a8', padding: '8px 12px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
          {cozeErrorMessage}
        </div>
      )}
      {/* Entry hint modal for Therapist */}
      {showEntryHint && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'white', padding:20, borderRadius:12, minWidth:300, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom:8, fontSize:18, fontWeight:600 }}>Welcome to the DBT Coach</h3>
            <p style={{ marginBottom:12 }}>Click the floating mood ball (double-click) to quickly record how you're feeling before or after a session.</p>
            <div style={{ textAlign:'right' }}>
              <button onClick={closeEntryHint} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>Got it</button>
            </div>
          </div>
        </div>
      )}
      <div className="therapist-container">
        {/* User Stats Display */}
        <div className="user-stats-header">
          <div className="stats-item">
            <span className="stats-label">等级</span>
            <span className="stats-value level-badge">Lv.{userStats.level}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">经验值</span>
            <span className="stats-value">{userStats.experience}/10</span>
          </div>
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${getProgressPercentage()}%` }}
              ></div>
            </div>
            <span className="progress-text">{getProgressPercentage().toFixed(0)}%</span>
          </div>
        </div>

        <h1 className="heading">Your Personal DBT Coach</h1>
        <div ref={chatBoxRef} className="chat-box">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`}>
              <div className="ai-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>
              {Array.isArray(msg.images) && msg.images.length > 0 && (
                <div className="ai-images" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {msg.images.map((url, i) => (
                    <ImageWithFallback key={i} src={url} alt={`ai-${i}`} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <TypingAnimation color="#007BFF" />}
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
          <button onClick={handleSend} className="send-button">Send</button>
        </div>
        {/* Post-training prompt modal (appears immediately after successful training) */}
        {showPostTrainingPrompt && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'white', padding:20, borderRadius:12, minWidth:300, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
              <h3 style={{ marginBottom:8, fontSize:18, fontWeight:600 }}>训练完成 🎉</h3>
              <p style={{ marginBottom:12 }}>恭喜你完成本次训练！现在是否想记录一下此刻的情绪？你可以通过悬浮球快速记录（双击悬浮球打开）。</p>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                <button onClick={() => { setShowPostTrainingPrompt(false); try { sessionStorage.removeItem('needsMoodPrompt'); } catch(e){} }} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>稍后再说</button>
                <button onClick={() => { try { window.dispatchEvent(new Event('openFloatingMoodModal')); } catch(e){} setShowPostTrainingPrompt(false); try { sessionStorage.removeItem('needsMoodPrompt'); } catch(e){} }} style={{ padding:'8px 12px', borderRadius:8, background:'#06b6d4', color:'white', border:'none' }}>现在记录</button>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className="notification-popup">
            <div className="notification-content">
              {notification}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Therapist;
