import React, { useState, useRef, useEffect } from 'react';
import '../styles/ChatInput.scss';
import SendButton from './SendButton';
// @ts-ignore
const ChatInput = ({ onSendMessage, isLoading }) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // 自动聚焦输入框
    // @ts-ignore
    inputRef.current?.focus();
  }, []);
  // @ts-ignore
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入你的消息..."
          className="chat-input"
        />
        <SendButton
          onSend={(e) => handleSubmit(e)}
          disabled={!message.trim()}
          isLoading={isLoading}
        />
      </form>
    </div>
  );
};

export default ChatInput;