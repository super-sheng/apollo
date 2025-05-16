import React, { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_CHAT_SESSION, SEND_MESSAGE, SEND_AI_MESSAGE } from '../graphql/queries';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Loader from './Loader';

const ChatRoom = ({ sessionId }: { sessionId: string }) => {
  console.log('ChatRoom rendering with sessionId:', sessionId);
  const messagesEndRef = useRef(null);
  const [isAiResponding, setIsAiResponding] = useState(false);

  // 获取聊天会话
  const { data, loading, error, refetch } = useQuery(GET_CHAT_SESSION, {
    variables: { sessionId },
    fetchPolicy: 'network-only', // 确保每次都从网络获取最新数据
  });

  console.log('Query state - loading:', loading, 'error:', error, 'data:', data);

  // 发送消息
  const [sendMessage, { loading: sendLoading, error: sendError }] = useMutation(SEND_MESSAGE);
  const [sendAIMessage, { loading: aiLoading, error: aiError }] = useMutation(SEND_AI_MESSAGE);

  // 定期刷新聊天数据（可选，作为订阅的替代）
  useEffect(() => {
    // 初始加载
    refetch();

    // 如果你希望保持一定程度的"实时性"，可以启用这个定期刷新
    // const intervalId = setInterval(() => {
    //   if (!isAiResponding) { // 只在AI不在响应时进行刷新，避免冲突
    //     refetch();
    //   }
    // }, 5000); // 每5秒刷新一次

    // return () => clearInterval(intervalId);
  }, [refetch, isAiResponding]);

  // 滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current) {
      console.log('Scrolling to latest message');
      // @ts-ignore
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  // 处理发送消息
  const handleSendMessage = async (content: any) => {
    if (!content.trim()) return;
    console.log('Sending message:', content);

    try {
      setIsAiResponding(true);

      // 1. 发送用户消息
      const userResult = await sendMessage({
        variables: {
          sessionId,
          content,
        },
      });
      console.log('User message sent:', userResult);

      // 立即刷新以显示用户消息
      await refetch();

      // 2. 发送AI消息请求
      const aiResult = await sendAIMessage({
        variables: {
          sessionId,
          content,
        },
      });
      console.log('AI response received:', aiResult);

      // 再次刷新以显示AI回复
      await refetch();

    } catch (error) {
      console.error('发送消息错误:', error);
      alert('发送消息失败，请重试');
    } finally {
      setIsAiResponding(false);
    }
  };

  // 显示错误
  if (error) {
    console.error('GraphQL query error:', error);
    return <div className="error-message">Error loading chat: {error.message}</div>;
  }

  // 显示发送错误
  if (sendError || aiError) {
    console.error('Send error:', sendError || aiError);
  }

  // 使用加载指示器显示初始加载状态
  if (loading && !data) return <Loader />;

  const messages = data?.chatSession?.messages || [];
  console.log('Rendering messages:', messages.length);

  return (
    <div className="chat-room">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start a conversation!</div>
        ) : (
          // @ts-ignore
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}

        {/* 添加"AI正在响应"的指示器 */}
        {isAiResponding && <Loader />}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={sendLoading || aiLoading || isAiResponding}
      />
    </div>
  );
};

export default ChatRoom;