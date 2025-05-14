import React, { useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CHAT_SESSION, SEND_MESSAGE, SEND_AI_MESSAGE } from '../graphql/queries';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Loader from './Loader';

const ChatRoom = ({ sessionId }: { sessionId: string }) => {
  const messagesEndRef = useRef(null);

  // 获取聊天会话
  const { data, loading } = useQuery(GET_CHAT_SESSION, {
    variables: { id: sessionId },
  });

  // 发送消息
  const [sendMessage] = useMutation(SEND_MESSAGE);
  const [sendAIMessage] = useMutation(SEND_AI_MESSAGE);

  // 滚动到最新消息
  useEffect(() => {
    // @ts-ignore
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  // 处理发送消息
  // @ts-ignore
  const handleSendMessage = async (content) => {
    if (!content.trim()) return;

    try {
      // 发送用户消息
      await sendMessage({
        variables: {
          sessionId,
          content,
        },
      });

      // 发送AI消息
      await sendAIMessage({
        variables: {
          sessionId,
          content,
        },
      });
    } catch (error) {
      console.error('发送消息错误:', error);
    }
  };

  if (loading) return <Loader />;

  const messages = data?.chatSession?.messages || [];

  return (
    <div className="chat-room">
      <div className="messages-container">
        {/* @ts-ignore */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatRoom;