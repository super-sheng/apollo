import { createSchema } from 'graphql-yoga';
import { typeDefs } from './type-defs';
import { resolvers } from './resolvers';

export const schema = createSchema({
  typeDefs,
  resolvers,
});