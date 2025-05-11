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
    context: ({ request }) => {
      return {
        pubSub,
        getChatStore,
        env,
        request
      };
    },
    plugins: [
      useLogger(),
    ],

    // 配置订阅
    subscriptions: {
      enabled: true,
      protocol: ['WS', 'SSE'], // 支持两种协议
      path: '/graphql' // 订阅端点路径
    },
    graphiql: {
      subscriptionsProtocol: 'WS',
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
    if (url.pathname === '/websocket-diagnostics') {
      return serveWebSocketDiagnosticsPage();
    }

    // 诊断页面函数
    function serveWebSocketDiagnosticsPage () {
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>WebSocket诊断</title>
        <style>
          body { font-family: sans-serif; margin: 20px; max-width: 800px; }
          #log { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; margin: 10px 0; }
          .success { color: green; }
          .error { color: red; }
          button { margin: 5px; padding: 5px 10px; }
        </style>
      </head>
      <body>
        <h1>WebSocket连接诊断工具</h1>
        <div>
          <button id="checkNetwork">1. 检查网络</button>
          <button id="testHttp">2. 测试HTTP</button>
          <button id="testWebSocket">3. 测试WebSocket</button>
          <button id="clearLog">清除日志</button>
        </div>
        <div id="log"></div>
        
        <script>
          const logEl = document.getElementById('log');
          
          function log(msg, className) {
            const entry = document.createElement('div');
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
            if (className) entry.className = className;
            logEl.appendChild(entry);
            logEl.scrollTop = logEl.scrollHeight;
          }
          
          // 网络检查
          document.getElementById('checkNetwork').onclick = async function() {
            log('检查网络连接...');
            try {
              const startTime = Date.now();
              const response = await fetch('/health', { method: 'GET' });
              const elapsed = Date.now() - startTime;
              
              if (response.ok) {
                const data = await response.json();
                log(\`HTTP连接正常! 延迟: \${elapsed}ms\`, 'success');
                log(\`服务器状态: \${JSON.stringify(data)}\`, 'success');
              } else {
                log(\`HTTP连接异常! 状态码: \${response.status}\`, 'error');
              }
            } catch (error) {
              log(\`网络错误: \${error.message}\`, 'error');
            }
          };
          
          // HTTP测试
          document.getElementById('testHttp').onclick = async function() {
            log('测试HTTP API...');
            try {
              // 测试会话API
              const response = await fetch('/conversations', { method: 'GET' });
              if (response.ok) {
                const data = await response.json();
                log(\`获取对话列表成功! 共\${data.length}个对话\`, 'success');
              } else {
                log(\`获取对话列表失败! 状态码: \${response.status}\`, 'error');
              }
            } catch (error) {
              log(\`API错误: \${error.message}\`, 'error');
            }
          };
          
          // WebSocket测试
          document.getElementById('testWebSocket').onclick = function() {
            log('开始测试WebSocket连接...');
            
            try {
              const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
              const wsUrl = \`\${protocol}//\${location.host}/connect\`;
              log(\`尝试连接到: \${wsUrl}\`);
              
              const socket = new WebSocket(wsUrl);
              
              socket.onopen = function() {
                log('WebSocket连接成功!', 'success');
                
                // 发送测试消息
                const testMessage = JSON.stringify({
                  type: 'test',
                  message: 'Hello Server!',
                  timestamp: new Date().toISOString()
                });
                socket.send(testMessage);
                log(\`已发送测试消息: \${testMessage}\`);
              };
              
              socket.onmessage = function(event) {
                log(\`收到消息: \${event.data}\`, 'success');
              };
              
              socket.onclose = function(event) {
                log(\`连接已关闭: 代码=\${event.code}, 原因="\${event.reason || 'None'}"\`);
              };
              
              socket.onerror = function(event) {
                log('WebSocket连接错误!', 'error');
                console.error('WebSocket错误:', event);
              };
              
              // 60秒后关闭连接
              setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN) {
                  log('测试完成，关闭连接');
                  socket.close();
                }
              }, 60000);
            } catch (error) {
              log(\`创建WebSocket失败: \${error.message}\`, 'error');
            }
          };
          
          document.getElementById('clearLog').onclick = function() {
            logEl.innerHTML = '';
          };
          
          log('诊断页面已加载，请按顺序执行测试。');
        </script>
      </body>
      </html>
      `;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
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

    if (path === '/connect' ||
      path.startsWith('/conversations') ||
      path.startsWith('/messages')) {
      console.log(`路由请求到 ChatStore: ${path}`);

      try {
        const chatStore = getChatStore(env);
        return await chatStore.fetch(request);
      } catch (error) {
        console.error(`路由到 ChatStore 失败: ${error}`);
        // @ts-ignore
        return new Response(`内部服务器错误: ${error.message}`, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
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