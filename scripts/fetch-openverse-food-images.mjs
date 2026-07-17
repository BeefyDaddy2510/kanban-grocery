import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const catalogPath = resolve('src/foodCatalog.ts')
const outputPath = resolve('src/foodImageUrls.json')
const translationsPath = resolve('src/foodImageQueries.json')
const source = await readFile(catalogPath, 'utf8')
const names = [...source.matchAll(/^\s*group\([^\n]*\[([^\]]+)]\),?$/gm)]
  .flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(nameMatch => nameMatch[1]))

const headers = { 'User-Agent': 'Grocy-Homie food catalog image lookup/1.0 (https://github.com/BeefyDaddy2510/kanban-grocery)' }
const sleep = milliseconds => new Promise(resolveSleep => setTimeout(resolveSleep, milliseconds))

const queryOverrides = {
  'Polníček': "lamb's lettuce",
  'Jarní cibulka': 'spring onion',
  'Dýně Hokkaido': 'Hokkaido pumpkin',
  'Máslová dýně': 'butternut squash',
  'Kaki': 'persimmon fruit',
  'Eidam': 'Edam cheese',
  'Cottage': 'cottage cheese',
  'Rohlík': 'Czech bread roll',
  'Houska': 'Czech bread roll',
  'Kaiserka': 'Kaiser bread roll',
  'Knäckebrot': 'crispbread',
  'Sádlo': 'pork lard',
  'Husí sádlo': 'goose fat',
  'Máta': 'mint herb',
  'Kopr': 'dill herb',
  'Pitná voda': 'glass of drinking water',
  'Sodová voda': 'sparkling water glass',
  'Ovesný nápoj': 'oat milk glass',
  'Jablečný džus': 'glass of apple juice',
  'Červená řepa': 'whole beetroot vegetable',
  'Kuřecí prsa': 'raw chicken breast',
  'Tuňák ve vlastní šťávě': 'open canned tuna food',
  'Celer bulva': 'celery root',
  'Hlávkový salát': 'head lettuce',
  'Rukola': 'arugula',
  'Mandarinka': 'mandarin orange',
  'Ostružiny': 'blackberries',
  'Švestky': 'fresh plums',
  'Fíky čerstvé': 'fresh figs',
  'Datle čerstvé': 'fresh dates',
  'Králičí hřbet': 'rabbit loin meat',
  'Kuřecí stehno bez kůže': 'skinless chicken thigh',
  'Hovězí kližka': 'beef shank',
  'Hovězí mleté maso': 'ground beef',
  'Telecí kýta': 'veal leg meat',
  'Husí prsa': 'roast goose breast',
  'Hovězí srdce': 'beef heart meat',
  'Candát': 'zander fish',
  'Tvaroh polotučný': 'quark cheese',
  'Smetana na vaření': 'cooking cream',
  'Čočka hnědá': 'brown lentils',
  'Čočka zelená': 'green lentils',
  'Hrách žlutý': 'yellow split peas',
  'Hrách zelený': 'green peas',
  'Fazole mungo': 'mung beans',
  'Lupina': 'lupin beans',
  'Rýže jasmínová': 'jasmine rice',
  'Rýže parboiled': 'parboiled rice',
  'Lasagne pláty': 'lasagna sheets',
  'Žitné vločky': 'rye flakes',
  'Ječné kroupy': 'pearl barley',
  'Polenta vařená': 'cooked polenta',
  'Gnocchi': 'gnocchi pasta',
  'Pšeničná mouka hladká': 'plain wheat flour',
  'Pšeničná mouka polohrubá': 'wheat flour',
  'Celozrnná pšeničná mouka': 'whole wheat flour',
  'Kukuřičná mouka': 'corn flour',
  'Chléb konzumní': 'bread loaf',
  'Rajčata krájená konzervovaná': 'canned diced tomatoes',
  'Kukuřice sterilovaná': 'canned corn',
  'Hrášek sterilovaný': 'canned peas',
  'Žampiony sterilované': 'canned mushrooms',
  'Okurky sterilované': 'pickled cucumbers',
  'Tuňák ve vlastní šťávě': 'canned tuna',
  'Ocet kvasný': 'white vinegar',
  'Černý čaj': 'black tea cup',
  'Zelený čaj': 'green tea cup',
}

