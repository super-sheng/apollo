import { gql } from '@apollo/client';

export const GET_CONVERSATIONS = gql`
  query GetConversations {
    conversations {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const GET_CONVERSATION = gql`
  query GetConversation($id: ID!) {
    conversation(id: $id) {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!) {
    messages(conversationId: $conversationId) {
      id
      text
      role
      conversationId
      createdAt
      updatedAt
    }
  }
`;
