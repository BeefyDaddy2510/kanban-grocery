import { createServer } from 'node:http'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024
const execFile = promisify(execFileCallback)
const EMPTY_STATE = Object.freeze({ state: null, revision: 0, updatedAt: null })
const PRODUCT_CACHE_TTL = 24 * 60 * 60 * 1000
const PRODUCT_NOT_FOUND_TTL = 60 * 60 * 1000
const EXCHANGE_RATE_CACHE_TTL = 6 * 60 * 60 * 1000
const ECB_DAILY_RATES_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
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

async function readRawBody(request, limit = MAX_RECEIPT_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) {
      const error = new Error('Receipt is too large (maximum is 15 MB)')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  if (!size) {
    const error = new Error('Receipt file is empty')
    error.status = 400
    throw error
  }
  return Buffer.concat(chunks)
}

function cleanReceiptName(value) {
  return String(value)
    .replace(/^\s*(?:\d{5,14}|[*#-]+)\s+/, '')
    .replace(/\s+(?:\d+(?:[.,]\d+)?\s*(?:x|ks|pc|pcs)\s+)?\d+[.,]\d{2}\s*$/i, '')
    .replace(/\s+[*A-D]$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[^\p{L}]+|[^\p{L}\p{N})%.'’+&/-]+$/gu, '')
    .trim()
}

const RECEIPT_IGNORED_LINE = /(?:^|\s)(celkem|celkov[aá]|total|subtotal|součet|suma|dph|vat|tax|základ|sazba|hotovost|cash|platba|payment|karta|card|vráceno|change|datum|date|čas|time|účtenka|receipt|doklad|faktura|invoice|provozovna|pokladna|pokladní|cashier|ičo|dič|děkujeme|thank you|www\.|tel\.?|otevírací)(?=\s|:|$)/i

function parseInvoiceItems(text) {
  const parsed = []
  let lastItem = null
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line) continue
    const productMatch = line.match(/^[A-Z]{1,2}\s+([0-9A-Z]{8,14})\s+(.+?)\s+(PC|BX|KG|BG|BT|SW|PK|EA)\s+(.+)$/i)
    if (productMatch) {
      const normalizedBarcode = productMatch[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1')
      const barcode = /^\d{8,14}$/.test(normalizedBarcode) ? normalizedBarcode : undefined
      const unitCode = productMatch[3].toUpperCase()
      const numericTail = productMatch[4].replace(/\s+(?:6|12|21|23)\s*(?:PX|\d+)?\s*$/i, '')
      const values = (numericTail.match(/-?\d+(?:[.,]\d+)?/g) || []).map(value => Number(value.replace(',', '.')))
      let quantity = 0
      let totalGross = 0
      if (values.length >= 6) {
        quantity = values[1] * values[3]
        totalGross = values[5]
      } else if (values.length === 5 && unitCode === 'KG') {
        quantity = values[2]
        totalGross = values[4]
      }
      const name = cleanReceiptName(productMatch[2]).replace(/^\*+/, '').trim()
      if (/\p{L}{2}/u.test(name) && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(totalGross) && totalGross >= 0) {
        lastItem = { name, barcode, quantity, unit: unitCode === 'KG' ? 'kg' : 'ks', totalGross }
        parsed.push(lastItem)
      } else {
        lastItem = null
      }
      continue
    }
    if (lastItem && /(kone[cč]nou\s+spot[rř]ebu|kup\s+v[ií]ce|sleva|discount)/i.test(line)) {
      const discounts = (line.match(/-\s*\d+(?:[.,]\d+)?/g) || []).map(value => -Number(value.replace(/[-\s]/g, '').replace(',', '.')))
      if (discounts.length && Number.isFinite(discounts.at(-1))) lastItem.totalGross += discounts.at(-1)
    }
  }
  if (!parsed.length) return []
  const merged = new Map()
  for (const item of parsed) {
    const key = `${item.barcode || item.name.toLocaleLowerCase('cs-CZ')}:${item.unit}`
    const current = merged.get(key)
    if (current) {
      current.quantity += item.quantity
      current.totalGross += item.totalGross
    } else {
      merged.set(key, { ...item })
    }
  }
  return [...merged.values()].map(item => ({
    name: item.name,
    ...(item.barcode ? { barcode: item.barcode } : {}),
    quantity: Math.round(item.quantity * 1000) / 1000,
    unit: item.unit,
    priceCzk: Math.round(Math.max(0, item.totalGross) / item.quantity * 100) / 100,
  }))
}

export function parseReceiptText(text) {
  const invoiceItems = parseInvoiceItems(text)
  if (invoiceItems.length) return invoiceItems
  const sourceLines = String(text).split(/\r?\n/).map(line => line.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const parsed = []
  let pendingName = ''
  for (const line of sourceLines) {
    const discountMatch = line.match(/(?:^|\s)(?:sleva|discount|\d+\s*%)[^\d-]*(-\s*\d{1,6}[,.]\d{2})(?:\s*[A-Z])?\s*$/i)
    if (discountMatch && parsed.length) {
      const discount = -Number(discountMatch[1].replace(/[-\s]/g, '').replace(',', '.'))
      if (Number.isFinite(discount)) parsed.at(-1).totalGross += discount
      pendingName = ''
      continue
    }
    if (RECEIPT_IGNORED_LINE.test(line)) { pendingName = ''; continue }
    const priceMatch = line.match(/(-?\d{1,6}[,.]\d{2})(?:\s*(?:Kč|CZK|EUR|€))?\s*[*A-Z]?\s*$/i)
    if (!priceMatch) {
      const possibleName = cleanReceiptName(line)
      pendingName = /\p{L}{2}/u.test(possibleName) && possibleName.length <= 80 ? possibleName : ''
      continue
    }

    const totalPrice = Number(priceMatch[1].replace(',', '.'))
    if (!Number.isFinite(totalPrice) || totalPrice < 0) continue
    const beforePrice = line.slice(0, priceMatch.index).trim()
    const multiplied = beforePrice.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ks)?\s*[*x×]\s*(\d{1,6}[,.]\d{2})\s*$/i)
    const singleUnitMarker = beforePrice.match(/^(.+\p{L}.*?)\s+1\s+(?:ks|pc|pcs)\s*$/iu)
    const quantityMatch = multiplied ? null : beforePrice.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:x|×)(?:\s+(\d{1,6}[,.]\d{2}))?\s*$/i)
      || (multiplied ? null : beforePrice.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:x|×)\s+/i))
    const quantity = multiplied ? Number(multiplied[1].replace(',', '.')) : quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : 1
    const explicitUnitPrice = multiplied ? Number(multiplied[3].replace(',', '.')) : quantityMatch?.[2] ? Number(quantityMatch[2].replace(',', '.')) : null
    const unit = multiplied?.[2]?.toLocaleLowerCase() || 'ks'
    let namePart = multiplied && pendingName ? pendingName : singleUnitMarker ? singleUnitMarker[1] : quantityMatch?.index !== undefined ? beforePrice.slice(0, quantityMatch.index).trim() : beforePrice
    if (!namePart && pendingName) namePart = pendingName
    const name = cleanReceiptName(namePart)
    pendingName = ''
    if (!/\p{L}{2}/u.test(name) || name.length > 80 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999) continue
    parsed.push({ name, quantity, unit, totalGross: explicitUnitPrice && explicitUnitPrice >= 0 ? explicitUnitPrice * quantity : totalPrice })
  }
  const merged = new Map()
  for (const item of parsed) {
    const key = `${item.name.toLocaleLowerCase('cs-CZ')}:${item.unit}`
    const current = merged.get(key)
    if (current) {
      current.quantity += item.quantity
      current.totalGross += item.totalGross
    } else {
      merged.set(key, { ...item })
    }
  }
  return [...merged.values()].map(item => ({ name: item.name, quantity: Math.round(item.quantity * 1000) / 1000, unit: item.unit, priceCzk: Math.round(Math.max(0, item.totalGross) / item.quantity * 100) / 100 }))
}

