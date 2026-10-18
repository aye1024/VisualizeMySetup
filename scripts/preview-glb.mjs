import fs from 'node:fs'

const file = process.argv[2]
const out = process.argv[3]
const buffer = fs.readFileSync(file)
const jsonLength = buffer.readUInt32LE(12)
const json = JSON.parse(buffer.slice(20, 20 + jsonLength).toString())
const binStart = 20 + jsonLength + 8
const bin = buffer.slice(binStart)
const mesh = json.meshes[0]
const primitive = mesh.primitives[0]
const accessor = json.accessors[primitive.attributes.POSITION]
const view = json.bufferViews[accessor.bufferView]
const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
const count = accessor.count
const points = []
for (let i = 0; i < count; i += 8) {
  const offset = start + i * 12
  points.push([bin.readFloatLE(offset), bin.readFloatLE(offset + 4), bin.readFloatLE(offset + 8)])
}

const size = 280
const views = [
  [(p) => p[0], (p) => p[1], 'front xy'],
  [(p) => p[0], (p) => p[2], 'top xz'],
  [(p) => p[2], (p) => p[1], 'side zy'],
]
const gap = 8
const width = size * views.length + gap * (views.length - 1)
const height = size
const pixels = Buffer.alloc(width * height * 3, 245)

function plot(viewIndex, xOf, yOf) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of points) {
    const x = xOf(point)
    const y = yOf(point)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6)
  const originX = viewIndex * (size + gap)
  for (const point of points) {
    const x = originX + Math.round(((xOf(point) - minX) / span) * (size - 16) + 8)
    const y = Math.round((1 - (yOf(point) - minY) / span) * (size - 16) + 8)
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const index = (y * width + x) * 3
    pixels[index] = 20
    pixels[index + 1] = 20
    pixels[index + 2] = 20
  }
}

views.forEach((view, index) => plot(index, view[0], view[1]))

const row = width * 3
const pad = (4 - (row % 4)) % 4
const rowSize = row + pad
const pixelSize = rowSize * height
const header = 54
const bmp = Buffer.alloc(header + pixelSize)
bmp.write('BM')
bmp.writeUInt32LE(bmp.length, 2)
bmp.writeUInt32LE(header, 10)
bmp.writeUInt32LE(40, 14)
bmp.writeInt32LE(width, 18)
bmp.writeInt32LE(height, 22)
bmp.writeUInt16LE(1, 26)
bmp.writeUInt16LE(24, 28)
bmp.writeUInt32LE(pixelSize, 34)
for (let y = 0; y < height; y++) {
  const src = (height - 1 - y) * row
  pixels.copy(bmp, header + y * rowSize, src, src + row)
}
fs.writeFileSync(out, bmp)
console.log('wrote', out, points.length, 'points')
