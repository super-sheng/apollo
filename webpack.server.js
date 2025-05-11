const path = require('path');
const { merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');
const NodemonPlugin = require('nodemon-webpack-plugin');
const common = require('./webpack.common');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = merge(common, {
  name: 'server',
  target: 'node',
  entry: './server/src/index.ts',
  
  output: {
    path: path.resolve(__dirname, 'server/dist'),
    filename: 'index.js',
    publicPath: '/',
    clean: true
  },
  
  mode: isProduction ? 'production' : 'development',
  
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  
  // Don't bundle node_modules
  externalsPresets: { node: true },
  externals: [nodeExternals()],
  
  plugins: [
    // Add nodemon for development to auto-restart the server
    ...(isProduction ? [] : [
      new NodemonPlugin({
        script: path.resolve(__dirname, 'server/dist/index.js'),
        watch: path.resolve(__dirname, 'server/dist'),
        nodeArgs: ['--inspect'],
      })
    ])
  ],
  
  node: {
    __dirname: false,
    __filename: false,
  },
  
  optimization: {
    minimize: isProduction
  }
});