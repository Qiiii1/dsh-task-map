const CARD_W = 232
const CARD_H = 126
const GAP_X = 88
const GAP_Y = 42
const GROUP_GAP = 96
const PER_ROW = 3
const STEP_X = CARD_W + 84
const STEP_Y = CARD_H + 84
const BLOCK_Y = CARD_H + 52
const BLOCK_STEP = CARD_H + 36
const BAND_GAP = 92
const ROOT = 'task'
const EMPTY_EDITS = { overrides: {}, added: [] }

const rootId = key => key === ROOT ? ROOT : 'root:' + key
const todoId = (key, content) => 'todo:' + key + ':' + content

function directParents(id, nodes) {
  return nodes.find(node => node.id === id)?.parents ?? []
}

function ancestors(id, nodes) {
  const found = new Set()
  const stack = [...directParents(id, nodes)]
  while (stack.length) {
    const parent = stack.pop()
    if (found.has(parent)) continue
    found.add(parent)
    stack.push(...directParents(parent, nodes))
  }
  return found
}

// 每段对话（mission）一棵「任务 → 步骤」小树，画布上纵向叠放；手动方块挂在最近一段上。
function makeGraph(groups, edits) {
  const items = []
  let order = 0
  for (const group of groups) {
    const id = rootId(group.key)
    items.push({
      id, key: group.key, group: group.key, root: true, order: items.filter(item => item.root).length + 1,
      title: group.title || '任务', status: 'pending', parents: [], guides: [],
    })
    const todos = Array.isArray(group.todos) ? group.todos : []
    todos.forEach((todo, index) => {
      items.push({
        id: todoId(group.key, todo.content), key: group.key, group: group.key, root: false, order: ++order,
        title: todo.content, status: todo.status, source: true,
        parents: [index === 0 ? id : todoId(group.key, todos[index - 1].content)],
      })
    })
  }
  const roots = items.filter(item => item.root)
  const fallbackRoot = roots.length ? roots[roots.length - 1].id : ROOT
  const fallbackGroup = roots.length ? roots[roots.length - 1].key : ROOT
  for (const added of edits.added) {
    items.push({
      ...added, root: false, key: added.group ?? fallbackGroup, group: added.group ?? fallbackGroup,
      order: ++order, parents: [fallbackRoot], status: 'pending', source: false, guides: [],
    })
  }
  const ids = new Set(items.map(item => item.id))
  for (const item of items) {
    if (item.root) {
      item.parents = []
      continue
    }
    const edit = edits.overrides[item.id]
    item.sourceTitle = item.title
    item.title = edit?.title ?? item.title
    item.detail = edit?.detail ?? ''
    item.status = edit?.status ?? item.status
    item.autoDone = edit?.autoDone === true
    item.statusEdited = edit?.status !== undefined
    item.guides = edit?.guides ?? []
    item.position = edit?.position
    item.preferredParents = edit?.parents ?? item.parents
    item.parents = []
  }
  // A new AI todo order can conflict with locally edited edges. Keep explicit
  // dependencies first, and fall back to the latest task root when a parent disappeared.
  const ordered = items.filter(item => !item.root)
    .sort((a, b) => Number(!!edits.overrides[b.id]?.parents) - Number(!!edits.overrides[a.id]?.parents))
  for (const item of ordered) {
    item.parents = [...new Set(item.preferredParents)].filter(parent =>
      parent !== item.id && ids.has(parent) && !ancestors(parent, items).has(item.id))
    if (item.parents.length === 0) item.parents = [fallbackRoot]
  }
  return items
}

