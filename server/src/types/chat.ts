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
  streamId?: string;
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

// 请求和响应类型
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