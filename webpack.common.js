const path = require('path');
const Dotenv = require('dotenv-webpack');

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
  plugins: [
    new Dotenv({
      path: './.env',              // 默认路径，可以指定其他路径
      safe: true,                  // 加载 .env.example 确保所有变量都存在
      allowEmptyValues: true,      // 允许空值
      silent: true,                // 隐藏任何警告
      defaults: false,             // 在 .env 找不到变量时使用 .env.defaults
      prefix: 'process.env.'       // 变量前缀，默认为 process.env.
    })
  ],
  stats: {
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false
  }
};