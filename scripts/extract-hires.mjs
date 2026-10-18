import fs from 'node:fs'

const html = fs.readFileSync(process.argv[2], 'utf8')
const urls = new Set()
for (const match of html.matchAll(/hiRes\\?":\\?"(https:[^"\\]+)/g)) {
  urls.add(match[1].replaceAll('\\/', '/').replaceAll('\\u0026', '&'))
}
console.log([...urls].slice(0, 6).join('\n') || 'none')
