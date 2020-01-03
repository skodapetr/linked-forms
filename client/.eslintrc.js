module.exports = {
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
  ],
  "plugins": [
    "react",
  ],
  "env": {
    "browser": true,
    "es6": true,
  },
  "rules": {
    "quotes": ["error", "double"],
    "object-shorthand": ["error", "never"],
    "quote-props": ["error", "always"],
    "no-use-before-define": ["error", "nofunc"],
    "prefer-destructuring": 0,
  },
  "parser": "babel-eslint",
  "settings": {
    "react": {
      "version": "detect",
    }
  },
  "globals": {
    "URL_PREFIX": false,
    "DEREFERENCE_IRI": false,
    "URL_BASE": false,
    "FORM_URL": false,
    "REPOSITORY_TYPE": false,
    "SENTRY_REPORT": false,
    "SENTRY_URL": false,
    "GOOGLE_TAG_MANAGER_ID": false,
    "SHOW_FORM_URL": false,
    "SHOW_PUBLISHER_TAB": false,
    "process": false,
    "module": false,
  },
};
