import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['output/**', '.playwright-cli/**', 'output-audit*.json'],
})
