import React from 'react';
import '../styles/ChatMessage.scss';
// @ts-expect-error
const ChatMessage = ({ message }) => {
  const { content, sender, timestamp } = message;
  const isAI = sender === 'AI';

  return (
    <div className={`chat-message ${isAI ? 'ai-message' : 'user-message'}`}>
      <div className="message-avatar">
        {isAI ? (
          <div className="ai-avatar">AI</div>
        ) : (
          <div className="user-avatar">你</div>
        )}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          <div className="message-text">{content}</div>
        </div>
        <div className="message-meta">
          <span className="message-time">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;