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
    extensions: [".ts", ".js"],
    fallback: {
      fs: false,
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
      crypto: false
    }
  },
  resolveLoader: {
    modules: [path.resolve(__dirname, "node_modules"), "node_modules"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.json"),
            transpileOnly: true
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
};