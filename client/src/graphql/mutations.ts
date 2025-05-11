import { gql } from '@apollo/client';

export const CREATE_CONVERSATION = gql`
  mutation CreateConversation($title: String!) {
    createConversation(title: $title) {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($conversationId: ID!, $text: String!) {
    sendMessage(conversationId: $conversationId, text: $text) {
      id
      text
      role
      conversationId
      createdAt
    }
  }
`;

export const ASK_ASSISTANT = gql`
  mutation AskAssistant($conversationId: ID!, $messageId: ID!, $systemPrompt: String) {
    askAssistant(
      conversationId: $conversationId
      messageId: $messageId
      systemPrompt: $systemPrompt
    )
  }
`;