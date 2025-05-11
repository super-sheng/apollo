const path = require('path');

module.exports = {
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
    alias: {
      '@client': path.resolve(__dirname, 'client/src'),
      '@server': path.resolve(__dirname, 'server/src'),
      '@shared': path.resolve(__dirname, 'shared')
    }
  },
  
  module: {
    rules: [
      // TypeScript with SWC
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: false,
                dynamicImport: true
              },
              target: 'es2015'
            }
          }
        }
      }
    ]
  },
  
  stats: {
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }
};