module.exports = {
  "extends": [
    "airbnb/base" // Base version does not use React.
  ],
  "rules": {
    "quotes": ["error", "double"],
    "object-shorthand": ["error", "never"],
    "quote-props": ["error", "always"],
    "no-use-before-define": ["error", "nofunc"],
    "prefer-destructuring": 0
  }
};
