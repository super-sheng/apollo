// src/index.ts
import { createYoga, useLogger } from 'graphql-yoga';
import { schema } from './schema';
import { ChatStore } from './storage/chat-store';
import { getPubSub, PubSubEvent, CHAT_CHANNEL, STREAM_CHANNEL, ChatChannel, StreamChannel } from './services/pubsub';
import { Env } from './types';
import type { ExecutionContext } from '@cloudflare/workers-types';

// 获取ChatStore Durable Object的助手函数
const getChatStore = (env: Env): DurableObjectStub => {
  const id = env.CHAT_STORE.idFromName('default');
  return env.CHAT_STORE.get(id);
};

// 创建Yoga实例
const createGraphQLServer = (env: Env) => {
  const pubSub = getPubSub();

  return createYoga<Env>({
    // @ts-ignore
    schema,
    plugins: [
      useLogger(),
      {
        // 自定义插件，注入上下文
        // @ts-ignore
        onContextBuilding ({ setContextValue }) {
          setContextValue('pubSub', pubSub);
          setContextValue('getChatStore', getChatStore);
          setContextValue('env', env);
        }
      }
    ],
    graphiql: {
      subscriptionsProtocol: 'SSE', // 使用Server-Sent Events
      defaultQuery: /* GraphQL */ `
        # 欢迎使用GraphQL聊天API
        # 试试这些操作：
        
        # 获取对话列表
        query {
          conversations {
            id
            title
            createdAt
          }
        }
      `,
    },
    // 使用最新版本中可能提供的额外选项
    maskedErrors: {
      isDev: env.ENVIRONMENT === 'development'
    },
    // 集成 Cloudflare Workers
    fetchAPI: {
      Request,
      Response,
      Headers,
      fetch
    }
  });
};

// Worker 处理函数 - 使用最新的类型定义
export default {
  async fetch (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 PubSub 事件
    if (path === '/pubsub-event' && request.method === 'POST') {
      try {
        const event: PubSubEvent = await request.json();
        const pubSub = getPubSub();

        // 验证频道前缀以防止滥用
        if (event.channel.startsWith(`${CHAT_CHANNEL}-`)) {
          const chatChannel = event.channel as ChatChannel;
          pubSub.publish(chatChannel, event.payload);
          return new Response('Event published', { status: 200 });
        } else if (event.channel.startsWith(`${STREAM_CHANNEL}-`)) {
          const streamChannel = event.channel as StreamChannel;
          pubSub.publish(streamChannel, event.payload);
          return new Response('Event published', { status: 200 });
        }

        return new Response('Invalid channel', { status: 400 });
      } catch (error) {
        return new Response('Invalid event data', { status: 400 });
      }
    }

    // 请求是给ChatStore的？
    if (path.startsWith('/store/')) {
      const chatStore = getChatStore(env);
      // 重写URL以便在ChatStore中处理
      const newUrl = new URL(request.url);
      newUrl.pathname = newUrl.pathname.replace('/store', '');
      const newRequest = new Request(newUrl, request);
      return chatStore.fetch(newRequest);
    }

    // 传递到GraphQL处理器
    const yoga = createGraphQLServer(env);
    // @ts-ignore
    return yoga.fetch(request, env, ctx);
  }
};

// 导出ChatStore类
export { ChatStore };