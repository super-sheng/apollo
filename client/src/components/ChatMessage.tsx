import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import '../styles/ChatMessage.scss';
// @ts-ignore
const ChatMessage = ({ message }) => {
  const { content, sender, timestamp } = message;
  const isAI = sender === 'AI';

  // 将时间戳格式化为"几分钟前"的形式
  const formattedTime = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: zhCN
  });

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
          <span className="message-time">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;