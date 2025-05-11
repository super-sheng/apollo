import { Message, Conversation } from './chat';

export interface ChatStoreData {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  sessions: Map<string, { webSocket: WebSocket }>;
}