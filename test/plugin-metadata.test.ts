import { readdirSync, readFileSync } from 'node:fs'
import { loadNuxt } from '@nuxt/kit'
import { parseSync } from 'oxc-parser'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'

const pluginsDir = resolve(process.cwd(), './src/runtime/plugins')
const META_KEYS = new Set(['name', 'enforce', 'order', 'dependsOn', 'parallel'])

/**
 * Nuxt reads plugin metadata from the source without evaluating it. A value that isn't a
 * literal (or an array of string literals for `dependsOn`) makes it warn on every build and
 * fall back to resolving the plugin order at runtime.
 */
function nonStaticMetaKeys(file: string) {
  const { program } = parseSync(file, readFileSync(file, 'utf8'))
  const exported = program.body.find(node => node.type === 'ExportDefaultDeclaration')
  const call = exported?.declaration
  if (call?.type !== 'CallExpression' || call.arguments[0]?.type !== 'ObjectExpression') {
    throw new Error(`${file} does not export defineNuxtPlugin({ ... })`)
  }
  const invalid: string[] = []
  for (const property of call.arguments[0].properties) {
    if (property.type !== 'Property' || property.key.type !== 'Identifier' || !META_KEYS.has(property.key.name)) continue
    const value = property.value
    const isStatic = property.key.name === 'dependsOn'
      ? value.type === 'ArrayExpression' && value.elements.every(e => e?.type === 'Literal' && typeof e.value === 'string')
      : value.type === 'Literal'
    if (!isStatic) invalid.push(property.key.name)
  }
  return invalid
}

describe('runtime plugin metadata', () => {
  test.each(readdirSync(pluginsDir))('%s declares static metadata', (file) => {
    expect(nonStaticMetaKeys(resolve(pluginsDir, file))).toEqual([])
  })
})

describe('parallelPlugin', () => {
  const rootDir = resolve(process.cwd(), './test/fixtures/module-setup')

  async function registeredMainPlugin(parallelPlugin: boolean) {
    const nuxt = await loadNuxt({ rootDir, dev: false, overrides: { pages: false, i18n: { parallelPlugin } } })
    try {
      return nuxt.options.plugins
        .map(plugin => (typeof plugin === 'string' ? plugin : plugin.src))
        .filter(src => /runtime\/plugins\/i18n(?:-parallel)?(?:\.\w+)?$/.test(src))
    } finally {
      await nuxt.close()
    }
  }

  test('registers the parallel variant of the main plugin only when enabled', async () => {
    expect(await registeredMainPlugin(false)).toEqual([expect.stringMatching(/plugins\/i18n(?:\.\w+)?$/)])
    expect(await registeredMainPlugin(true)).toEqual([expect.stringMatching(/plugins\/i18n-parallel(?:\.\w+)?$/)])
  })
})
