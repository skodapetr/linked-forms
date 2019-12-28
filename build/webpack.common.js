const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  "entry": [
    path.join(__dirname, "..", "client", "index.jsx"),
  ],
  "output": {
    "path": path.join(__dirname, "..", "dist"),
    "filename": "bundle.js",
    "publicPath": "./",
  },
  "resolve": {
    // "modules": ["node_modules"],
    "extensions": [".js", ".jsx", ".ts"],
  },
  "externals": {
    // Used by rdflib.js, solid-auth-cli (cmd interface)
    // leading to missing 'fs' module exception.
    "solid-auth-cli": "null",
  },
  "module": {
    "rules": [
      {
        "test": /\.jsx?$/,
        "use": "babel-loader",
      },
      {
        "test": /\.tsx?$/,
        "use": "ts-loader",
        "exclude": /node_modules/,
      },
    ],
  },
  "plugins": [
    new HtmlWebpackPlugin({
      "filename": "index.html",
      "title": "Linked Forms",
      "template": path.join(__dirname, "..", "public", "index.html"),
      "inject": true,
    }),
    new webpack.DefinePlugin({}),
  ],
};
