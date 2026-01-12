module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  ignorePatterns: ["node_modules/", ".vercel/", "dist/", ".backups/", "logs/"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": "warn",
    "no-empty": "warn",
    "no-control-regex": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-require-imports": "warn",
    "@typescript-eslint/no-unused-expressions": "warn"
  }
};
