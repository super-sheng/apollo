/**
 * chat-session-sqlite.ts
 * 
 * 使用SQLite作为存储后端的ChatSessionDO实现
 */

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateCloudflareWorkersHandler } from '@as-integrations/cloudflare-workers';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { DurableObject } from "cloudflare:workers";

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
  }

  type Query {
    chatSession(id: ID!): ChatSession
    heartbeat: String
  }

  type Mutation {
    sendMessage(sessionId: ID!, content: String!): Message
    sendAIMessage(sessionId: ID!, content: String!): Message
  }

  type Subscription {
    messageAdded(sessionId: ID!): Message
  }
`;

/**
 * 聊天会话Durable Object类
 * 使用SQLite作为存储后端
 */
export class ChatSessionDO extends DurableObject<Env> {
  state: DurableObjectState;
  override env: Env;
  webSockets: Map<string, WebSocket>;
  openai: any;
  apolloHandler: any;
  sessionId: string;
  db: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.webSockets = new Map();
    this.sessionId = '';

    // 获取SQLite数据库实例
    this.db = state.storage.sql;

    // 初始化OpenAI客户端(如果有API密钥)
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY
    });

    // 初始化数据库表
    this.initDatabase();
  }

  /**
   * 初始化SQLite数据库表
   */
  async initDatabase () {
    try {
      // 创建会话表
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          last_active INTEGER
        );
      `);

      // 创建消息表
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          content TEXT,
          sender TEXT,
          timestamp TEXT,
          FOREIGN KEY(session_id) REFERENCES sessions(id)
        );
      `);
      console.log("数据库表初始化完成");
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  /**
   * 处理HTTP请求
   */
  override async fetch (request: Request) {
    // 从URL获取会话ID
    const url = new URL(request.url);
    console.log('url: ', url);

    const body = await request.clone().json();
    // @ts-ignore
    if (body?.variables?.id) {
      // @ts-ignore
      this.sessionId = body.variables.id;
      console.log(`chat-session： 从GraphQL变量获取会话ID: ${this.sessionId}`);
    }

    // 确保会话存在
    await this.ensureSessionExists();

    // 处理WebSocket连接
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
      console.log('ensureSessionExists , this.sessionId: ', this.sessionId);
      // 查询会话是否存在
      const session = await this.db.exec(`SELECT id FROM sessions WHERE id = ?`, this.sessionId);
      console.log('session: ', JSON.stringify(session));

      if (!session) {
        // 创建新会话
        await this.db.exec(`INSERT INTO sessions (id, last_active) VALUES (?, ?)`, this.sessionId);
      } else {
        // 更新最后活动时间
        await this.db.exec(`UPDATE sessions SET last_active = ? WHERE id = ?`, Date.now(), this.sessionId);
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
    this.state.acceptWebSocket(server);

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
        context: async () => ({ durableObject: this }),
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
          // 获取会话信息
          const session = {
            id: this.sessionId,
            messages: await this.getSessionMessages()
          };

          return session;
        },

        heartbeat: () => "ok",
      },

      Mutation: {
        // @ts-ignore
        sendMessage: async (_, { sessionId, content }) => {
          const message = {
            id: uuidv4(),
            content,
            sender: 'USER',
            timestamp: new Date().toISOString()
          };

          // 保存消息到数据库
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

          // 获取AI回复
          const aiResponse = await this.getAICompletion(content, messages);

          const message = {
            id: uuidv4(),
            content: aiResponse,
            sender: 'AI',
            timestamp: new Date().toISOString()
          };

          // 保存消息到数据库
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
        }
      }
    };
  }

  /**
   * 获取会话的所有消息
   */
  async getSessionMessages () {
    try {
      // 查询此会话的所有消息
      const result = await this.db.exec(`SELECT id, content, sender, timestamp 
        FROM messages 
        WHERE session_id = ? 
        ORDER BY timestamp ASC`, this.sessionId);
      console.log('result: ', result);
      return result.toArray() || [];
    } catch (error) {
      console.error('Error fetching session messages:', error);
      return [];
    }
  }

  /**
   * 保存消息到数据库
   */
  // @ts-ignore
  async saveMessage (message) {
    try {
      // 插入消息记录 更新会话最后活动时间
      await this.db.exec(`INSERT INTO messages (id, session_id, content, sender, timestamp) 
         VALUES (?, ?, ?, ?, ?)`, message.id, this.sessionId, message.content, message.sender, message.timestam);

      await this.db.exec(`UPDATE sessions SET last_active = ? WHERE id = ?`, Date.now(), this.sessionId)

      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  }

  /**
   * 广播消息给所有连接的WebSocket
   */
  // @ts-ignore
  broadcastMessage (message) {
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
   * 获取AI回复
   */
  // @ts-ignore
  async getAICompletion (content, messages) {
    // 如果未配置OpenAI，返回默认回复
    if (!this.openai) {
      return "AI服务未配置。请联系管理员设置OpenAI API密钥。";
    }

    try {
      // 构建消息历史
      // @ts-ignore
      const messageHistory = messages.map(msg => ({
        role: msg.sender === 'USER' ? 'user' : 'assistant',
        content: msg.content
      }));

      // 添加当前消息
      messageHistory.push({
        role: 'user',
        content
      });

      // 调用OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-0613',
        messages: messageHistory,
        max_tokens: 1000,
        temperature: 0.7,
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
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

      // 查询过期会话
      const result = await this.db.exec(`SELECT id FROM sessions WHERE last_active < ?`, thirtyDaysAgo);

      const expiredSessions = result.toArray() || [];
      let cleanedCount = 0;

      // 删除每个过期会话及其消息
      for (const session of expiredSessions) {
        await this.db.exec(`DELETE FROM messages WHERE session_id = ?`, session['id']);

        await this.db.exec(`DELETE FROM sessions WHERE id = ?`, session['id']);

        cleanedCount++;
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      return 0;
    }
  }
}

// 环境类型定义
export interface Env {
  OPENAI_API_KEY: string;
  CHAT_SESSIONS: DurableObjectNamespace;
}