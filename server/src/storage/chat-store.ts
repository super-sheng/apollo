// src/storage/chat-store.ts
import { createWebSocketResponse } from '@server/utils/create-websocket-response';
import { CHAT_CHANNEL, ChatChannel, PubSubEvent, STREAM_CHANNEL, StreamChannel } from '../services/pubsub';
import { Conversation, Message, Env } from '../types';
import { handleError } from '../utils/error-handler';
import { logger } from '../utils/logger';
// 导入最新的 Cloudflare Workers 类型
import { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';
export interface ServerWebSocket extends WebSocket {
  accept (): void;
}
export interface CloudflareResponseInit extends ResponseInit {
  webSocket?: WebSocket;
}

export class ChatStore {
  private state: DurableObjectState;
  private env: Env;
  private storage: DurableObjectStorage;
  private sessions: Map<string, { webSocket: WebSocket }>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    // 存储活跃WebSocket连接
    this.sessions = new Map();

    // 检查是否需要初始化
    this.initialize().catch(error => {
      logger.error(`初始化ChatStore失败: ${handleError(error)}`);
    });
  }

  async initialize (): Promise<void> {
    // 检查是否已初始化
    const initialized = await this.storage.get('initialized');
    if (!initialized) {
      logger.info('初始化ChatStore...');
      // 设置初始数据
      await this.storage.put('conversations', []);
      await this.storage.put('initialized', true);
      logger.info('ChatStore初始化完成');
    }
  }

  // 发布消息事件到主 Worker 的 PubSub
  private async publishMessageEvent (conversationId: string, message: Message): Promise<void> {
    try {
      const channel = `${CHAT_CHANNEL}-${conversationId}` as ChatChannel;
      const event: PubSubEvent = {
        channel,
        payload: message
      };

      // 发送到主 Worker 的 pubsub-event 端点
      await fetch(new URL('/pubsub-event', self.location.href).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      logger.error(`发布消息事件失败: ${handleError(error)}`);
    }
  }

  async fetch (request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 记录请求日志
      logger.debug(`ChatStore收到请求: ${request.method} ${path}`);

      // 会话WebSocket连接端点
      if (path === '/connect') {
        return this.handleConnect(request);
      }

      // 对话端点
      if (path === '/conversations') {
        if (request.method === 'GET') {
          return this.handleGetConversations();
        } else if (request.method === 'POST') {
          return this.handleCreateConversation(request);
        }
      }

      // 特定对话端点
      const conversationMatch = path.match(/^\/conversations\/([^\/]+)$/);
      if (conversationMatch && request.method === 'GET') {
        return this.handleGetConversation(conversationMatch[1] as string);
      }

      // 对话消息端点
      const messagesMatch = path.match(/^\/conversations\/([^\/]+)\/messages$/);
      if (messagesMatch) {
        const conversationId = messagesMatch[1];
        if (request.method === 'GET') {
          return this.handleGetMessages(conversationId as string);
        } else if (request.method === 'POST') {
          return this.handleCreateMessage(request, conversationId as string);
        }
      }

      // 更新消息端点
      const messageMatch = path.match(/^\/messages\/([^\/]+)$/);
      if (messageMatch) {
        const messageId = messageMatch[1];
        if (request.method === 'PUT') {
          return this.handleUpdateMessage(request, messageId as string);
        } else if (request.method === 'GET') {
          return this.handleGetMessage(messageId as string);
        }
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      logger.error(`ChatStore处理请求错误: ${handleError(error)}`);
      return new Response(`内部服务器错误: ${handleError(error)}`, { status: 500 });
    }
  }

  // 处理WebSocket连接
  async handleConnect (request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    // 使用类型断言来确保 WebSocketPair 具有正确的类型
    const pair = new WebSocketPair() as unknown as [ServerWebSocket, ServerWebSocket];
    const [client, server] = pair;

    server.accept();

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, { webSocket: server });

    // 设置消息处理程序
    server.addEventListener('message', async event => {
      try {
        console.log('收到WebSocket消息:', event.data);
      } catch (error) {
        console.error('处理WebSocket消息时出错:', error);
      }
    });

    // 设置关闭处理程序
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });

    // 设置错误处理程序
    server.addEventListener('error', () => {
      this.sessions.delete(sessionId);
    });

    return createWebSocketResponse(client);
  }

  // 处理创建对话
  async handleCreateConversation (request: Request): Promise<Response> {
    const data: { title: string } = await request.json();
    const id = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const now = new Date().toISOString();

    const conversation: Conversation = {
      id,
      title: data.title || "新对话",
      createdAt: now,
      updatedAt: now
    };

    // 获取现有对话或创建新数组
    let conversations: Conversation[] = await this.storage.get('conversations') || [];
    conversations.push(conversation);

    // 存储对话
    await this.storage.put('conversations', conversations);

    // 为该对话创建空消息数组
    await this.storage.put(`messages-${id}`, []);

    logger.info(`创建了新对话: ${id}, 标题: ${conversation.title}`);

    return new Response(JSON.stringify(conversation), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理获取所有对话
  async handleGetConversations (): Promise<Response> {
    const conversations: Conversation[] = await this.storage.get('conversations') || [];

    return new Response(JSON.stringify(conversations), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理获取单个对话
  async handleGetConversation (id: string): Promise<Response> {
    const conversations: Conversation[] = await this.storage.get('conversations') || [];
    const conversation = conversations.find(c => c.id === id);

    if (!conversation) {
      return new Response(JSON.stringify({ error: '对话不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(conversation), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理获取对话消息
  async handleGetMessages (conversationId: string): Promise<Response> {
    const messages: Message[] = await this.storage.get(`messages-${conversationId}`) || [];

    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理创建消息
  async handleCreateMessage (request: Request, conversationId: string): Promise<Response> {
    const data: { text: string; role: 'user' | 'assistant' | 'system'; streamId?: string } = await request.json();
    const now = new Date().toISOString();

    // 检查对话是否存在
    const conversations: Conversation[] = await this.storage.get('conversations') || [];
    const conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) {
      return new Response(JSON.stringify({ error: '对话不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 创建新消息
    // @ts-ignore
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      text: data.text || "",
      role: data.role || "user",
      conversationId,
      createdAt: now,
      streamId: data.streamId // 可能是undefined，仅用于助手消息
    };

    // 获取现有消息或创建新数组
    let messages: Message[] = await this.storage.get(`messages-${conversationId}`) || [];
    messages.push(message);

    // 存储消息
    await this.storage.put(`messages-${conversationId}`, messages);

    // 更新对话的updatedAt时间
    const updatedConversations = conversations.map(c => {
      if (c.id === conversationId) {
        return { ...c, updatedAt: now };
      }
      return c;
    });
    await this.storage.put('conversations', updatedConversations);

    // 通过PubSub发布消息
    await this.publishMessageEvent(conversationId, message);

    // 广播给WebSocket连接
    this.broadcast(JSON.stringify({
      type: 'messageCreated',
      conversationId,
      message
    }));

    return new Response(JSON.stringify(message), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理获取单条消息
  async handleGetMessage (messageId: string): Promise<Response> {
    // 搜索所有对话以找到消息
    const conversations: Conversation[] = await this.storage.get('conversations') || [];

    for (const conversation of conversations) {
      const messages: Message[] = await this.storage.get(`messages-${conversation.id}`) || [];
      const message = messages.find(m => m.id === messageId);

      if (message) {
        return new Response(JSON.stringify(message), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: '消息不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 处理更新消息
  async handleUpdateMessage (request: Request, messageId: string): Promise<Response> {
    const data: Partial<Message> = await request.json();

    // 搜索所有对话以找到并更新消息
    const conversations: Conversation[] = await this.storage.get('conversations') || [];

    for (const conversation of conversations) {
      const messages: Message[] = await this.storage.get(`messages-${conversation.id}`) || [];
      const messageIndex = messages.findIndex(m => m.id === messageId);

      if (messageIndex !== -1) {
        // 更新消息
        // @ts-ignore
        messages[messageIndex] = {
          ...messages[messageIndex],
          ...data,
          updatedAt: new Date().toISOString()
        };

        // 存储更新后的消息
        await this.storage.put(`messages-${conversation.id}`, messages);

        // 发布更新事件
        // @ts-ignore
        await this.publishMessageEvent(conversation.id, messages[messageIndex]);

        // 广播给WebSocket连接
        this.broadcast(JSON.stringify({
          type: 'messageUpdated',
          conversationId: conversation.id,
          message: messages[messageIndex]
        }));

        return new Response(JSON.stringify(messages[messageIndex]), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: '消息不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 广播消息给所有WebSocket连接
  private broadcast (message: string): void {
    for (const session of this.sessions.values()) {
      try {
        session.webSocket.send(message);
      } catch (error) {
        // 忽略发送错误
      }
    }
  }
}