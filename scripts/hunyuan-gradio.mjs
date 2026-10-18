import fs from 'node:fs'
import path from 'node:path'
import { Client, handle_file } from '../tmp-tools/node_modules/@gradio/client/dist/index.js'

const imagePath = path.resolve(process.argv[2])
const outPath = path.resolve(process.argv[3])

const space = process.argv[4] || 'tencent/Hunyuan3D-2.1'
const endpoint = process.argv[5] || '/generation_all'
const client = await Client.connect(space)
console.log('connected', space, endpoint, imagePath)
const job = client.submit(
  endpoint,
  [
    '',
    handle_file(imagePath),
    null,
    null,
    null,
    null,
    15,
    5,
    1234,
    128,
    true,
    8000,
    false,
  ],
  null,
  null,
  true,
)

const log = []
let final = null
for await (const message of job) {
  log.push(message)
  console.log(JSON.stringify(message).slice(0, 500))
  if (message.type === 'data') final = message
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(`${outPath}.json`, JSON.stringify({ final, log }, null, 2))
console.log('events', log.map((item) => item.type).join(','))

function walk(value, found) {
  if (!value) return
  if (typeof value === 'string') {
    if (value.includes('.glb') || value.includes('/file=')) found.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found)
    return
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) walk(child, found)
  }
}

const urls = []
walk(final, urls)
console.log('urls', urls)
const glbUrl = urls.find((url) => url.startsWith('http') && url.includes('.glb'))
if (!glbUrl) throw new Error('no glb url')
const absolute = glbUrl
const response = await fetch(absolute)
if (!response.ok) throw new Error(`download ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
fs.writeFileSync(outPath, bytes)
console.log('wrote', outPath, bytes.length)
