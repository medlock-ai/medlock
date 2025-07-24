export default {
  // Standard formatting rules
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 100,

  // Overrides for specific files
  overrides: [
    {
      // Disable trailing commas for wrangler JSONC files
      files: ['**/wrangler*.jsonc'],
      options: {
        trailingComma: 'none',
      },
    },
  ],
}
