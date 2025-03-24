const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    'bundle': "./integration/fixtures/web3auth-bundle.ts",
    'evmwallet-bundle': "./integration/fixtures/evmwallet-bundle.ts"
  },
  mode: "development",
  devtool: "source-map",
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, "integration/fixtures/dist")
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    alias: {
      // Map the import path to the actual source files
      '@m3s/wallet': path.resolve(__dirname, '../packages/wallet/dist'),
      '@m3s/utils': path.resolve(__dirname, '../packages/utils/dist'),
      '../config/networks.js': path.resolve(__dirname, './integration/config/networks.ts')
    },
    fallback: {
      crypto: false,
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  ]
};