import { ChatSessionDO, Env } from './chat-session';

export default {
  async fetch (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
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

      console.log('url.searchParams.get.sessionId', url.searchParams.get('sessionId'));
      // 获取会话ID参数，如果没有则使用默认值
      const sessionId = url.searchParams.get('id') || getSessionIdFromRequest(request) || 'default';

      // 基于会话ID获取Durable Object ID
      const id = env.CHAT_SESSIONS.idFromName(sessionId);

      // 获取Durable Object实例
      const stub = env.CHAT_SESSIONS.get(id);

      // 将请求转发到Durable Object
      const response = await stub.fetch(request);

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
  }
};

/**
 * 从请求中提取会话ID
 */
function getSessionIdFromRequest (request: Request): string | null {
  try {
    // 尝试从Authorization头中提取
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7); // 移除"Bearer "前缀
    }

    return null;
  } catch (error) {
    console.error('Error extracting session ID:', error);
    return null;
  }
}

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

// 导出Durable Object类
export { ChatSessionDO };