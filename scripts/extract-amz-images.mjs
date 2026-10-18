import fs from 'node:fs'

const html = fs.readFileSync(process.argv[2], 'utf8')
const hi = [...html.matchAll(/"hiRes":"(https:[^"]+)"/g)].map((m) => m[1])
const large = [...html.matchAll(/"large":"(https:[^"]+)"/g)].map((m) => m[1])
const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
console.log(title)
console.log('---hiRes---')
for (const url of [...new Set(hi)].slice(0, 12)) console.log(url)
console.log('---large---')
for (const url of [...new Set(large)].slice(0, 8)) console.log(url)
