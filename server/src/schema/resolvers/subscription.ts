import { GraphQLContext } from '../../types';
import { CHAT_CHANNEL, STREAM_CHANNEL } from '../../services/pubsub';

export const Subscription = {
  // 订阅对话中的新消息
  messageCreated: {
    subscribe: (_: unknown, { conversationId }: { conversationId: string }, { pubSub }: GraphQLContext) => {
      return pubSub.subscribe(`${CHAT_CHANNEL}-${conversationId}`);
    },
    resolve: (payload: any) => payload
  },

  // 订阅流式消息
  messageStream: {
    subscribe: (_: unknown, { streamId }: { streamId: string }, { pubSub }: GraphQLContext) => {
      return pubSub.subscribe(`${STREAM_CHANNEL}-${streamId}`);
    },
    resolve: (payload: any) => payload
  }
};