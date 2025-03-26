module.exports = {
  entry: {
  },
  mode: "development",
  devtool: "source-map",
  output: {
    filename: '[name].js',
    path: require('path').resolve(__dirname, "integration/fixtures/dist")
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    alias: {
      '@m3s/utils': require('path').resolve(__dirname, '../packages/utils/dist'),
      '@m3s/wallet': require('path').resolve(__dirname, '../packages/wallet/dist'),
      '@m3s/crosschain': require('path').resolve(__dirname, '../packages/crosschain/dist'),
      '@m3s/smartContract': require('path').resolve(__dirname, '../packages/smartContract/dist'),
      '../config/networks.js': require('path').resolve(__dirname, './integration/config/networks.ts')
    },
    fallback: {
      // (fallback configs)
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
    new (require('webpack')).ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
};