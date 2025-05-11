import { gql } from '@apollo/client';

export const MESSAGE_CREATED_SUBSCRIPTION = gql`
  subscription OnMessageCreated($conversationId: ID!) {
    messageCreated(conversationId: $conversationId) {
      id
      text
      role
      conversationId
      createdAt
    }
  }
`;

export const MESSAGE_STREAM_SUBSCRIPTION = gql`
  subscription OnMessageStream($streamId: String!) {
    messageStream(streamId: $streamId) {
      id
      messageId
      text
      complete
      createdAt
    }
  }
`;