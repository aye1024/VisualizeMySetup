import fs from 'node:fs'

const html = fs.readFileSync(process.argv[2], 'utf8')
const blocks = html.split('data-asin="').slice(1)
for (const block of blocks.slice(0, 12)) {
  const asin = block.slice(0, 10)
  if (!asin.startsWith('B0')) continue
  const title =
    block.match(/<h2[\s\S]{0,500}?<span[^>]*>([^<]{12,180})<\/span>/)?.[1] ??
    block.match(/aria-label="([^"]{12,180})"/)?.[1] ??
    ''
  console.log(`${asin}  ${title.replaceAll('&amp;', '&')}`)
}
