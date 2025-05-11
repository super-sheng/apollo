import type { YogaInitialContext } from 'graphql-yoga';

// 使用最新的 Cloudflare Workers 类型
export interface GraphQLContext extends YogaInitialContext {
  env: Env;
  pubSub: ReturnType<typeof import('graphql-yoga').createPubSub>;
  getChatStore: (env: Env) => DurableObjectStub;
}

export interface Env {
  CHAT_STORE: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  ENVIRONMENT?: string;
}