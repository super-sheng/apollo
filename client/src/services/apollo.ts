import {
  ApolloClient,
  InMemoryCache,
  split,
  HttpLink,
  ApolloLink
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { onError } from '@apollo/client/link/error';

// 错误处理链接
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  if (networkError) console.error(`[Network error]: ${networkError}`);
});

// HTTP 链接，用于查询和变更
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

// WebSocket 链接，用于订阅
const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:4000/graphql',
    connectionParams: {
      // 可以在这里添加认证信息
    },
    on: {
      connected: () => console.log('WebSocket connected'),
      error: (err) => console.error('WebSocket error:', err),
      closed: () => console.log('WebSocket closed'),
    },
    retryAttempts: 5,
    shouldRetry: () => true,
  })
);

// 根据操作类型分割链接
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

// 组合链接
const link = ApolloLink.from([errorLink, splitLink]);

// 创建 Apollo Client
export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});