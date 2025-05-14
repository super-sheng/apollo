import { gql } from '@apollo/client';

// 获取聊天会话
export const GET_CHAT_SESSION = gql`
  query GetChatSession($id: ID!) {
    chatSession(id: $id) {
      id
      messages {
        id
        content
        sender
        timestamp
      }
    }
  }
`;

// 发送用户消息
export const SEND_MESSAGE = gql`
  mutation SendMessage($sessionId: ID!, $content: String!) {
    sendMessage(sessionId: $sessionId, content: $content) {
      id
      content
      sender
      timestamp
    }
  }
`;

// 发送消息并获取AI回复
export const SEND_AI_MESSAGE = gql`
  mutation SendAIMessage($sessionId: ID!, $content: String!) {
    sendAIMessage(sessionId: $sessionId, content: $content) {
      id
      content
      sender
      timestamp
    }
  }
`;

// 订阅新消息
export const MESSAGE_ADDED_SUBSCRIPTION = gql`
  subscription OnMessageAdded($sessionId: ID!) {
    messageAdded(sessionId: $sessionId) {
      id
      content
      sender
      timestamp
    }
  }
`;