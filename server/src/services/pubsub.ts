// src/services/pubsub.ts
import { createPubSub } from 'graphql-yoga';
import { Message, StreamChunk } from '../types';

// 定义频道前缀
export const CHAT_CHANNEL = 'CHAT_MESSAGES';
export const STREAM_CHANNEL = 'STREAM_MESSAGES';

// 定义频道类型
export type ChatChannel = `${typeof CHAT_CHANNEL}-${string}`;
export type StreamChannel = `${typeof STREAM_CHANNEL}-${string}`;

// 创建联合类型来表示所有可能的频道名称
export type PubSubChannel = ChatChannel | StreamChannel;

// 定义频道到消息类型的映射
export interface PubSubChannelTypeMap {
  [key: ChatChannel]: Message;
  [key: StreamChannel]: StreamChunk;
}

// 创建单例PubSub实例
let pubSubInstance: ReturnType<typeof createPubSub> | null = null;

export function getPubSub () {
  if (!pubSubInstance) {
    pubSubInstance = createPubSub();
  }
  return pubSubInstance;
}

// 安全地发布消息的辅助函数
export function safePublish<TChannel extends PubSubChannel> (
  pubSub: ReturnType<typeof createPubSub>,
  channel: TChannel,
  payload: TChannel extends ChatChannel ? Message : StreamChunk
) {
  pubSub.publish(channel, payload);
}

// 用于从Durable Objects发布事件到主Worker的方法
export interface PubSubEvent {
  channel: PubSubChannel;
  payload: Message | StreamChunk;
}