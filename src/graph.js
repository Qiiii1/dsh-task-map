const CARD_W = 232
const CARD_H = 126
const GAP_X = 88
const GAP_Y = 42
const GROUP_GAP = 96
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

function layout(items) {
  const positions = new Map()
  const roots = items.filter(item => item.root)
  let yOffset = 0
  for (const root of roots) {
    const group = items.filter(item => !item.root && item.group === root.group)
    const lookup = new Map([[root.id, root], ...group.map(item => [item.id, item])])
    const levels = new Map([[root.id, 0]])
    const level = id => {
      if (!levels.has(id)) {
        const parents = lookup.get(id)?.parents.filter(parent => lookup.has(parent)) ?? []
        levels.set(id, parents.length ? 1 + Math.max(...parents.map(level)) : 1)
      }
      return levels.get(id)
    }
    const columns = new Map()
    positions.set(root.id, { x: 0, y: yOffset })
    for (const item of group) {
      const column = level(item.id)
      if (!columns.has(column)) columns.set(column, [])
      columns.get(column).push(item)
    }
    // Fold long plans across the canvas so early and late steps are visible
    // together. Within one depth, nodes sit in parallel.
    const last = Math.max(0, ...columns.keys())
    const columnsPerRow = 3
    let rowY = 0
    for (let first = 0; first <= last; first += columnsPerRow) {
      const row = first / columnsPerRow
      const count = Math.min(columnsPerRow, last - first + 1)
      let height = CARD_H
      for (let offset = 0; offset < count; offset++) {
        const column = first + offset
        const bucket = columns.get(column) ?? []
        const columnX = row % 2 === 0 ? offset : columnsPerRow - 1 - offset
        height = Math.max(height, bucket.length * (CARD_H + GAP_Y) - GAP_Y)
        bucket.forEach((item, index) => positions.set(item.id, item.position ?? {
          x: columnX * (CARD_W + GAP_X),
          y: yOffset + rowY + index * (CARD_H + GAP_Y),
        }))
      }
      rowY += height + 100
    }
    yOffset += rowY + GROUP_GAP
  }
  const loose = items.filter(item => !positions.has(item.id))
  loose.forEach((item, index) => positions.set(item.id, item.position ?? {
    x: 0, y: yOffset + index * (CARD_H + GAP_Y),
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
