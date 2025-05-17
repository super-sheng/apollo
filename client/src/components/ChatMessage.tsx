import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Typewriter from './Typewriter';

interface MessageProps {
  message: {
    id: string;
    content: string;
    sender: string;
    timestamp: string;
  };
  showTypewriterEffect?: boolean;
}

const ChatMessage: React.FC<MessageProps> = ({ message, showTypewriterEffect = false }) => {
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const isAI = message.sender === 'AI';

  // 仅为 AI 消息应用打字机效果，用户消息立即显示
  const shouldUseTypewriter = isAI && showTypewriterEffect;

  return (
    <div className={`message ${isAI ? 'ai-message' : 'user-message'}`}>
      <div className="message-avatar">
        {isAI ? (
          <div className="ai-avatar">AI</div>
        ) : (
          <div className="user-avatar">You</div>
        )}
      </div>

      <div className="message-bubble">
        {shouldUseTypewriter && !isTypingComplete ? (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // @ts-ignore
                code ({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div className="code-block-container">
                      <div className="code-block-header">
                        <span className="code-language">{match[1]}</span>
                        <button className="copy-button" onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}>
                          Copy
                        </button>
                      </div>
                      {/* @ts-ignore */}
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                        className="code-block"
                      >
                        <Typewriter
                          text={String(children).replace(/\n$/, '')}
                          delay={5}
                        />
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {/* @ts-ignore */}
              <Typewriter
                text={message.content}
                delay={12}
                onComplete={() => setIsTypingComplete(true)}
              />
            </ReactMarkdown>
          </div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // @ts-ignore
                code ({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <div className="code-block-container">
                      <div className="code-block-header">
                        <span className="code-language">{match[1]}</span>
                        <button className="copy-button" onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}>
                          Copy
                        </button>
                      </div>
                      <SyntaxHighlighter
                        // @ts-ignore
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                        className="code-block"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;