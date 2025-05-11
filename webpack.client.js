const path = require('path');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const common = require('./webpack.common');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = merge(common, {
  name: 'client',
  target: 'web',
  entry: './client/src/index.tsx',
  
  output: {
    path: path.resolve(__dirname, 'client/dist'),
    filename: isProduction ? 'js/[name].[contenthash:8].js' : 'js/[name].js',
    chunkFilename: isProduction ? 'js/[name].[contenthash:8].chunk.js' : 'js/[name].chunk.js',
    publicPath: '/',
    clean: true
  },
  
  mode: isProduction ? 'production' : 'development',
  
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  
  module: {
    rules: [
      // TypeScript with SWC - custom config for client
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
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              }
            }
          }
        }
      },
      // CSS and SCSS
      {
        test: /\.(css|scss|sass)$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 2
            }
          },
          'postcss-loader',
          'sass-loader'
        ]
      },
      // Images
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024 // 10kb
          }
        },
        generator: {
          filename: 'images/[name].[hash:8][ext]'
        }
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash:8][ext]'
        }
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './client/public/index.html',
      favicon: './client/public/favicon.ico',
      inject: true,
    }),
    ...(process.env.NODE_ENV === 'development' 
      ? [new ReactRefreshWebpackPlugin()] 
      : []),
    ...(isProduction ? [
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash:8].css',
        chunkFilename: 'css/[name].[contenthash:8].chunk.css'
      })
    ] : [])
  ],
  
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin()
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          name: 'vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'initial'
        },
        common: {
          name: 'commons',
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'client/public'),
    },
    port: 3000,
    hot: true,
    compress: true,
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    }
  },
  
  performance: {
    hints: isProduction ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
});