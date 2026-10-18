import fs from 'node:fs'
import path from 'node:path'

const SPACE = 'https://tencent-hunyuan3d-2mini-turbo.hf.space'
const imagePath = process.argv[2]
const outPath = process.argv[3]
if (!imagePath || !outPath) {
  console.error('usage: node scripts/hunyuan-from-image.mjs <image> <out.glb>')
  process.exit(1)
}

async function upload(filePath) {
  const body = new FormData()
  const bytes = fs.readFileSync(filePath)
  body.append('files', new Blob([bytes]), path.basename(filePath))
  const response = await fetch(`${SPACE}/upload`, { method: 'POST', body })
  const text = await response.text()
  if (!response.ok) throw new Error(`upload ${response.status}: ${text.slice(0, 400)}`)
  const payload = JSON.parse(text)
  const uploaded = Array.isArray(payload) ? payload[0] : payload.files?.[0] ?? payload[0]
  if (!uploaded) throw new Error(`unexpected upload response: ${text.slice(0, 400)}`)
  console.log('uploaded', typeof uploaded === 'string' ? uploaded : JSON.stringify(uploaded).slice(0, 200))
  return typeof uploaded === 'string' ? uploaded : uploaded.path ?? uploaded
}

function fileData(uploadedPath, origName) {
  return {
    path: uploadedPath,
    orig_name: origName,
    meta: { _type: 'gradio.FileData' },
  }
}

async function submit(uploadedPath, origName) {
  const data = [
    '',
    fileData(uploadedPath, origName),
    null,
    null,
    null,
    null,
    10,
    5,
    1234,
    128,
    true,
    8000,
    false,
  ]
  const response = await fetch(`${SPACE}/call/generation_all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`submit ${response.status}: ${text.slice(0, 500)}`)
  const payload = JSON.parse(text)
  if (!payload.event_id) throw new Error(`no event id: ${text.slice(0, 400)}`)
  console.log('event', payload.event_id)
  return payload.event_id
}

function collectUrls(value, found) {
  if (!value) return
  if (typeof value === 'string') {
    if (/\.(glb|obj|gltf)(\?|$)/i.test(value) || value.includes('/file=')) found.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, found)
    return
  }
  if (typeof value === 'object') {
    for (const key of ['url', 'path', 'name']) collectUrls(value[key], found)
  }
}

async function waitForResult(eventId) {
  const response = await fetch(`${SPACE}/call/generation_all/${eventId}`, {
    headers: { Accept: 'text/event-stream' },
  })
  if (!response.ok || !response.body) {
    const text = await response.text()
    throw new Error(`stream ${response.status}: ${text.slice(0, 400)}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = 'message'
  const started = Date.now()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n')
    buffer = chunks.pop() ?? ''
    for (const line of chunks) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        const elapsed = Math.round((Date.now() - started) / 1000)
        console.log(`t=${elapsed}s event=${event} ${data.slice(0, 400)}`)
        if (event === 'complete') return JSON.parse(data)
        if (event === 'error') throw new Error(data.slice(0, 800))
        if (data.includes('"stage":"error"') || data.includes('stage": "error"')) {
          throw new Error(data.slice(0, 800))
        }
        event = 'message'
      }
    }
  }
  throw new Error('stream ended before a result')
}

async function download(url, dest) {
  const absolute = url.startsWith('http') ? url : `${SPACE}/file=${url}`
  const response = await fetch(absolute)
  if (!response.ok) throw new Error(`download ${response.status} ${absolute}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, bytes)
  console.log('wrote', dest, bytes.length)
}

const uploaded = await upload(imagePath)
const eventId = await submit(uploaded, path.basename(imagePath))
const result = await waitForResult(eventId)
fs.writeFileSync(`${outPath}.json`, JSON.stringify(result, null, 2))
const urls = []
collectUrls(result, urls)
console.log('candidates', urls)
const glb = urls.find((url) => /\.glb(\?|$)/i.test(url)) ?? urls[0]
if (!glb) throw new Error('no file in result')
await download(glb, outPath)