const manualImages = {
  'Jablečný džus': {
    imageUrl: 'https://api.openverse.org/v1/images/46daef2e-6c39-404d-a323-40cdbf8baeab/thumb/',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=404343',
    sourceTitle: 'Apple juice with 3 apples', imageCreator: 'Flunse (Patrick Geltinger)',
    imageLicense: 'CC BY-SA 3.0', imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  'Červená řepa': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Beets_-_9690511364.jpg/960px-Beets_-_9690511364.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Beets_-_9690511364.jpg',
    sourceTitle: 'Beets', imageCreator: 'The Farmstrs',
    imageLicense: 'CC BY 2.0', imageLicenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  'Tuňák ve vlastní šťávě': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Tuna_can.jpg/960px-Tuna_can.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tuna_can.jpg',
    sourceTitle: 'Tuna can', imageCreator: 'Sevela.p',
    imageLicense: 'CC BY-SA 3.0', imageLicenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
}

async function fetchWithRetry(url, delay = 250) {
  await sleep(delay)
  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await fetch(url, { headers })
    if (response.ok) return response.json()
    if (response.status !== 429 || attempt === 5) throw new Error(`${response.status} ${response.statusText}`)
    const reset = Number(response.headers.get('x-ratelimit-reset'))
    await sleep(Number.isFinite(reset) ? Math.min(60000, Math.max(5000, reset * 1000 - Date.now())) : attempt * 5000)
  }
}

async function translate(name) {
  if (queryOverrides[name]) return queryOverrides[name]
  const params = new URLSearchParams({ q: name, langpair: 'cs|en' })
  const payload = await fetchWithRetry(`https://api.mymemory.translated.net/get?${params}`, 150)
  return String(payload.responseData?.translatedText || name).trim()
}

async function searchOpenverse(query) {
  const params = new URLSearchParams({
    q: query, page_size: '10', mature: 'false', categories: 'photograph',
    license_type: 'commercial', extension: 'jpg,png',
  })
  const payload = await fetchWithRetry(`https://api.openverse.org/v1/images/?${params}`, 250)
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const queryText = normalize(query)
  const queryWords = queryText.split(' ').filter(word => word.length > 2 && !['fresh', 'food', 'meat', 'glass', 'cup'].includes(word))
  const candidates = (payload.results || []).filter(candidate => candidate.thumbnail && candidate.foreign_landing_url)
  const score = candidate => {
    const title = normalize(candidate.title)
    const tags = normalize((candidate.tags || []).map(tag => tag.name).join(' '))
    return (title === queryText ? 20 : 0) + queryWords.reduce((sum, word) => sum + (title.includes(word) ? 4 : 0) + (tags.includes(word) ? 1 : 0), 0) - title.length / 500
  }
  const result = candidates.sort((left, right) => score(right) - score(left))[0]
  return result ? {
    imageUrl: result.thumbnail,
    sourceUrl: result.foreign_landing_url,
    sourceTitle: result.title || query,
    imageCreator: result.creator || '',
    imageLicense: [String(result.license || '').toUpperCase(), result.license_version].filter(Boolean).join(' '),
    imageLicenseUrl: result.license_url || '',
  } : null
}

const translations = await readFile(translationsPath, 'utf8').then(JSON.parse).catch(() => ({}))
for (const [index, name] of names.entries()) {
  if (queryOverrides[name]) translations[name] = queryOverrides[name]
  else if (!translations[name]) translations[name] = await translate(name)
  if ((index + 1) % 25 === 0) console.log(`Translated ${index + 1}/${names.length}`)
}
await writeFile(translationsPath, `${JSON.stringify(translations, null, 2)}\n`, 'utf8')

const images = await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => ({}))
for (const [index, name] of names.entries()) {
  if (images[name]) continue
  try {
    images[name] = await searchOpenverse(translations[name])
  } catch (error) {
    console.error(`${name}: ${error.message}`)
    images[name] = null
  }
  if ((index + 1) % 25 === 0) console.log(`Images ${index + 1}/${names.length}`)
}

Object.assign(images, manualImages)
await writeFile(outputPath, `${JSON.stringify(images, null, 2)}\n`, 'utf8')
const resolved = Object.values(images).filter(Boolean).length
console.log(`Resolved ${resolved}/${names.length} Openverse food images to ${outputPath}`)
for (const [name, value] of Object.entries(images)) if (!value) console.log(`Missing: ${name} (${translations[name]})`)
