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
})
