const path = require('path')
const Dotenv = require('dotenv-webpack')

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js'
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-modules-commonjs']
          }
        }
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    modules: [
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'node_modules')
    ],
    extensions: ['.tsx', '.ts', '.js']
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    crypto: true
  },
  plugins: [
    new Dotenv({
      path: './.env'
    })
  ]
}
