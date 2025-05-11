import { GraphQLContext, CreateConversationInput, SendMessageInput, AskAssistantInput } from '../../types';
import { generateOpenAIStream } from '../../services/ai-service';

export const Mutation = {
  // 创建新对话
  createConversation: async (_: unknown, { title }: CreateConversationInput, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request('https://dummy-url/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title })
      })
    );
    return response.json();
  },

  // 发送用户消息
  sendMessage: async (_: unknown, { conversationId, text }: SendMessageInput, { getChatStore, env }: GraphQLContext) => {
    const chatStore = getChatStore(env);
    const response = await chatStore.fetch(
      new Request(`https://dummy-url/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          role: 'user'
        })
      })
    );
    return response.json();
  },

  // 请求AI响应（流式）
  askAssistant: async (_: unknown, { conversationId, messageId, systemPrompt }: AskAssistantInput, { getChatStore, env, pubSub }: GraphQLContext) => {
    // 生成一个唯一的流ID
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // 获取对话历史
    const chatStore = getChatStore(env);
    const historyResponse = await chatStore.fetch(
      new Request(`https://dummy-url/conversations/${conversationId}/messages`, {
        method: 'GET'
      })
    );
    const messages = await historyResponse.json();

    // 创建空的助手消息占位符
    const assistantMessageResponse = await chatStore.fetch(
      new Request(`https://dummy-url/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: "",
          role: 'assistant',
          streamId
        })
      })
    );
    const assistantMessage = await assistantMessageResponse.json();

    // 启动后台流程
    generateOpenAIStream(
      env,
      pubSub,
      // @ts-ignore
      messages,
      // @ts-ignore
      assistantMessage?.id,
      systemPrompt || "你是一个有用的AI助手",
      streamId,
      getChatStore
    );

    // 返回流ID供前端订阅
    return streamId;
  }
};