const path = require('path');

module.exports = {
  entry: './popup.js', // Ensure this is the entry point
  output: {
    filename: 'popup.bundle.js', // Output filename
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  mode: 'production',
  performance: {
    hints: false,
  },
};
