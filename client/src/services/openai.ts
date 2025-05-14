import { OpenAI } from 'openai';

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  // @ts-ignore
  async getCompletion (content: string, messages: any[]): Promise {
    // 构建消息历史
    const messageHistory = messages.map(msg => ({
      role: msg.sender === 'USER' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // 添加当前消息
    messageHistory.push({
      role: 'user',
      content,
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        // @ts-ignore
        messages: messageHistory,
        max_tokens: 500,
      });

      return response.choices[0].message.content || '抱歉，我无法理解您的问题。';
    } catch (error) {
      console.error('OpenAI API 错误:', error);
      return '发生了一个错误，请稍后再试。';
    }
  }
}