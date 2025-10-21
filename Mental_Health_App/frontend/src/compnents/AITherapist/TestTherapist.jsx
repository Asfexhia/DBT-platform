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

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = { sender: 'user', text: input };
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
          message: input,
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
        const found = [];
        aiText = aiText.replace(urlRegex, (m) => {
          found.push(m);
          return ``; // remove raw URL from text; we'll render as images below or via markdown
        }).trim();

        // If there are found images, append markdown image lines to the text so react-markdown will render them
        if (found.length) {
          const mdImages = found.map(u => `![](${u})`).join('\n\n');
          aiText = `${aiText}${aiText ? '\n\n' : ''}${mdImages}`;
          aiImages = [...aiImages, ...found];
        }

        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '$1');
        await new Promise(resolve => setTimeout(resolve, 600));
        setMessages([
          ...updatedMessages,
          { sender: 'ai', text: aiText, images: aiImages }
        ]);
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

  return (
    <React.Fragment>
      <Navbar />
      <div className="therapist-container">
        <h1 className="heading">Test AI Assistant</h1>
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
      </div>
    </React.Fragment>
  );
};

export default TestTherapist;