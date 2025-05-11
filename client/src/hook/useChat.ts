import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_CONVERSATIONS,
  GET_MESSAGES
} from '../graphql/queries';
import {
  CREATE_CONVERSATION,
  SEND_MESSAGE,
  ASK_ASSISTANT
} from '../graphql/mutations';
import {
  MESSAGE_CREATED_SUBSCRIPTION,
  MESSAGE_STREAM_SUBSCRIPTION
} from '../graphql/subscriptions';
import {
  Conversation,
  Message,
  StreamChunk,
  MessageWithStatus
} from '../types/api';

interface UseChatReturn {
  // 数据
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: MessageWithStatus[];
  streamingMessages: Record<string, StreamChunk>;

  // 状态
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  conversationsError: any;
  messagesError: any;
  sendMessageError: any;

  // 操作
  selectConversation: (id: string) => void;
  createNewConversation: (title: string) => Promise<Conversation | null>;
  sendMessage: (text: string) => Promise<void>;
  stopStreamingMessage: () => void;

  // 系统设置
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
}

export function useChat (): UseChatReturn {
  // 状态
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, StreamChunk>>({});
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("你是一个有用的AI助手");

  // Apollo Client
  // const client = useApolloClient();

  // 查询对话列表
  const {
    data: conversationsData,
    loading: isLoadingConversations,
    error: conversationsError
  } = useQuery(GET_CONVERSATIONS);

  // 查询消息列表
  const {
    data: messagesData,
    loading: isLoadingMessages,
    error: messagesError
  } = useQuery(GET_MESSAGES, {
    variables: { conversationId: selectedConversationId },
    skip: !selectedConversationId
  });

  // 创建新对话
  const [createConversation, { error: createConversationError }] = useMutation(CREATE_CONVERSATION);

  // 发送消息
  const [sendMessageMutation, { loading: isSendingMessage, error: sendMessageError }] = useMutation(SEND_MESSAGE);

  // 请求 AI 响应
  const [askAssistantMutation] = useMutation(ASK_ASSISTANT);

  // 订阅新消息
  useSubscription(MESSAGE_CREATED_SUBSCRIPTION, {
    variables: { conversationId: selectedConversationId },
    skip: !selectedConversationId,
    onData: ({ data }) => {
      const newMessage = data.data?.messageCreated;
      if (newMessage) {
        // 确保不重复添加消息
        setMessages(prevMessages => {
          const exists = prevMessages.some(msg => msg.id === newMessage.id);
          if (exists) return prevMessages;
          return [...prevMessages, newMessage];
        });
      }
    }
  });

  // 订阅流式消息
  useSubscription(MESSAGE_STREAM_SUBSCRIPTION, {
    variables: { streamId: currentStreamId },
    skip: !currentStreamId,
    onData: ({ data }) => {
      const chunk = data.data?.messageStream;
      if (chunk) {
        // 更新流式消息
        setStreamingMessages(prev => ({
          ...prev,
          [chunk.messageId]: chunk
        }));

        // 如果流完成，清除当前流 ID
        if (chunk.complete) {
          setCurrentStreamId(null);
        }
      }
    }
  });

  // 当消息数据变化时更新消息状态
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    }
  }, [messagesData]);

  // 选择对话
  const selectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    // 清除之前对话的流式消息状态
    setStreamingMessages({});
    setCurrentStreamId(null);
  }, []);

  // 创建新对话
  const createNewConversation = useCallback(async (title: string): Promise<Conversation | null> => {
    try {
      const { data } = await createConversation({ variables: { title } });
      const newConversation = data.createConversation;
      setSelectedConversationId(newConversation.id);
      return newConversation;
    } catch (error) {
      console.error('创建对话失败:', error);
      return null;
    }
  }, [createConversation]);

  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    if (!selectedConversationId || !text.trim()) return;

    try {
      // 发送用户消息
      const { data: messageData } = await sendMessageMutation({
        variables: {
          conversationId: selectedConversationId,
          text
        }
      });

      const userMessage = messageData.sendMessage;

      // 请求 AI 响应
      const { data: assistantData } = await askAssistantMutation({
        variables: {
          conversationId: selectedConversationId,
          messageId: userMessage.id,
          systemPrompt
        }
      });

      // 设置当前流 ID
      const streamId = assistantData.askAssistant;
      setCurrentStreamId(streamId);

    } catch (error) {
      console.error('发送消息失败:', error);
    }
  }, [selectedConversationId, sendMessageMutation, askAssistantMutation, systemPrompt]);

  // 停止流式消息
  const stopStreamingMessage = useCallback(() => {
    setCurrentStreamId(null);
  }, []);

  // 合并消息和流式消息
  const mergedMessages = useMemo(() => {
    return messages.map(message => {
      // 如果消息有对应的流式消息，更新其文本内容
      const streamChunk = streamingMessages[message.id];
      if (streamChunk) {
        return {
          ...message,
          text: streamChunk.text,
          isStreaming: !streamChunk.complete
        };
      }
      return message;
    });
  }, [messages, streamingMessages]);

  return {
    conversations: conversationsData?.conversations || [],
    selectedConversationId,
    messages: mergedMessages,
    streamingMessages,

    isLoadingConversations,
    isLoadingMessages,
    isSendingMessage,
    conversationsError,
    messagesError,
    sendMessageError,

    selectConversation,
    createNewConversation,
    sendMessage,
    stopStreamingMessage,

    systemPrompt,
    setSystemPrompt
  };
}