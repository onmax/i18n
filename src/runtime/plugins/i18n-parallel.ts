import { defineNuxtPlugin } from '#imports'
import plugin from './i18n'

// registered instead of `./i18n` with `parallelPlugin`, so each file declares its metadata statically
export default defineNuxtPlugin({
  name: 'i18n:plugin',
  parallel: true,
  setup: nuxt => plugin(nuxt),
})
