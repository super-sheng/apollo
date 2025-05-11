// src/graphql/client.ts
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  ApolloLink,
  from
} from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { onError } from '@apollo/client/link/error';

// 从环境变量获取 API URL
const API_URL = process.env.REACT_APP_API_URL;
const WS_URL = process.env.REACT_APP_WS_URL;

// 创建 HTTP 链接
const httpLink = new HttpLink({
  uri: API_URL
});

// 创建 WebSocket 链接
const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL as string,
    connectionParams: {
      // 可以添加认证信息等
    },
    retryAttempts: 5,
    shouldRetry: () => true
  })
);

// 错误处理链接
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// 根据操作类型选择使用 HTTP 或 WebSocket 链接
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

// 创建 Apollo 客户端
const client = new ApolloClient({
  link: from([errorLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          messages: {
            // 合并新消息，而不是替换
            merge (existing = [], incoming) {
              return [...existing, ...incoming];
            }
          }
        }
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all'
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all'
    },
    mutate: {
      errorPolicy: 'all'
    }
  }
});

export default client;