// 布局参考 topic-explorer 的主线树状：起点卡片作为流程起点，步骤按深度从左到右推进；
// 一行放不下时蛇形折行（下一行从右往左接），行尾与下一行首之间是垂直连线，阅读顺序不会断。
// 手动方块挂在其目标步骤的正下方，不占主流程的位置。
function bandOf(root, items) {
  const group = items.filter(item => !item.root && item.group === root.group)
  const sources = group.filter(item => item.source).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const blocks = group.filter(item => !item.source)
  const index = new Map(sources.map((item, at) => [item.id, at]))
  const rowOf = id => Math.floor((index.get(id) ?? 0) / PER_ROW)
  const rows = Math.max(1, Math.ceil(sources.length / PER_ROW))
  const placed = []
  const depthOf = new Map()
  for (const block of blocks) {
    const parent = block.parents.find(id => index.has(id))
    const row = parent ? rowOf(parent) : rows - 1
    const key = parent ?? 'loose:' + row
    const depth = depthOf.get(key) ?? 0
    depthOf.set(key, depth + 1)
    placed.push({ block, parent, row, depth })
  }
  const perRowDepth = new Map()
  for (const entry of placed) perRowDepth.set(entry.row, Math.max(perRowDepth.get(entry.row) ?? 0, entry.depth + 1))
  const rowTops = []
  let top = 0
  for (let row = 0; row < rows; row++) {
    rowTops[row] = top
    const stacked = perRowDepth.get(row) ?? 0
    top += stacked
      ? Math.max(STEP_Y, BLOCK_Y + (stacked - 1) * BLOCK_STEP + CARD_H + 52)
      : STEP_Y
  }
  const spots = new Map([[root.id, { x: 0, y: rowTops[0] }]])
  sources.forEach((item, at) => {
    const row = Math.floor(at / PER_ROW)
    const slot = at % PER_ROW
    const column = row % 2 === 0 ? slot : PER_ROW - 1 - slot
    spots.set(item.id, { x: STEP_X + column * STEP_X, y: rowTops[row] })
  })
  for (const entry of placed) {
    if (entry.block.position) continue
    const parent = entry.parent ? spots.get(entry.parent) : null
    const baseX = parent ? parent.x : STEP_X + (PER_ROW - 1) * STEP_X
    const baseY = (parent ? parent.y : rowTops[entry.row]) + BLOCK_Y + entry.depth * BLOCK_STEP
    spots.set(entry.block.id, { x: baseX, y: baseY })
  }
  let width = 0
  let height = 0
  for (const spot of spots.values()) {
    width = Math.max(width, spot.x + CARD_W)
    height = Math.max(height, spot.y + CARD_H)
  }
  return { spots, width, height }
}

const FOCUS_RING = 224
const FOCUS_RING_STEP = 156
const FOCUS_GAP = 14

// 聚焦布局：把目标卡片放在正中，按依赖距离一圈圈往外散开。
// 上游在左、下游在右、手动方块在下方，其它任务的起点卡排在最外圈。
function focusLayout(items, centerId) {
  const center = items.find(item => item.id === centerId)
  if (!center) return layout(items)
  const byId = new Map(items.map(item => [item.id, item]))
  const related = (a, b) => {
    const left = byId.get(a)
    const right = byId.get(b)
    if (!left || !right) return false
    return left.parents.includes(right.id) || right.parents.includes(left.id)
  }
  const level = new Map([[center.id, 0]])
  let frontier = [center]
  while (frontier.length) {
    const next = []
    for (const node of frontier) {
      for (const other of items) {
        if (level.has(other.id) || other.group !== center.group) continue
        if (!related(node.id, other.id)) continue
        level.set(other.id, level.get(node.id) + 1)
        next.push(other)
      }
    }
    frontier = next
  }
  const up = ancestors(center.id, items)
  const preferred = node => {
    if (up.has(node.id)) return Math.PI
    if (!node.root && !node.source) return Math.PI / 2
    return 0
  }
  const positions = new Map([[center.id, { x: -CARD_W / 2, y: -CARD_H / 2 }]])
  function free(x, y) {
    for (const other of positions.values()) {
      if (Math.abs(x - other.x) < CARD_W + FOCUS_GAP && Math.abs(y - other.y) < CARD_H + FOCUS_GAP) return false
    }
    return true
  }
  function place(id, ring, angle) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const level = ring + attempt
      const slots = 6 * level
      const radius = FOCUS_RING + (level - 1) * FOCUS_RING_STEP
      const order = []
      for (let s = 0; s < slots; s++) {
        const slotAngle = (2 * Math.PI * s) / slots
        order.push({ s, gap: Math.abs(((slotAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) })
      }
      order.sort((a, b) => a.gap - b.gap)
      for (const entry of order) {
        const theta = (2 * Math.PI * entry.s) / slots
        const x = radius * Math.cos(theta) - CARD_W / 2
        const y = radius * Math.sin(theta) - CARD_H / 2
        if (!free(x, y)) continue
        positions.set(id, { x, y })
        return
      }
    }
  }
  const inside = items
    .filter(item => item.group === center.group && item.id !== center.id)
    .sort((a, b) => (level.get(a.id) ?? 99) - (level.get(b.id) ?? 99))
  for (const node of inside) place(node.id, level.get(node.id) ?? 1, preferred(node))
  const outsiders = items.filter(item => item.root && item.group !== center.group)
  const ring = Math.min(3, Math.max(1, ...level.values()) + 1)
  outsiders.forEach((node, at) => place(node.id, ring, (2 * Math.PI * at) / Math.max(1, outsiders.length)))
  for (const item of items) if (item.position && !positions.has(item.id)) positions.set(item.id, item.position)
  return positions
}

