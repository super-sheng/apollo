import type { YogaInitialContext } from 'graphql-yoga';
import type { PubSubChannel, PubSubChannelTypeMap } from '../services/pubsub';

// 使用最新的 Cloudflare Workers 类型
export interface GraphQLContext extends YogaInitialContext {
  env: Env;
  pubSub: ReturnType<typeof import('graphql-yoga').createPubSub>;
  // @ts-ignore
  getChatStore: (env: Env) => DurableObjectStub;
}

export interface Env {
  // @ts-ignore
  CHAT_STORE: DurableObjectNamespace;
  OPENAI_API_KEY: string;
  ENVIRONMENT?: string;
}