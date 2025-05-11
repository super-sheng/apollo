export interface User {
  id: string;
  name: string;
}

export interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant' | 'system';
  conversationId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StreamChunk {
  id: string;
  messageId: string;
  text: string;
  complete: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// API 请求类型
export interface CreateConversationInput {
  title: string;
}

export interface SendMessageInput {
  conversationId: string;
  text: string;
}

export interface AskAssistantInput {
  conversationId: string;
  messageId: string;
  systemPrompt?: string;
}

// API 响应类型
export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface CreateConversationResponse {
  createConversation: Conversation;
}

export interface SendMessageResponse {
  sendMessage: Message;
}

export interface AskAssistantResponse {
  askAssistant: string; // streamId
}

// 订阅类型
export interface MessageCreatedSubscription {
  messageCreated: Message;
}

export interface MessageStreamSubscription {
  messageStream: StreamChunk;
}

// 带有 UI 状态的扩展类型
export interface ConversationWithStatus extends Conversation {
  isActive: boolean;
  unreadCount?: number;
}

export interface MessageWithStatus extends Message {
  isPending?: boolean;
  isStreaming?: boolean;
  error?: string;
}

// 应用状态类型
export interface ChatState {
  conversations: Conversation[];
  selectedConversationId: string | null;
  messages: Message[];
  streamingMessages: Record<string, StreamChunk>;
  isLoading: boolean;
  error: string | null;
}