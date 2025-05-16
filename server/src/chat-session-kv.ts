/**
 * chat-session-kv.ts
 * 
 * 使用Workers KV作为存储后端的ChatSession实现
 */

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// GraphQL 类型定义
const typeDefs = `#graphql
  type Message {
    id: ID!
    content: String!
    sender: String!
    timestamp: String!
  }

  type ChatSession {
    id: ID!
    messages: [Message!]!
    contextDescription: String
  }

  type Query {
    chatSession(id: ID!): ChatSession
    heartbeat: String
  }

  type Mutation {
    sendMessage(sessionId: ID!, content: String!): Message
    sendAIMessage(sessionId: ID!, content: String!): Message
    setSessionContext(sessionId: ID!, contextDescription: String!): ChatSession
    clearMessages(sessionId: ID!): Boolean
  }

  type Subscription {
    messageAdded(sessionId: ID!): Message
  }
`;

/**
 * 聊天会话服务类
 * 使用Workers KV作为存储后端
 */
export class ChatSessionService {
  env: Env;
  webSockets: Map<string, WebSocket>;
  openai: any;
  apolloHandler: any;
  sessionId: string;

  constructor(env: Env) {
    this.env = env;
    this.webSockets = new Map();
    this.sessionId = '';

    // 初始化OpenAI客户端(如果有API密钥)
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });
  }

  /**
   * 处理HTTP请求
   */
  async fetch (request: Request) {
    // 从URL获取会话ID
    const url = new URL(request.url);
    console.log('url: ', url);

    try {
      const body = await request.clone().json();
      // @ts-ignore
      if (body?.variables?.id) {
        // @ts-ignore
        this.sessionId = body.variables.id;
        console.log(`chat-session： 从GraphQL变量获取会话ID: ${this.sessionId}`);
      }
      console.log('ensureSessionExists, this.sessionId: ', this.sessionId);
      if (!this.sessionId) return;

      // 会话元数据键
      const sessionKey = `session:${this.sessionId}:meta`;

      // 检查会话是否存在
      const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' });

      if (!sessionData) {
        // 创建新会话
        await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
          id: this.sessionId,
          last_active: Date.now(),
          contextDescription: '通用对话'  // 默认上下文描述
        }));
      } else {
        // 更新最后活动时间
        await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
          ...sessionData,
          last_active: Date.now()
        }));
      }
    } catch (error) {
      // 忽略非JSON请求的解析错误
    }

    // 处理WebSocket连接
    console.log('request: ', JSON.stringify(request));
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketRequest(request);
    }

    // 处理GraphQL请求
    if (url.pathname === '/graphql') {
      return this.handleGraphQLRequest(request);
    }

    // 其他路径返回404
    return new Response('Not found', { status: 404 });
  }

  /**
   * 确保会话记录存在
   */
  async ensureSessionExists () {
    try {
      console.log('ensureSessionExists, this.sessionId: ', this.sessionId);
      if (!this.sessionId) return;

      // 会话元数据键
      const sessionKey = `session:${this.sessionId}:meta`;

      // 检查会话是否存在
      const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' });

      if (!sessionData) {
        // 创建新会话
        await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
          id: this.sessionId,
          last_active: Date.now(),
          contextDescription: '通用对话'  // 默认上下文描述
        }));
      } else {
        // 更新最后活动时间
        await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
          ...sessionData,
          last_active: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error ensuring session exists:', error);
    }
  }

  /**
   * 处理WebSocket连接请求
   */
  async handleWebSocketRequest (request: Request) {
    // 创建WebSocket对
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // 接受WebSocket连接
    server.accept();

    // 生成WebSocket ID
    const webSocketId = uuidv4();

    // 将WebSocket与会话关联
    // @ts-ignore
    server.sessionId = this.sessionId;
    this.webSockets.set(webSocketId, server);

    // 处理消息
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);

        // 处理订阅和其他GraphQL over WebSocket协议消息
        if (message.type === 'connection_init') {
          server.send(JSON.stringify({ type: 'connection_ack' }));
        }
        else if (message.type === 'subscribe' && message.id) {
          console.log(`Client ${webSocketId} subscribed to session ${this.sessionId}`);
        }
        else if (message.type === 'complete' && message.id) {
          console.log(`Client ${webSocketId} unsubscribed`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    // 处理关闭事件
    server.addEventListener('close', () => {
      this.webSockets.delete(webSocketId);
      console.log(`WebSocket ${webSocketId} closed`);
    });

    // 处理错误事件
    server.addEventListener('error', (error) => {
      console.error(`WebSocket ${webSocketId} error:`, error);
      this.webSockets.delete(webSocketId);
    });

    // 返回客户端WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 处理GraphQL请求
   */
  async handleGraphQLRequest (request: Request) {
    // 如果处理器尚未创建，则初始化它
    if (!this.apolloHandler) {
      // 创建Apollo Server
      const server = new ApolloServer({
        schema: makeExecutableSchema({
          typeDefs,
          resolvers: this.createResolvers(),
        }),
      });

      // 创建请求处理器
      this.apolloHandler = startServerAndCreateCloudflareWorkersHandler(server, {
        context: async () => ({ service: this }),
      });
    }

    // 处理请求
    return this.apolloHandler(request);
  }

  /**
   * 创建GraphQL解析器
   */
  createResolvers () {
    return {
      Query: {
        chatSession: async () => {
          try {
            // 获取会话元数据
            const sessionKey = `session:${this.sessionId}:meta`;
            const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' }) || { id: this.sessionId };

            // 获取所有消息
            const messages = await this.getSessionMessages();

            return {
              id: this.sessionId,
              messages: messages,
              // @ts-ignore
              contextDescription: sessionData.contextDescription || '通用对话'
            };
          } catch (error) {
            console.error('Error fetching session:', error);
            return {
              id: this.sessionId,
              messages: [],
              contextDescription: '通用对话'
            };
          }
        },

        heartbeat: () => "ok",
      },

      Mutation: {
        // @ts-ignore
        sendMessage: async (_, { sessionId, content }) => {
          const messageId = uuidv4();
          const message = {
            id: messageId,
            content,
            sender: 'USER',
            timestamp: new Date().toISOString()
          };

          // 保存消息到KV
          await this.saveMessage(message);

          // 广播消息给所有连接的客户端
          this.broadcastMessage({
            type: 'next',
            payload: {
              data: {
                messageAdded: message
              }
            }
          });

          return message;
        },

        // @ts-ignore
        sendAIMessage: async (_, { sessionId, content }) => {
          // 获取会话消息历史
          const messages = await this.getSessionMessages();

          // 获取会话上下文描述
          const sessionKey = `session:${this.sessionId}:meta`;
          const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' }) || { id: this.sessionId };
          // @ts-ignore
          const contextDescription = sessionData.contextDescription || '通用对话';

          // 获取AI回复，传入上下文描述
          const aiResponse = await this.getAICompletion(content, messages, contextDescription);

          const messageId = uuidv4();
          const message = {
            id: messageId,
            content: aiResponse,
            sender: 'AI',
            timestamp: new Date().toISOString()
          };

          // 保存消息到KV
          await this.saveMessage(message);

          // 广播消息给所有连接的客户端
          this.broadcastMessage({
            type: 'next',
            payload: {
              data: {
                messageAdded: message
              }
            }
          });

          return message;
        },

        // @ts-ignore
        setSessionContext: async (_, { sessionId, contextDescription }) => {
          try {
            // 更新会话元数据，添加上下文描述
            const sessionKey = `session:${this.sessionId}:meta`;
            const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' }) || { id: this.sessionId };

            await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
              ...sessionData,
              last_active: Date.now(),
              contextDescription: contextDescription
            }));

            // 添加系统消息，标记上下文变更
            const messageId = uuidv4();
            const message = {
              id: messageId,
              content: `上下文已更新为: ${contextDescription}`,
              sender: 'SYSTEM',
              timestamp: new Date().toISOString()
            };

            await this.saveMessage(message);

            // 广播系统消息
            this.broadcastMessage({
              type: 'next',
              payload: {
                data: {
                  messageAdded: message
                }
              }
            });

            return {
              id: this.sessionId,
              messages: await this.getSessionMessages(),
              contextDescription: contextDescription
            };
          } catch (error) {
            console.error('Error setting session context:', error);
            throw new Error('无法设置会话上下文');
          }
        },

        // @ts-ignore
        clearMessages: async (_, { sessionId }) => {
          try {
            // 获取消息索引
            const indexKey = `session:${this.sessionId}:message_index`;
            const messageIndex = await this.env.CHAT_SESSIONS_KV.get(indexKey, { type: 'json' }) || [];

            // 删除所有消息
            // @ts-ignore
            for (const messageId of messageIndex) {
              await this.env.CHAT_SESSIONS_KV.delete(`session:${this.sessionId}:message:${messageId}`);
            }

            // 重置消息索引
            await this.env.CHAT_SESSIONS_KV.put(indexKey, JSON.stringify([]));

            // 添加系统消息，表明历史已清除
            const messageId = uuidv4();
            const message = {
              id: messageId,
              content: '聊天历史已清除',
              sender: 'SYSTEM',
              timestamp: new Date().toISOString()
            };

            await this.saveMessage(message);

            // 广播系统消息
            this.broadcastMessage({
              type: 'next',
              payload: {
                data: {
                  messageAdded: message
                }
              }
            });

            return true;
          } catch (error) {
            console.error('Error clearing messages:', error);
            return false;
          }
        }
      }
    };
  }

  /**
   * 获取会话的所有消息
   */
  async getSessionMessages () {
    try {
      if (!this.sessionId) return [];

      // 获取消息索引
      const indexKey = `session:${this.sessionId}:message_index`;
      const messageIndex = await this.env.CHAT_SESSIONS_KV.get(indexKey, { type: 'json' }) || [];

      // 如果没有消息索引，返回空数组
      // @ts-ignore
      if (!messageIndex || messageIndex.length === 0) return [];

      // 并行获取所有消息
      // @ts-ignore
      const messagesPromises = messageIndex?.map(async (messageId: string) => {
        const messageKey = `session:${this.sessionId}:message:${messageId}`;
        return await this.env.CHAT_SESSIONS_KV.get(messageKey, { type: 'json' });
      });

      const messages = await Promise.all(messagesPromises);

      // 过滤掉可能的null值并按时间戳排序
      return messages
        // @ts-ignore
        .filter(msg => msg !== null)
        // @ts-ignore
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } catch (error) {
      console.error('Error fetching session messages:', error);
      return [];
    }
  }

  /**
   * 保存消息到KV存储
   */
  async saveMessage (message: any) {
    try {
      if (!this.sessionId) return false;

      // 更新会话活动时间
      const sessionKey = `session:${this.sessionId}:meta`;
      const sessionData = await this.env.CHAT_SESSIONS_KV.get(sessionKey, { type: 'json' }) || { id: this.sessionId };
      await this.env.CHAT_SESSIONS_KV.put(sessionKey, JSON.stringify({
        ...sessionData,
        last_active: Date.now()
      }));

      // 保存消息
      const messageKey = `session:${this.sessionId}:message:${message.id}`;
      await this.env.CHAT_SESSIONS_KV.put(messageKey, JSON.stringify(message));

      // 更新消息索引
      const indexKey = `session:${this.sessionId}:message_index`;
      const messageIndex = await this.env.CHAT_SESSIONS_KV.get(indexKey, { type: 'json' }) || [];
      // @ts-ignore
      messageIndex.push(message.id);
      await this.env.CHAT_SESSIONS_KV.put(indexKey, JSON.stringify(messageIndex));

      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  }

  /**
   * 广播消息给所有连接的WebSocket
   */
  broadcastMessage (message: any) {
    const messageStr = JSON.stringify(message);

    // 遍历所有WebSocket连接
    for (const [id, ws] of this.webSockets.entries()) {
      try {
        // 只发送给与当前会话关联的WebSocket
        // @ts-ignore
        if (ws.sessionId === this.sessionId) {
          ws.send(messageStr);
        }
      } catch (error) {
        console.error(`Error sending message to WebSocket ${id}:`, error);
        // 移除失败的WebSocket
        this.webSockets.delete(id);
      }
    }
  }

  /**
   * 获取AI回复，支持上下文维护
   */
  async getAICompletion (content: string, messages: any[], contextDescription: string = '通用对话') {
    // 如果未配置OpenAI，返回默认回复
    if (!this.openai) {
      return "AI服务未配置。请联系管理员设置OpenAI API密钥。";
    }

    try {
      // 构建消息历史，确保保留完整上下文
      const messageHistory = [];

      // 添加系统消息来设置上下文
      messageHistory.push({
        role: 'system',
        content: `你是一个有帮助的AI助手，当前正在进行"${contextDescription}"主题的对话。请根据此上下文和历史对话内容提供连贯且相关的回答。`
      });

      // 获取历史消息，但限制数量以控制token使用
      // 这里我们最多保留最近的20条消息作为上下文
      const recentMessages = messages.slice(-20);
      recentMessages.forEach(msg => {
        if (msg.sender === 'SYSTEM') {
          // 系统消息作为上下文提示
          messageHistory.push({
            role: 'system',
            content: msg.content
          });
        } else {
          messageHistory.push({
            role: msg.sender === 'USER' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      });

      // 添加当前消息
      messageHistory.push({
        role: 'user',
        content
      });

      // 调用OpenAI API，增加max_tokens以处理更长对话
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-0613', // 可以根据需要更换模型
        messages: messageHistory,
        max_tokens: 2000, // 增加token上限以支持更复杂的回复
        temperature: 0.7,
        presence_penalty: 0.6, // 添加presence_penalty参数以减少重复
        frequency_penalty: 0.5, // 添加frequency_penalty参数以鼓励多样性
      });

      return response.choices[0].message.content || '抱歉，我无法理解您的问题。';
    } catch (error) {
      console.error('OpenAI API错误:', error);
      return '发生了一个错误，请稍后再试。';
    }
  }

  /**
   * 清理过期的会话数据
   */
  async cleanupOldSessions () {
    try {
      // 获取所有会话元数据
      // 注意：这里需要使用KV的list操作，但它有限制
      // 完整实现需要考虑分页和大量会话的情况
      const sessions = await this.env.CHAT_SESSIONS_KV.list({ prefix: 'session:' });
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      for (const key of sessions.keys) {
        // 只处理会话元数据
        if (key.name.endsWith(':meta')) {
          const sessionData = await this.env.CHAT_SESSIONS_KV.get(key.name, { type: 'json' });
          // @ts-ignore
          if (sessionData && sessionData.last_active < thirtyDaysAgo) {
            const sessionId = key.name.split(':')[1];

            // 删除会话元数据
            await this.env.CHAT_SESSIONS_KV.delete(key.name);

            // 获取消息索引
            const indexKey = `session:${sessionId}:message_index`;
            const messageIndex = await this.env.CHAT_SESSIONS_KV.get(indexKey, { type: 'json' }) || [];

            // 删除所有消息
            // @ts-ignore
            for (const messageId of messageIndex) {
              await this.env.CHAT_SESSIONS_KV.delete(`session:${sessionId}:message:${messageId}`);
            }

            // 删除消息索引
            await this.env.CHAT_SESSIONS_KV.delete(indexKey);

            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      return 0;
    }
  }
}

/**
 * Worker处理入口函数
 */
export default {
  async fetch (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const service = new ChatSessionService(env);
    return service.fetch(request);
  },

  // 可选：定期清理过期会话
  async scheduled (event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const service = new ChatSessionService(env);
    const cleanedCount = await service.cleanupOldSessions();
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
};

// 环境类型定义
export interface Env {
  OPENAI_API_KEY: string;
  CHAT_SESSIONS_KV: KVNamespace;
}