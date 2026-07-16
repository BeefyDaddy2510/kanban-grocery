import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAppServer } from '../server.mjs'

async function startTestServer(dataDir, staticDir) {
  const server = createAppServer({ dataDir, staticDir })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { server, url: `http://127.0.0.1:${port}` }
}

test('persists shared state across server restarts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'grocy-homie-'))
  const dataDir = join(root, 'data')
  const staticDir = join(root, 'dist')
  await mkdir(staticDir)
  await writeFile(join(staticDir, 'index.html'), '<h1>Grocy Homie</h1>')
  t.after(() => rm(root, { recursive: true, force: true }))

  const first = await startTestServer(dataDir, staticDir)
  let response = await fetch(`${first.url}/api/state`)
  assert.deepEqual(await response.json(), { state: null, revision: 0, updatedAt: null })

  response = await fetch(`${first.url}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: { data: { pantry: [{ id: 'milk' }] }, settings: { language: 'cs' } } }),
  })
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.revision, 1)
  await new Promise(resolve => first.server.close(resolve))

  const second = await startTestServer(dataDir, staticDir)
  t.after(() => new Promise(resolve => second.server.close(resolve)))
  response = await fetch(`${second.url}/api/state`)
  const loaded = await response.json()
  assert.equal(loaded.revision, 1)
  assert.equal(loaded.state.data.pantry[0].id, 'milk')
  assert.equal(loaded.state.settings.language, 'cs')
})

test('rejects malformed state writes and serves the SPA', async t => {
  const root = await mkdtemp(join(tmpdir(), 'grocy-homie-'))
  const staticDir = join(root, 'dist')
  await mkdir(staticDir)
  await writeFile(join(staticDir, 'index.html'), '<h1>Grocy Homie</h1>')
  await writeFile(join(staticDir, 'site.webmanifest'), '{"name":"Grocy Homie"}')
  t.after(() => rm(root, { recursive: true, force: true }))

  const app = await startTestServer(join(root, 'data'), staticDir)
  t.after(() => new Promise(resolve => app.server.close(resolve)))

  const rejected = await fetch(`${app.url}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: { data: [] } }),
  })
  assert.equal(rejected.status, 400)

  const page = await fetch(`${app.url}/some/client/route`)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Grocy Homie/)

  const manifest = await fetch(`${app.url}/site.webmanifest`)
  assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/)
})

test('looks up and normalizes a food product by EAN', async t => {
  let calls = 0
  const app = createAppServer({
    dataDir: join(tmpdir(), `grocy-homie-products-${Date.now()}`),
    staticDir: tmpdir(),
    fetchImpl: async (_url, options) => {
      calls += 1
      assert.match(options.headers['User-Agent'], /Grocy-Homie/)
      return new Response(JSON.stringify({
        status: 1,
        product: {
          code: '3017620422003', product_name: 'Test product', brands: 'Test brand',
          product_quantity: 350, product_quantity_unit: 'g', image_front_url: 'https://example.test/product.jpg',
          stores: 'Test shop', nutriments: { 'energy-kcal_100g': 539, carbohydrates_100g: 57.5, sugars_100g: 56.3, fat_100g: 30.9, proteins_100g: 6.3 },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => app.close(resolve)))
  const { port } = app.address()

  const first = await fetch(`http://127.0.0.1:${port}/api/products/3017620422003`)
  const product = await first.json()
  assert.equal(product.found, true)
  assert.equal(product.product.name, 'Test product')
  assert.equal(product.product.packageGrams, 350)
  assert.equal(product.product.nutritionPer100g.kcal, 539)
  assert.equal(product.product.nutritionPer100g.sugars, 56.3)

  await fetch(`http://127.0.0.1:${port}/api/products/3017620422003`)
  assert.equal(calls, 1, 'product response should be cached')
})

test('validates EAN before calling Open Food Facts', async t => {
  const app = createAppServer({ dataDir: tmpdir(), staticDir: tmpdir(), fetchImpl: async () => { throw new Error('should not be called') } })
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => app.close(resolve)))
  const { port } = app.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/products/123`)
  assert.equal(response.status, 400)
})
