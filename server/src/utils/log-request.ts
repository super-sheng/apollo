export default async function logRequestDetails (request: Request, prefix: string = '') {
  try {
    // 克隆请求以避免消耗原始请求
    const clonedRequest = request.clone();
    const url = new URL(request.url);

    // 构建基本请求信息
    const requestInfo: any = {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.searchParams.toString(),
      // 完整的请求头
      // headers: Object.fromEntries(request.headers?.entries()),
    };

    // 检查是否是 WebSocket 请求
    const isWebSocketRequest = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    requestInfo.isWebSocketRequest = isWebSocketRequest;

    if (isWebSocketRequest) {
      // 收集 WebSocket 特定的头信息
      requestInfo.webSocketInfo = {
        upgradeHeader: request.headers.get('Upgrade'),
        connectionHeader: request.headers.get('Connection'),
        secWebSocketKey: request.headers.get('Sec-WebSocket-Key'),
        secWebSocketVersion: request.headers.get('Sec-WebSocket-Version'),
        secWebSocketProtocol: request.headers.get('Sec-WebSocket-Protocol'),
        secWebSocketExtensions: request.headers.get('Sec-WebSocket-Extensions')
      };
    }

    // 检查是否是 GraphQL 请求
    const isGraphQLRequest = url.pathname === '/graphql';
    requestInfo.isGraphQLRequest = isGraphQLRequest;

    // 针对 POST 请求，尝试获取请求体
    if (request.method === 'POST' && !isWebSocketRequest) {
      try {
        // 尝试以文本形式获取
        const contentType = request.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const bodyText = await clonedRequest.text();
          requestInfo.bodyText = bodyText;

          try {
            // 尝试解析 JSON
            const bodyJson = JSON.parse(bodyText);
            requestInfo.bodyJson = bodyJson;

            // 特别处理 GraphQL 请求
            if (isGraphQLRequest && bodyJson.variables) {
              requestInfo.graphQLInfo = {
                operationName: bodyJson.operationName,
                variables: bodyJson.variables,
                query: bodyJson.query?.substring(0, 100) + '...' // 截断查询以避免日志过大
              };
            }
          } catch (e) {
            // @ts-ignore
            requestInfo.bodyParseError = `Cannot parse JSON: ${e.message}`;
          }
        } else if (contentType.includes('text/')) {
          requestInfo.bodyText = await clonedRequest.text();
        } else {
          requestInfo.bodyInfo = `Binary or unsupported content type: ${contentType}`;
        }
      } catch (e) {
        // @ts-ignore
        requestInfo.bodyReadError = `Cannot read body: ${e.message}`;
      }
    }

    // 记录 Cloudflare 特定信息（如果存在）
    if (request.cf) {
      requestInfo.cf = {
        country: request.cf.country,
        colo: request.cf.colo,
        asn: request.cf.asn,
        clientTcpRtt: request.cf.clientTcpRtt,
        timezone: request.cf.timezone
      };
    }

    // 输出完整信息
    console.log(`${prefix} 请求详情:`, JSON.stringify(requestInfo, null, 2));
    return requestInfo;
  } catch (error) {
    console.error('记录请求时出错:', error);
    // @ts-ignore
    return { error: `记录请求时出错: ${error.message}` };
  }
}

/**
 * 详细记录响应信息的函数
 */
async function logResponseDetails (response: Response, prefix: string = '') {
  try {
    // 克隆响应以避免消耗原始响应
    const clonedResponse = response.clone();

    // 构建基本响应信息
    const responseInfo: any = {
      status: response.status,
      statusText: response.statusText,
      webSocket: response.webSocket ? '存在' : undefined
    };

    // 针对非 WebSocket 响应，尝试获取响应体
    if (!response.webSocket && response.body) {
      try {
        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const bodyText = await clonedResponse.text();
          responseInfo.bodyText = bodyText;

          try {
            // 尝试解析 JSON
            const bodyJson = JSON.parse(bodyText);
            responseInfo.bodyJson = bodyJson;
          } catch (e) {
            // @ts-ignore
            responseInfo.bodyParseError = `Cannot parse JSON: ${e.message}`;
          }
        } else if (contentType.includes('text/')) {
          responseInfo.bodyText = await clonedResponse.text();
        } else {
          responseInfo.bodyInfo = `Binary or unsupported content type: ${contentType}`;
        }
      } catch (e) {
        // @ts-ignore
        responseInfo.bodyReadError = `Cannot read body: ${e.message}`;
      }
    }

    // 输出完整信息
    console.log(`${prefix} 响应详情:`, JSON.stringify(responseInfo, null, 2));
    return responseInfo;
  } catch (error) {
    console.error('记录响应时出错:', error);
    // @ts-ignore
    return { error: `记录响应时出错: ${error.message}` };
  }
}