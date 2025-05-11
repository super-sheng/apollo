// 创建一个返回 WebSocket 响应的辅助函数
export function createWebSocketResponse (client: WebSocket, options?: Omit<ResponseInit, 'webSocket'>): Response {
  return new Response(null, {
    status: 101,
    ...options,
    // @ts-ignore - 忽略类型错误
    webSocket: client
  });
}