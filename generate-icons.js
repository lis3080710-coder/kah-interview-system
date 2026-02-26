/**
 * KAH 면접 평가 시스템 - PWA 아이콘 생성 스크립트
 * "KAH" 흰색 픽셀 폰트를 버건디 배경에 렌더링
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

// ─── CRC32 ────────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
function makeChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, c])
}

// ─── 5×7 픽셀 폰트 (K, A, H) ──────────────────────────────────────────────
const FONT = {
  K: [
    [1,0,0,0,1],
    [1,0,0,1,0],
    [1,0,1,0,0],
    [1,1,0,0,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ],
  A: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  H: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
}

// ─── PNG 생성 (배경색 + KAH 흰색 텍스트) ──────────────────────────────────
function makePNG(size, bgR, bgG, bgB) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8; ihdrData[9] = 2 // RGB

  // 픽셀 버퍼 (배경색으로 초기화)
  const pixels = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => [bgR, bgG, bgB])
  )

  // 텍스트 크기 계산
  const TEXT = 'KAH'
  const LETTER_W = 5
  const LETTER_H = 7
  // 전체 너비의 약 55%를 텍스트가 차지하도록 스케일 결정
  const scale = Math.max(1, Math.floor(size * 0.55 / (TEXT.length * LETTER_W + (TEXT.length - 1) * 1.5)))
  const gap = Math.max(1, Math.round(scale * 1.4))

  const totalW = TEXT.length * LETTER_W * scale + (TEXT.length - 1) * gap
  const totalH = LETTER_H * scale
  let startX = Math.floor((size - totalW) / 2)
  const startY = Math.floor((size - totalH) / 2)

  // 각 글자 그리기
  for (const ch of TEXT) {
    const rows = FONT[ch]
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < rows[row].length; col++) {
        if (!rows[row][col]) continue
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = startX + col * scale + sx
            const py = startY + row * scale + sy
            if (px >= 0 && px < size && py >= 0 && py < size) {
              pixels[py][px] = [255, 255, 255]
            }
          }
        }
      }
    }
    startX += LETTER_W * scale + gap
  }

  // raw 이미지 데이터 (filter byte + RGB)
  const rowLen = size * 3 + 1
  const raw = Buffer.alloc(size * rowLen)
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const i = y * rowLen + 1 + x * 3
      raw[i]     = pixels[y][x][0]
      raw[i + 1] = pixels[y][x][1]
      raw[i + 2] = pixels[y][x][2]
    }
  }

  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── SVG 아이콘 (Chrome/Android용 고품질 벡터) ──────────────────────────────
function makeSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#800020"/>
  <text
    x="256"
    y="256"
    font-family="'Arial Black', Arial, sans-serif"
    font-size="200"
    font-weight="900"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="6"
  >KAH</text>
</svg>`
}

// ─── 파일 생성 ────────────────────────────────────────────────────────────────
const iconsDir = path.join(__dirname, 'public', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

const [r, g, b] = [128, 0, 32] // #800020

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), makePNG(192, r, g, b))
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), makePNG(512, r, g, b))
fs.writeFileSync(path.join(__dirname, 'public', 'apple-touch-icon.png'), makePNG(180, r, g, b))
fs.writeFileSync(path.join(__dirname, 'public', 'favicon-32.png'), makePNG(32, r, g, b))
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), makeSVG())

console.log('✅ 아이콘 생성 완료 (KAH 흰색 텍스트 포함):')
console.log('  - public/icons/icon-192.png  (192×192 PNG)')
console.log('  - public/icons/icon-512.png  (512×512 PNG)')
console.log('  - public/icons/icon.svg      (벡터 SVG)')
console.log('  - public/apple-touch-icon.png (iOS 180×180 PNG)')
console.log('  - public/favicon-32.png      (32×32 PNG)')
