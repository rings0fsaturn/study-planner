module.exports = {
  rules: {
    "color-no-hex": true,
    "declaration-property-value-disallowed-list": {
      "/.*/": ["/^#/", "/^rgb/", "/^hsl/"],
    },
    "declaration-property-value-allowed-list": {
      "color": ["/var\\(--/"],
      "background": ["/var\\(--/", "transparent", "none"],
      "background-color": ["/var\\(--/", "transparent"],
      "padding": ["/var\\(--space/", "0"],
      "margin": ["/var\\(--space/", "0", "auto"],
    },
  },
};