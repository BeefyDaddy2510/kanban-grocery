import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createAppServer, parseReceiptText } from '../server.mjs'

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

test('parses receipt lines into item names, quantities and unit prices', () => {
  const items = parseReceiptText(`SUPERMARKET\nJABLKA 2 x 19,90 39,80\nMLEKO 1 ks 24,90\nROHLIK\n3 x 3,50 10,50\nCELKEM 75,20\nDPH 12,34`)
  assert.deepEqual(items, [
    { name: 'JABLKA', quantity: 2, unit: 'ks', priceCzk: 19.9 },
    { name: 'MLEKO', quantity: 1, unit: 'ks', priceCzk: 24.9 },
    { name: 'ROHLIK', quantity: 3, unit: 'ks', priceCzk: 3.5 },
  ])
})

test('parses invoice tables, merges repeated products and applies line discounts', () => {
  const items = parseReceiptText(`
M 08595190707768 SALÁT 140g CAMPING PC 14,100 3 42,30 1 42,30 47,38 23
Určeno pro konečnou spotřebu -23,27 -23,27 -26,06 23
M 2900180028321 *LACRUM EIDAM 30%CIHLA cca 2,7 KG 84,900 240,44 2,832 240,44 269,29 23 PX
M 04014400917956 MERCI 250g MANDLE BX 28,900 1 28,90 1 28,90 32,37 23 PX
Určeno pro konečnou spotřebu -5,78 -5,78 -6,47 23
M 04014400917956 MERCI 250g MANDLE BX 28,900 1 28,90 1 28,90 32,37 23 PX
Určeno pro konečnou spotřebu -5,78 -5,78 -6,47 23
M 8594002112523 FL DRESINK CHIPOTLE-BBQ 250ml BT 44,900 1 44,90 2 89,80 100,58 23 61283
KUP VÍCE = PLAŤ MÉNĚ - FL DRESINK CHIPOT -6,00 -12,00 -13,44 23
Celková částka 1 924,05
Platba kartou 1 924,05`)
  assert.deepEqual(items, [
    { name: 'SALÁT 140g CAMPING', barcode: '08595190707768', quantity: 3, unit: 'ks', priceCzk: 7.11 },
    { name: 'LACRUM EIDAM 30%CIHLA cca 2,7', barcode: '2900180028321', quantity: 2.832, unit: 'kg', priceCzk: 95.09 },
    { name: 'MERCI 250g MANDLE', barcode: '04014400917956', quantity: 2, unit: 'ks', priceCzk: 25.9 },
    { name: 'FL DRESINK CHIPOTLE-BBQ 250ml', barcode: '8594002112523', quantity: 2, unit: 'ks', priceCzk: 43.57 },
  ])
})

test('does not treat invoice totals and card payments as products', () => {
  assert.deepEqual(parseReceiptText('Celková částka 1 924,05\nPlatba kartou 1 924,05'), [])
})

test('parses Kaufland-style split quantity rows, tax letters and discounts', () => {
  const items = parseReceiptText(`
Meloun vodní
5,828 kg * 9,90 57,70 F
Lacteel UHT 1,5%
12 * 7,90 94,80 F
Termosklinice 2ks 56,90 C
TUC sm&cibule 100g
2 * 29,90 59,80 F
Sleva -29,90
Nektarinky 2 kg 79,90 F
K-Jarmark pšeničná hladká1kg
3 * 10,90 32,70 F
Součet 1 113,63
Platba kartou 1 113,63`)
  assert.deepEqual(items, [
    { name: 'Meloun vodní', quantity: 5.828, unit: 'kg', priceCzk: 9.9 },
    { name: 'Lacteel UHT 1,5%', quantity: 12, unit: 'ks', priceCzk: 7.9 },
    { name: 'Termosklinice 2ks', quantity: 1, unit: 'ks', priceCzk: 56.9 },
    { name: 'TUC sm&cibule 100g', quantity: 2, unit: 'ks', priceCzk: 14.95 },
    { name: 'Nektarinky 2 kg', quantity: 1, unit: 'ks', priceCzk: 79.9 },
    { name: 'K-Jarmark pšeničná hladká1kg', quantity: 3, unit: 'ks', priceCzk: 10.9 },
  ])
})

test('accepts a receipt upload and returns OCR items', async t => {
  let uploaded
  const app = createAppServer({
    dataDir: tmpdir(),
    staticDir: tmpdir(),
    receiptOcr: async (buffer, contentType) => {
      uploaded = { buffer, contentType }
      return { text: 'MLÉKO 24,90', items: [{ name: 'MLÉKO', quantity: 1, unit: 'ks', priceCzk: 24.9 }] }
    },
  })
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => app.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${app.address().port}/api/receipt-ocr`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8, 0xff]) })
  assert.equal(response.status, 200)
  assert.equal(uploaded.contentType, 'image/jpeg')
  assert.deepEqual([...uploaded.buffer], [0xff, 0xd8, 0xff])
  assert.deepEqual((await response.json()).items, [{ name: 'MLÉKO', quantity: 1, unit: 'ks', priceCzk: 24.9 }])
})

test('fetches, caches and persists the daily ECB exchange rate', async t => {
  const root = await mkdtemp(join(tmpdir(), 'grocy-homie-rate-'))
  const dataDir = join(root, 'data')
  let calls = 0
  const fetchRate = async (url, options) => {
    calls += 1
    assert.match(url, /ecb\.europa\.eu/)
    assert.match(options.headers['User-Agent'], /Grocy-Homie/)
    return new Response(`<?xml version="1.0"?><Envelope><Cube><Cube time='2026-07-17'><Cube currency='CZK' rate='24.205'/></Cube></Cube></Envelope>`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }
  const first = createAppServer({ dataDir, staticDir: tmpdir(), fetchImpl: fetchRate })
  await new Promise(resolve => first.listen(0, '127.0.0.1', resolve))
  const firstUrl = `http://127.0.0.1:${first.address().port}`
  let response = await fetch(`${firstUrl}/api/exchange-rate`)
  assert.equal(response.status, 200)
  const current = await response.json()
  assert.equal(current.rate, 24.205)
  assert.equal(current.date, '2026-07-17')
  assert.equal(current.source, 'ecb')
  assert.equal(current.stale, false)
  assert.equal(Number.isFinite(Date.parse(current.fetchedAt)), true)
  response = await fetch(`${firstUrl}/api/exchange-rate`)
  assert.equal(response.status, 200)
  assert.equal(calls, 1, 'fresh ECB response should be cached')
  await new Promise(resolve => first.close(resolve))

  const second = createAppServer({ dataDir, staticDir: tmpdir(), exchangeRateCacheTtl: 0, fetchImpl: async () => { throw new Error('ECB unavailable') } })
  await new Promise(resolve => second.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => second.close(resolve)))
  t.after(() => rm(root, { recursive: true, force: true }))
  response = await fetch(`http://127.0.0.1:${second.address().port}/api/exchange-rate`)
  const fallback = await response.json()
  assert.equal(response.status, 200)
  assert.equal(fallback.rate, 24.205)
  assert.equal(fallback.date, '2026-07-17')
  assert.equal(fallback.stale, true)
})
