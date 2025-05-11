export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    name: String!
  }

  type Message {
    id: ID!
    text: String!
    role: String! # "user", "assistant", or "system"
    conversationId: ID!
    createdAt: String!
    updatedAt: String
  }

  type StreamChunk {
    id: ID!
    messageId: ID!
    text: String!
    complete: Boolean!
    createdAt: String!
  }

  type Conversation {
    id: ID!
    title: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    # 获取特定对话的所有消息
    messages(conversationId: ID!): [Message!]!
    
    # 获取单个消息
    message(id: ID!): Message
    
    # 获取所有对话
    conversations: [Conversation!]!
    
    # 获取单个对话
    conversation(id: ID!): Conversation
  }

  type Mutation {
    # 创建新对话
    createConversation(title: String!): Conversation!
    
    # 发送用户消息
    sendMessage(
      conversationId: ID!
      text: String!
    ): Message!
    
    # 请求AI响应（流式传输）
    askAssistant(
      conversationId: ID!
      messageId: ID!
      systemPrompt: String
    ): String! # 返回流ID
  }

  type Subscription {
    # 订阅对话中的新消息
    messageCreated(conversationId: ID!): Message!
    
    # 订阅流式AI响应
    messageStream(streamId: String!): StreamChunk!
  }
`;