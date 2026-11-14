import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8')
const [graph, ui, css, zh, en] = await Promise.all([
  read('src/graph.js'), read('src/client.js'), read('src/map.css'),
  read('locale/zh.json'), read('locale/en.json'),
])
const indentedGraph = graph.trimEnd().split('\n').map(line => line ? '    ' + line : '').join('\n')
const buildStamp = createHash('sha256').update([graph, ui, css, zh, en].join('\u0000')).digest('hex').slice(0, 8)
const artifact = ui
  .replace('  /* GRAPH */', () => indentedGraph)
  .replace('/* CSS */ null', () => JSON.stringify(css))
  .replace('/* LOCALES */ null', () => JSON.stringify({ zh: JSON.parse(zh), en: JSON.parse(en) }))
  .replace('/* BUILD */ null', () => JSON.stringify(buildStamp))
const dir = new URL('../dist/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('client.js', dir), artifact)
