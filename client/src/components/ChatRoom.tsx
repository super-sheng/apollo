import React, { useRef, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { GET_CHAT_SESSION, SEND_MESSAGE, SEND_AI_MESSAGE, MESSAGE_ADDED_SUBSCRIPTION } from '../graphql/queries';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Loader from './Loader';

const ChatRoom = ({ sessionId }: { sessionId: string }) => {
  console.log('ChatRoom rendering with sessionId:', sessionId);
  const messagesEndRef = useRef(null);

  // 获取聊天会话
  const { data, loading, error, refetch } = useQuery(GET_CHAT_SESSION, {
    variables: { id: sessionId },
    fetchPolicy: 'network-only', // 强制从网络获取
  });

  console.log('Query state - loading:', loading, 'error:', error, 'data:', data);

  // 订阅新消息
  const { data: subscriptionData, error: subscriptionError } = useSubscription(
    MESSAGE_ADDED_SUBSCRIPTION,
    {
      variables: { sessionId },
      onSubscriptionData: ({ subscriptionData }) => {
        console.log('Subscription received new data:', subscriptionData);
      }
    }
  );

  console.log('Subscription state - data:', subscriptionData, 'error:', subscriptionError);

  // 当收到新消息时刷新数据
  useEffect(() => {
    if (subscriptionData?.messageAdded) {
      console.log('Received new message via subscription, refreshing data');
      refetch();
    }
  }, [subscriptionData, refetch]);

  // 发送消息
  const [sendMessage, { loading: sendLoading, error: sendError }] = useMutation(SEND_MESSAGE);
  const [sendAIMessage, { loading: aiLoading, error: aiError }] = useMutation(SEND_AI_MESSAGE);

  // 滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current) {
      console.log('Scrolling to latest message');
      // @ts-ignore
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  // 处理发送消息
  // @ts-ignore
  const handleSendMessage = async (content) => {
    if (!content.trim()) return;
    console.log('Sending message:', content);

    try {
      // 发送用户消息
      const result = await sendMessage({
        variables: {
          sessionId,
          content,
        },
      });
      console.log('User message sent:', result);

      // 发送AI消息
      const aiResult = await sendAIMessage({
        variables: {
          sessionId,
          content,
        },
      });
      console.log('AI response received:', aiResult);

    } catch (error) {
      console.error('发送消息错误:', error);
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

  if (loading) return <Loader />;

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
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={sendLoading || aiLoading}
      />
    </div>
  );
};

export default ChatRoom;