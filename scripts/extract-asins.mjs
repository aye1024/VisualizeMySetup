import fs from 'node:fs'

const html = fs.readFileSync(process.argv[2], 'utf8')
const seen = new Set()
for (const match of html.matchAll(/data-asin="(B0[A-Z0-9]{8,})"/g)) {
  if (seen.has(match[1])) continue
  seen.add(match[1])
  if (seen.size > 8) break
  console.log(match[1])
}
