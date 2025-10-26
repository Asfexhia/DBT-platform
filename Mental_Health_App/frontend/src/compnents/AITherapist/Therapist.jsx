import React, { useState, useEffect, useRef } from 'react';
import Loader from 'react-js-loader';
import Navbar from '../navbar/Navbar';
import './Therapist.css';

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
  const chatBoxRef = useRef(null);

  useEffect(() => {
    fetchUserStats();
  }, []);

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

      const data = await response.json();
      
      if (data.success) {
        let aiMessage = data.response;
        
        // Replace **word** with <strong>word</strong>
        aiMessage = aiMessage.replace(/\*\*(.*?)\*\*/g, '$1');

        // Simulate typing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        setMessages([...updatedMessages, { sender: 'ai', text: aiMessage }]);

        // Check for training success and new achievements
        if (data.trainingSuccess) {
          setUserStats(prev => ({
            ...prev,
            experience: prev.experience + 1
          }));
          showNotification('训练成功！获得1点经验值');
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
              {msg.text}
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
