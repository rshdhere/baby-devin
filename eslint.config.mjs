import { config as baseConfig } from "@devin/eslint-config/base";
import { config as reactInternalConfig } from "@devin/eslint-config/react-internal";
import { nextJsConfig } from "@devin/eslint-config/next-js";

const scopeTo = (configs, files) =>
  configs.map((config) => (config.files || config.ignores ? config : { ...config, files }));

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  ...scopeTo(reactInternalConfig, ["packages/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]),
  ...scopeTo(nextJsConfig, ["apps/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]),
];
