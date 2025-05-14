import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { typeDefs } from "@server/graphql/schema";
import { ApolloServer } from "@apollo/server";

export interface Env {
  OPENAI_API_KEY: string;
  CHAT_SESSIONS: DurableObjectNamespace;
}
interface DurableObjectNamespace {
  idFromName (name: string): DurableObjectId;
  get (id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {
  toString (): string;
}

interface DurableObjectStub {
  fetch (request: Request): Promise<Response>;
}

interface DurableObjectState {
  storage: {
    get (key: string): Promise<any>;
    put (key: string, value: any): Promise<void>;
    delete (key: string): Promise<boolean>;
  };
}
export class ChatSessionDO {
  state: DurableObjectState;
  env: Env;
  ctx: ExecutionContext;
  storage: Map<string, any> = new Map();
  sessions: Map<string, any> = new Map();
  webSockets: Map<string, WebSocket> = new Map();
  openai: any;

  constructor(state: DurableObjectState, env: Env, ctx: ExecutionContext) {
    this.state = state;
    this.env = env;
    this.ctx = ctx;
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });
  }

  /**
   * 处理 HTTP 请求
   */
  async fetch (request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket 升级处理
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // GraphQL 请求处理
    if (path === '/graphql') {
      return this.handleGraphQLRequest(request);
    }

    // 未知路径
    return new Response('Not found', { status: 404 });
  }

  /**
   * 处理 WebSocket 升级请求
   */
  async handleWebSocketUpgrade (request: Request) {
    // 创建 WebSocket 对
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    // 接受 WebSocket 连接
    server.accept();

    // 从 URL 获取会话 ID
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId') || 'default';

    // 存储 WebSocket 连接
    const wsId = uuidv4();
    this.webSockets.set(wsId, server);

    // 设置关闭处理程序
    server.addEventListener('close', () => {
      this.webSockets.delete(wsId);
    });

    // 设置消息处理程序
    server.addEventListener('message', async (event) => {
      try {
        // 解析客户端消息
        const message = JSON.parse(event.data);

        // 处理订阅请求
        if (message.type === 'subscribe') {
          // 将此 WebSocket 与特定会话关联
          // @ts-ignore
          server.sessionId = sessionId;
        }
      } catch (error) {
        console.error('WebSocket message handler error:', error);
      }
    });

    // 返回客户端 WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 处理 GraphQL 请求
   */
  async handleGraphQLRequest (request: Request) {
    // 创建 GraphQL 解析器
    const resolvers = this.createResolvers();

    // 创建 GraphQL schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // 创建 Apollo 服务器
    const server = new ApolloServer({
      schema,
    });

    // 创建请求处理器
    const handler = startServerAndCreateCloudflareWorkersHandler(server, {
      context: async () => ({
        env: this.env,
        durableObject: this
      }),
    });

    // 处理请求
    return handler(request, this.env, this.ctx);
  }
  /**
   * 创建 GraphQL 解析器
   */
  createResolvers () {
    return {
      Query: {
        // @ts-ignore
        chatSession: async (_, { id }) => {
          // 从存储中获取会话
          let session = await this.state.storage.get(`session:${id}`);

          // 如果不存在则创建新会话
          if (!session) {
            session = {
              id,
              messages: []
            };
            await this.state.storage.put(`session:${id}`, session);
          }

          return session;
        },

        heartbeat: () => {
          return "ok";
        }
      },

      Mutation: {
        // @ts-ignore
        sendMessage: async (_, { sessionId, content }) => {
          // 创建新消息
          const message = {
            id: uuidv4(),
            content,
            sender: 'USER',
            timestamp: new Date().toISOString()
          };

          // 获取当前会话
          let session = await this.state.storage.get(`session:${sessionId}`);

          // 如果不存在则创建新会话
          if (!session) {
            session = {
              id: sessionId,
              messages: [message]
            };
          } else {
            // 添加消息到现有会话
            session.messages.push(message);
          }

          // 保存会话
          await this.state.storage.put(`session:${sessionId}`, session);

          // 广播消息给所有相关 WebSocket
          this.broadcastMessage(sessionId, {
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
          // 获取当前会话
          let session = await this.state.storage.get(`session:${sessionId}`);
          const messages = session ? session.messages : [];

          // 调用 OpenAI API
          const aiResponse = await this.getAICompletion(content, messages);

          // 创建 AI 消息
          const message = {
            id: uuidv4(),
            content: aiResponse,
            sender: 'AI',
            timestamp: new Date().toISOString()
          };

          // 如果不存在则创建新会话
          if (!session) {
            session = {
              id: sessionId,
              messages: [message]
            };
          } else {
            // 添加消息到现有会话
            session.messages.push(message);
          }

          // 保存会话
          await this.state.storage.put(`session:${sessionId}`, session);

          // 广播消息给所有相关 WebSocket
          this.broadcastMessage(sessionId, {
            type: 'next',
            payload: {
              data: {
                messageAdded: message
              }
            }
          });

          return message;
        }
      }
    };
  }

  /**
   * 向特定会话的所有 WebSocket 连接广播消息
   */
  broadcastMessage (sessionId: string, message: any) {
    for (const ws of this.webSockets.values()) {
      // @ts-ignore
      if (ws.sessionId === sessionId) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * 调用 OpenAI API 获取回复
   */
  async getAICompletion (content: string, messages: any[]) {
    try {
      // 构建消息历史
      const messageHistory = messages.map(msg => ({
        role: msg.sender === 'USER' ? 'user' : 'assistant',
        content: msg.content
      }));

      // 添加当前消息
      messageHistory.push({
        role: 'user',
        content
      });

      // 调用 OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-0613',
        messages: messageHistory,
        max_tokens: 1000,
        temperature: 0.7,
      });

      return response.choices[0].message.content || '抱歉，我无法理解您的问题。';
    } catch (error) {
      console.error('OpenAI API 错误:', error);
      return '发生了一个错误，请稍后再试。';
    }
  }
}