import { OpenAI } from 'openai';
import { Message } from '../types';
import { STREAM_CHANNEL } from './pubsub';
import { Env } from '../types';
import { handleError } from '../utils/error-handler';
import { logger } from '../utils/logger';

// 处理OpenAI流式响应
export async function generateOpenAIStream (
  env: Env,
  pubSub: any, // 这里接收来自主Worker的pubSub实例
  messages: Message[],
  assistantMessageId: string,
  systemPrompt: string,
  streamId: string,
  // @ts-ignore
  getChatStore: (env: Env) => DurableObjectStub
) {
  try {
    logger.info(`开始生成OpenAI流式响应: ${streamId}`);

    // 创建OpenAI实例
    const openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    // 格式化聊天历史为OpenAI格式
    const chatHistory = messages.map(msg => ({
      role: msg.role as any,
      content: msg.text
    }));

    // 添加系统提示
    chatHistory.unshift({
      role: 'system' as const,
      content: systemPrompt
    });

    logger.debug(`发送到OpenAI的消息数量: ${chatHistory.length}`);

    // 创建流式请求
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo',  // 使用最新模型
      messages: chatHistory,
      stream: true,
      max_tokens: 2000
    });

    let fullText = '';
    let chunkIndex = 0;

    // 处理流式响应
    for await (const chunk of stream) {
      chunkIndex++;
      const content = chunk.choices[0]?.delta?.content || '';
      fullText += content;

      if (content) {
        // 通过pubSub发布流块（由主Worker提供）
        pubSub.publish(`${STREAM_CHANNEL}-${streamId}`, {
          id: `${streamId}-chunk-${chunkIndex}`,
          messageId: assistantMessageId,
          text: fullText,
          complete: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    logger.info(`OpenAI流式响应完成: ${streamId}, 总字符数: ${fullText.length}`);

    // 流式传输完成时，发布最终版本
    pubSub.publish(`${STREAM_CHANNEL}-${streamId}`, {
      id: `${streamId}-chunk-final`,
      messageId: assistantMessageId,
      text: fullText,
      complete: true,
      createdAt: new Date().toISOString()
    });

    // 更新消息
    const chatStore = getChatStore(env);
    await chatStore.fetch(
      new Request(`https://dummy-url/messages/${assistantMessageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: fullText,
          complete: true
        })
      })
    );

  } catch (error) {
    const errorMessage = handleError(error);
    logger.error(`OpenAI流处理错误: ${errorMessage}`);

    // 发布错误消息
    pubSub.publish(`${STREAM_CHANNEL}-${streamId}`, {
      id: `${streamId}-error`,
      messageId: assistantMessageId,
      text: "生成回复时发生错误。",
      complete: true,
      createdAt: new Date().toISOString()
    });

    // 更新消息以标记错误
    try {
      const chatStore = getChatStore(env);
      await chatStore.fetch(
        new Request(`https://dummy-url/messages/${assistantMessageId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: "生成回复时发生错误。",
            error: errorMessage,
            complete: true
          })
        })
      );
    } catch (updateError) {
      logger.error(`更新错误消息失败: ${handleError(updateError)}`);
    }
  }
}