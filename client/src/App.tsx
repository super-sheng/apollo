import React, { useState, useEffect, useRef } from 'react';
import { ApolloProvider } from '@apollo/client';
import { client } from './graphql/client';
import ChatRoom from './components/ChatRoom';
import './styles/globals.scss';
import { v4 as uuidv4 } from 'uuid';
import GradientButton from './components/GradientButton';

const App = () => {
  const [sessionId, setSessionId] = useState(() => {
    const savedSessionId = localStorage.getItem('chat_session_id');
    return savedSessionId || uuidv4();
  });

  // 保存会话ID到本地存储
  useEffect(() => {
    localStorage.setItem('chat_session_id', sessionId);
  }, [sessionId]);

  // 创建新会话
  const createNewSession = () => {
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    localStorage.setItem('chat_session_id', newSessionId);
  };
  return (
    <ApolloProvider client={client}>
      <div className="app">
        <div className="grid-background"></div>
        <header className="header">
          <div className="logo">
            <span className="logo-text">AI聊天室</span>
          </div>

          <GradientButton
            onClick={createNewSession}
            variant="secondary"
            size="sm"
          >
            新对话
          </GradientButton>
        </header>
        <main>
          <ChatRoom sessionId={sessionId} />
        </main>
      </div>
    </ApolloProvider>
  );
};

export default App;