import type { Config } from "stylelint";

export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // The classless guarantee: source CSS may only target elements, attributes, and pseudo-classes.
    "selector-max-class": 0,
    "selector-max-id": 0,
    "custom-property-pattern": "^_?m-[a-z0-9]+(-[a-z0-9]+)*$",
    "keyframes-name-pattern": "^m-[a-z0-9]+(-[a-z0-9]+)*$",
    "import-notation": "string",
    // Blank lines group @imports by layer and custom properties by scale.
    "at-rule-empty-line-before": [
      "always",
      {
        except: ["blockless-after-same-name-blockless", "first-nested"],
        ignore: ["after-comment"],
        ignoreAtRules: ["import"],
      },
    ],
    "custom-property-empty-line-before": null,
    "value-keyword-case": ["lower", { ignoreKeywords: ["SFMono-Regular"] }],
  },
} satisfies Config;
