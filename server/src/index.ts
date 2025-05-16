import { ChatSessionService, Env } from './chat-session-kv';

export default {
  async fetch (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      console.log('worker 入口: request: ', JSON.stringify(request));
      // 处理CORS预检请求
      if (request.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
      }

      // 获取URL
      const url = new URL(request.url);

      // 处理健康检查路径
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: corsHeaders(),
        });
      }

      // 创建聊天会话服务实例
      const chatService = new ChatSessionService(env);

      console.log('worker: request: ', JSON.stringify(request));
      // 将请求转发到聊天服务
      const response = await chatService.fetch(request);

      // 添加CORS头
      return addCorsHeaders(response);
    } catch (error) {
      // 记录错误
      console.error('Error handling request:', error);

      // 返回错误响应
      return new Response(
        JSON.stringify({
          // @ts-ignore
          errors: [{ message: 'Internal Server Error', details: error.message }]
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders()
          }
        }
      );
    }
  },

  // 添加定期任务处理程序
  async scheduled (event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 执行清理过期会话
    const chatService = new ChatSessionService(env);
    const cleanedCount = await chatService.cleanupOldSessions();
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
};

/**
 * 处理CORS预检请求
 */
function handleCorsPreflightRequest (): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

/**
 * 创建CORS头
 */
function corsHeaders () {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * 为响应添加CORS头
 */
function addCorsHeaders (response: Response): Response {
  const newHeaders = new Headers(response.headers);

  // 添加CORS头
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // 创建新响应
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}