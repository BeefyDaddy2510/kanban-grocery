import { createServer } from 'node:http'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const EMPTY_STATE = Object.freeze({ state: null, revision: 0, updatedAt: null })
const PRODUCT_CACHE_TTL = 24 * 60 * 60 * 1000
const PRODUCT_NOT_FOUND_TTL = 60 * 60 * 1000
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(body)
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Request body is too large')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('Request body must contain valid JSON')
    error.status = 400
    throw error
  }
}

export function createAppServer({
  dataDir = process.env.DATA_DIR || '/data',
  staticDir = process.env.STATIC_DIR || resolve('dist'),
  fetchImpl = globalThis.fetch,
} = {}) {
  const stateFile = join(dataDir, 'grocy-homie-state.json')
  const staticRoot = resolve(staticDir)
  let writeQueue = Promise.resolve()
  const productCache = new Map()

  function packageWeight(product) {
    const amount = Number(product.product_quantity)
    const unit = String(product.product_quantity_unit || '').toLowerCase()
    if (Number.isFinite(amount) && amount > 0) {
      if (unit === 'kg') return Math.round(amount * 1000)
      if (!unit || unit === 'g') return Math.round(amount)
    }
    const quantity = String(product.quantity || '')
    const match = quantity.match(/([\d.,]+)\s*(kg|g)\b/i)
    if (!match) return 0
    const parsed = Number(match[1].replace(',', '.'))
    return Number.isFinite(parsed) ? Math.round(parsed * (match[2].toLowerCase() === 'kg' ? 1000 : 1)) : 0
  }

  function numeric(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  async function lookupProduct(ean) {
    const cached = productCache.get(ean)
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const fields = [
      'code', 'product_name', 'generic_name', 'brands', 'quantity', 'product_quantity',
      'product_quantity_unit', 'image_front_url', 'image_front_small_url', 'nutriments',
      'stores', 'purchase_places', 'categories_tags',
    ].join(',')
    const response = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=${encodeURIComponent(fields)}`, {
      headers: { 'User-Agent': 'Grocy-Homie/1.5 (https://github.com/BeefyDaddy2510/kanban-grocery)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      const error = new Error(`Open Food Facts returned ${response.status}`)
      error.status = 502
      throw error
    }
    const payload = await response.json()
    const product = payload?.product
    const found = payload?.status === 1 && isObject(product)
    const value = found ? {
      found: true,
      source: 'open-food-facts',
      product: {
        ean: String(product.code || ean),
        name: String(product.product_name || product.generic_name || product.brands || '').trim(),
        brand: String(product.brands || '').trim(),
        image: String(product.image_front_url || product.image_front_small_url || ''),
        packageGrams: packageWeight(product),
        nutritionPer100g: {
          kcal: numeric(product.nutriments?.['energy-kcal_100g']) || numeric(product.nutriments?.energy_100g) / 4.184,
          carbs: numeric(product.nutriments?.carbohydrates_100g),
          sugars: numeric(product.nutriments?.sugars_100g),
          fat: numeric(product.nutriments?.fat_100g),
          protein: numeric(product.nutriments?.proteins_100g),
          fiber: numeric(product.nutriments?.fiber_100g),
        },
        stores: [product.stores, product.purchase_places].filter(Boolean).join(', '),
        category: Array.isArray(product.categories_tags) ? String(product.categories_tags[0] || '').replace(/^[a-z]{2}:/, '').replaceAll('-', ' ') : '',
      },
    } : { found: false, source: 'open-food-facts' }
    productCache.set(ean, { value, expiresAt: Date.now() + (found ? PRODUCT_CACHE_TTL : PRODUCT_NOT_FOUND_TTL) })
    return value
  }

  async function readStoredState() {
    try {
      const stored = JSON.parse(await readFile(stateFile, 'utf8'))
      if (!isObject(stored) || !isObject(stored.state) || !isObject(stored.state.data) || !isObject(stored.state.settings)) {
        throw new Error('Stored state has an invalid structure')
      }
      return {
        state: stored.state,
        revision: Number.isSafeInteger(stored.revision) ? stored.revision : 1,
        updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : null,
      }
    } catch (error) {
      if (error?.code === 'ENOENT') return EMPTY_STATE
      throw error
    }
  }

  async function persistState(state) {
    await mkdir(dataDir, { recursive: true })
    const current = await readStoredState()
    const stored = {
      state,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    }
    const temporaryFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporaryFile, `${JSON.stringify(stored)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryFile, stateFile)
    return stored
  }

  async function serveStatic(request, response, pathname) {
    let requestedPath
    try {
      requestedPath = decodeURIComponent(pathname)
    } catch {
      response.writeHead(400).end('Bad request')
      return
    }

    const relativePath = normalize(requestedPath).replace(/^([/\\])+/, '')
    let filePath = resolve(staticRoot, relativePath || 'index.html')
    if (!filePath.startsWith(`${staticRoot}\\`) && filePath !== staticRoot && !filePath.startsWith(`${staticRoot}/`)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    try {
      if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(staticRoot, 'index.html')
    }

    try {
      const body = await readFile(filePath)
      const immutable = filePath.includes(`${join(staticRoot, 'assets')}`)
      response.writeHead(200, {
        'Cache-Control': immutable ? 'public, max-age=604800, immutable' : 'no-cache',
        'Content-Length': body.length,
        'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
      })
      if (request.method === 'HEAD') response.end()
      else response.end(body)
    } catch {
      response.writeHead(404).end('Not found')
    }
  }

  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname

      if (pathname.endsWith('/healthz')) {
        response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('ok\n')
        return
      }

      if (pathname.endsWith('/api/state')) {
        if (request.method === 'GET') {
          await writeQueue.catch(() => undefined)
          sendJson(response, 200, await readStoredState())
          return
        }

        if (request.method === 'PUT') {
          const body = await readBody(request)
          if (!isObject(body?.state) || !isObject(body.state.data) || !isObject(body.state.settings)) {
            sendJson(response, 400, { error: 'state.data and state.settings must be JSON objects' })
            return
          }
          writeQueue = writeQueue.catch(() => undefined).then(() => persistState(body.state))
          sendJson(response, 200, await writeQueue)
          return
        }

        response.writeHead(405, { Allow: 'GET, PUT' }).end()
        return
      }

      const productMatch = pathname.match(/\/api\/products\/(\d+)$/)
      if (productMatch) {
        if (request.method !== 'GET') {
          response.writeHead(405, { Allow: 'GET' }).end()
          return
        }
        const ean = productMatch[1]
        if (ean.length < 8 || ean.length > 14) {
          sendJson(response, 400, { error: 'EAN must contain 8 to 14 digits' })
          return
        }
        sendJson(response, 200, await lookupProduct(ean))
        return
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end()
        return
      }
      await serveStatic(request, response, pathname)
    } catch (error) {
      console.error(error)
      sendJson(response, error?.status || 500, { error: error?.status ? error.message : 'Internal server error' })
    }
  })
}

export async function startServer(options = {}) {
  const server = createAppServer(options)
  const port = Number(process.env.PORT || 8080)
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, '0.0.0.0', resolveListen)
  })
  console.log(`Grocy Homie is listening on port ${port}`)
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer()
}
