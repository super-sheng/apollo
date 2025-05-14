import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// HTTP连接到GraphQL API
const httpLink = new HttpLink({
  uri: '/api/graphql',
});

// WebSocket连接用于订阅
const wsLink = new GraphQLWsLink(
  createClient({
    url: 'wss://your-cloudflare-worker.workers.dev/graphql',
  })
);

// 根据操作类型使用不同的链接
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

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});