function detectReceiptType(buffer, contentType = '') {
  const type = String(contentType).split(';')[0].trim().toLowerCase()
  if (buffer.subarray(0, 4).toString() === '%PDF') return { extension: '.pdf', pdf: true }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { extension: '.jpg', pdf: false }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: '.png', pdf: false }
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { extension: '.webp', pdf: false }
  if (type === 'application/pdf') return { extension: '.pdf', pdf: true }
  const error = new Error('Use a JPG, PNG, WebP or PDF receipt')
  error.status = 415
  throw error
}

async function runReceiptOcr(buffer, contentType) {
  const detected = detectReceiptType(buffer, contentType)
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'grocy-homie-receipt-'))
  try {
    const inputPath = join(temporaryDirectory, `receipt${detected.extension}`)
    await writeFile(inputPath, buffer, { mode: 0o600 })
    let imagePaths = [inputPath]
    if (detected.pdf) {
      try {
        const { stdout: pdfText } = await execFile('pdftotext', ['-layout', '-nopgbrk', inputPath, '-'], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 })
        const invoiceItems = parseInvoiceItems(pdfText)
        if (invoiceItems.length) return { text: pdfText, items: invoiceItems, source: 'pdf-text' }
        const brokenLetterSpacing = /(?:\p{L}\s+){5,}\p{L}/u.test(pdfText)
        const directItems = brokenLetterSpacing ? [] : parseReceiptText(pdfText)
        if (directItems.length) return { text: pdfText, items: directItems, source: 'pdf-text' }
      } catch {
        // Scanned PDFs and documents without a usable text layer continue through OCR below.
      }
      const outputPrefix = join(temporaryDirectory, 'page')
      await execFile('pdftoppm', ['-jpeg', '-r', '300', '-f', '1', '-l', '5', inputPath, outputPrefix], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
      imagePaths = (await readdir(temporaryDirectory)).filter(name => /^page-\d+\.jpg$/i.test(name)).sort().map(name => join(temporaryDirectory, name))
      if (!imagePaths.length) throw new Error('PDF contains no readable pages')
    }
    const recognizeImages = async pageSegmentationMode => {
      const texts = []
      for (const imagePath of imagePaths) {
        const { stdout } = await execFile('tesseract', [imagePath, 'stdout', '-l', 'ces+eng', '--psm', pageSegmentationMode], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
        texts.push(stdout)
      }
      return texts.join('\n')
    }
    let text = await recognizeImages(detected.pdf ? '4' : '6')
    let items = parseReceiptText(text)
    if (detected.pdf && !items.length) {
      text = await recognizeImages('6')
      items = parseReceiptText(text)
    }
    return { text, items, source: 'ocr' }
  } catch (error) {
    if (!error.status) {
      error.status = error.code === 'ENOENT' ? 503 : 422
      error.message = error.code === 'ENOENT' ? 'Receipt OCR is not installed in this image' : `Receipt could not be read: ${error.message}`
    }
    throw error
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

export function createAppServer({
  dataDir = process.env.DATA_DIR || '/data',
  staticDir = process.env.STATIC_DIR || resolve('dist'),
  fetchImpl = globalThis.fetch,
  receiptOcr = runReceiptOcr,
  exchangeRateCacheTtl = EXCHANGE_RATE_CACHE_TTL,
} = {}) {
  const stateFile = join(dataDir, 'grocy-homie-state.json')
  const exchangeRateFile = join(dataDir, 'grocy-homie-exchange-rate.json')
  const staticRoot = resolve(staticDir)
  let writeQueue = Promise.resolve()
  const productCache = new Map()
  let exchangeRateCache = null
  let exchangeRateRefresh = null

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

  function exchangeRateAttribute(tag, name) {
    return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
  }

  function parseExchangeRate(xml) {
    const cubeTags = String(xml).match(/<Cube\b[^>]*>/gi) || []
    const date = cubeTags.map(tag => exchangeRateAttribute(tag, 'time')).find(Boolean)
    const czkTag = cubeTags.find(tag => exchangeRateAttribute(tag, 'currency') === 'CZK')
    const rate = Number(czkTag ? exchangeRateAttribute(czkTag, 'rate') : NaN)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || !Number.isFinite(rate) || rate <= 0) {
      const error = new Error('ECB returned an invalid CZK exchange rate')
      error.status = 502
      throw error
    }
    return { rate, date }
  }

  function validStoredExchangeRate(value) {
    return isObject(value) && Number.isFinite(value.rate) && value.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && typeof value.fetchedAt === 'string' && Number.isFinite(Date.parse(value.fetchedAt))
  }

  async function readStoredExchangeRate() {
    if (exchangeRateCache) return exchangeRateCache
    try {
      const stored = JSON.parse(await readFile(exchangeRateFile, 'utf8'))
      if (!validStoredExchangeRate(stored)) throw new Error('Stored exchange rate has an invalid structure')
      exchangeRateCache = stored
      return stored
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async function persistExchangeRate(value) {
    await mkdir(dataDir, { recursive: true })
    const temporaryFile = `${exchangeRateFile}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporaryFile, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryFile, exchangeRateFile)
    exchangeRateCache = value
    return value
  }

  async function fetchExchangeRate() {
    const response = await fetchImpl(ECB_DAILY_RATES_URL, {
      headers: { 'User-Agent': 'Grocy-Homie/1.7 (https://github.com/BeefyDaddy2510/kanban-grocery)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      const error = new Error(`ECB returned ${response.status}`)
      error.status = 502
      throw error
    }
    const parsed = parseExchangeRate(await response.text())
    return persistExchangeRate({ ...parsed, fetchedAt: new Date().toISOString(), source: 'ecb' })
  }

  async function getExchangeRate() {
    const cached = await readStoredExchangeRate()
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < exchangeRateCacheTtl) return { ...cached, stale: false }
    if (!exchangeRateRefresh) {
      exchangeRateRefresh = fetchExchangeRate().finally(() => { exchangeRateRefresh = null })
    }
    try {
      return { ...await exchangeRateRefresh, stale: false }
    } catch (error) {
      if (cached) return { ...cached, stale: true }
      if (!error.status) error.status = 502
      throw error
    }
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

  const server = createServer(async (request, response) => {
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

      if (pathname.endsWith('/api/exchange-rate')) {
        if (request.method !== 'GET') {
          response.writeHead(405, { Allow: 'GET' }).end()
          return
        }
        sendJson(response, 200, await getExchangeRate())
        return
      }

      if (pathname.endsWith('/api/receipt-ocr')) {
        if (request.method !== 'POST') {
          response.writeHead(405, { Allow: 'POST' }).end()
          return
        }
        const receipt = await readRawBody(request)
        const result = await receiptOcr(receipt, request.headers['content-type'] || '')
        sendJson(response, 200, { items: Array.isArray(result?.items) ? result.items : [], text: String(result?.text || '') })
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
  server.refreshExchangeRate = getExchangeRate
  return server
}

export async function startServer(options = {}) {
  const server = createAppServer(options)
  const port = Number(process.env.PORT || 8080)
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, '0.0.0.0', resolveListen)
  })
  const refreshExchangeRate = () => server.refreshExchangeRate().catch(error => console.error('Unable to refresh the ECB exchange rate', error))
  void refreshExchangeRate()
  const exchangeRateTimer = setInterval(refreshExchangeRate, EXCHANGE_RATE_CACHE_TTL)
  exchangeRateTimer.unref?.()
  server.once('close', () => clearInterval(exchangeRateTimer))
  console.log(`Grocy Homie is listening on port ${port}`)
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer()
}
