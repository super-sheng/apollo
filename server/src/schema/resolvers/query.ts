import { GraphQLContext } from '../../types';

export const Query = {
  // 获取特定对话的所有消息
  messages: async (_: unknown, { conversationId }: { conversationId: string }, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request(`https://dummy-url/conversations/${conversationId}/messages`, {
        method: 'GET'
      })
    );
    return response.json();
  },

  // 获取单个消息
  message: async (_: unknown, { id }: { id: string }, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request(`https://dummy-url/messages/${id}`, {
        method: 'GET'
      })
    );
    return response.json();
  },

  // 获取所有对话
  conversations: async (_: unknown, __: unknown, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request('https://dummy-url/conversations', {
        method: 'GET'
      })
    );
    return response.json();
  },

  // 获取单个对话
  conversation: async (_: unknown, { id }: { id: string }, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request(`https://dummy-url/conversations/${id}`, {
        method: 'GET'
      })
    );
    return response.json();
  }
};