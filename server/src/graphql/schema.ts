import gql from 'graphql-tag';

export const typeDefs = gql`
  type Message {
    id: ID!
    content: String!
    sender: String!
    timestamp: String!
  }

  type ChatSession {
    id: ID!
    messages: [Message!]!
  }

  type Query {
    chatSession(id: ID!): ChatSession
  }

  type Mutation {
    sendMessage(sessionId: ID!, content: String!): Message
    sendAIMessage(sessionId: ID!, content: String!): Message
  }

  type Subscription {
    messageAdded(sessionId: ID!): Message
  }
`;