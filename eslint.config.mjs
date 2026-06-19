import { config as baseConfig } from "@devin/eslint-config/base";

/** Root ESLint config for shared TS/JS packages. Apps with framework-specific rules keep their own eslint.config. */
export default [...baseConfig];
