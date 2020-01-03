module.exports = (api) => {

  api.cache.using(() => process.env.NODE_ENV);

  const presets = [
    "@babel/preset-react",
    ["@babel/preset-env", {
      "targets": {
        "chrome": 41,
      },
      "useBuiltIns": "usage",
      "corejs": {
        "version": 3,
        "proposals": true,
      },
    }],
  ];

  const plugins = [];

  // We do not transpile node_modules as that would lead to a bunch
  // of warnings.
  const ignore = [
    "node_modules",
  ];

  if (api.env(["development"])) {
    plugins.push("react-hot-loader/babel");
  }

  return {
    "presets": presets,
    "plugins": plugins,
    "ignore": ignore,
  };

};