/**
 * Shared ESLint configuration for the KO Broker Platform.
 * All packages extend this config.
 */
module.exports = {
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off', // Handled by TypeScript
  },
};