function focusOnly(items, id) {
  const node = items.find(item => item.id === id)
  if (!node) return items
  return items.filter(item => item.group === node.group || item.root)
}

// 每段任务是一条自左向右推进的主线（一行放不下就蛇形折行），多段任务按时间顺序
// 自上而下堆叠、共用同一个左边界，段与段之间由画布上的纵向虚线箭头串起来。
function layout(items) {
  const bands = items.filter(item => item.root).map(root => bandOf(root, items))
  const positions = new Map()
  let cursor = 0
  for (const band of bands) {
    for (const [id, spot] of band.spots) positions.set(id, { x: spot.x, y: spot.y + cursor })
    cursor += band.height + BAND_GAP
  }
  for (const item of items) if (item.position) positions.set(item.id, item.position)
  const bottom = cursor
  const loose = items.filter(item => !positions.has(item.id))
  loose.forEach((item, index) => positions.set(item.id, {
    x: 0, y: bottom + index * (CARD_H + GAP_Y),
  }))
  return positions
}

function readEdits(key) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key))
    if (saved?.overrides && Array.isArray(saved.added)) return saved
  } catch {
    // The canvas still works when browser storage is unavailable.
  }
  return EMPTY_EDITS
}

function guidePrompt({ node, nodes, approval, guide }) {
  const before = ancestors(node.id, nodes)
  const upstream = nodes.filter(item => !item.root && before.has(item.id))
  const after = nodes.filter(next => !next.root && ancestors(next.id, nodes).has(node.id))
  const stepName = item => item.detail ? item.title + '（' + item.detail + '）' : item.title
  const stepList = items => items.map(item => '- ' + stepName(item)).join('\n')
  const editedDependencies = [node, ...after].flatMap(item => {
    const parents = item.parents.map(id => nodes.find(candidate => candidate.id === id)).filter(candidate => candidate && !candidate.root)
    return parents.length ? ['- ' + item.title + ' ← ' + parents.map(parent => parent.title).join('、')] : []
  })
  return [
    '【任务地图 Guide】',
    node.source ? '目标步骤：' + stepName(node) : '引导对象：以下步骤',
    node.source && node.title !== node.sourceTitle ? 'DeepSeek 原待办：' + node.sourceTitle : '',
    approval && upstream.length
      ? '我认可以下上游步骤及已完成的成果。保留已有成果，尚未完成的前置步骤请按原计划完成。\n'
        + stepList(upstream)
      : '',
    guide ? '我的引导：\n' + guide : '',
    after.length ? '下游步骤：\n' + stepList(after) : '',
    editedDependencies.length ? '地图中的前置依赖：\n' + editedDependencies.join('\n') : '',
    node.source
      ? '把这条 Guide 应用于目标步骤及其下游。结合当前执行状态继续任务，并同步更新待办的步骤与状态。'
      : '把这条 Guide 应用于下面的步骤。结合当前执行状态继续任务，并同步更新待办的步骤与状态。',
  ].filter(Boolean).join('\n\n')
}
