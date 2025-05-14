import { v4 as uuidv4 } from 'uuid';
import { PubSub } from 'graphql-subscriptions';
import { OpenAIService } from '../services/openai';

const pubsub = new PubSub();
const MESSAGE_ADDED = 'MESSAGE_ADDED';

// 模拟数据库
const chatSessions = new Map();

const openAIService = new OpenAIService();

export const resolvers = {
  Query: {
    // @ts-ignore
    chatSession: (_, { id }) => {
      if (!chatSessions.has(id)) {
        const newSession = {
          id,
          messages: []
        };
        chatSessions.set(id, newSession);
        return newSession;
      }
      return chatSessions.get(id);
    }
  },

  Mutation: {
    // @ts-ignore
    sendMessage: (_, { sessionId, content }) => {
      const message = {
        id: sessionId,
        content,
        sender: 'USER',
        timestamp: new Date().toISOString()
      };

      if (!chatSessions.has(sessionId)) {
        chatSessions.set(sessionId, {
          id: sessionId,
          messages: [message]
        });
      } else {
        chatSessions.get(sessionId).messages.push(message);
      }

      pubsub.publish(MESSAGE_ADDED, { messageAdded: message, sessionId });

      return message;
    },
    // @ts-ignore
    sendAIMessage: async (_, { sessionId, content }) => {
      // 获取会话历史记录
      const session = chatSessions.get(sessionId);
      const messages = session ? session.messages : [];

      // 调用OpenAI API获取响应
      const aiResponse = await openAIService.getCompletion(content, messages);

      const message = {
        id: uuidv4(),
        content: aiResponse,
        sender: 'AI',
        timestamp: new Date().toISOString()
      };

      if (!chatSessions.has(sessionId)) {
        chatSessions.set(sessionId, {
          id: sessionId,
          messages: [message]
        });
      } else {
        chatSessions.get(sessionId).messages.push(message);
      }

      pubsub.publish(MESSAGE_ADDED, { messageAdded: message, sessionId });

      return message;
    }
  },

  Subscription: {
    messageAdded: {
      // @ts-ignore
      subscribe: (_, { sessionId }) => {
        return pubsub.asyncIterableIterator([MESSAGE_ADDED]);
      }
    }
  }
};