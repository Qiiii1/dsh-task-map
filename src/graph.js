const ROOT = 'task'
const CARD_W = 232
const CARD_H = 126
const GAP_X = 88
const GAP_Y = 42
const EMPTY_EDITS = { overrides: {}, added: [] }

function todoId(content) {
  return 'todo:' + content
}

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

function makeGraph(todos, edits) {
  const source = todos.map((todo, index) => ({
    id: todoId(todo.content), title: todo.content, status: todo.status, source: true,
    parents: [index === 0 ? ROOT : todoId(todos[index - 1].content)],
  }))
  const nodes = [...source, ...edits.added.map(node => ({
    ...node, parents: [ROOT], status: 'pending', source: false,
  }))].map(node => {
    const edit = edits.overrides[node.id]
    return { ...node, title: edit?.title ?? node.title, detail: edit?.detail ?? '',
      status: edit?.status ?? node.status, autoDone: edit?.autoDone === true, statusEdited: edit?.status !== undefined,
      sourceTitle: node.title, guides: edit?.guides ?? [],
      position: edit?.position, preferredParents: edit?.parents ?? node.parents, parents: [] }
  })
  const ids = new Set([ROOT, ...nodes.map(node => node.id)])
  // A new AI todo order can conflict with locally edited edges. Keep explicit
  // dependencies first, and fall back to the task root when a parent disappeared.
  const ordered = [...nodes].sort((a, b) => Number(!!edits.overrides[b.id]?.parents) - Number(!!edits.overrides[a.id]?.parents))
  for (const node of ordered) {
    node.parents = [...new Set(node.preferredParents)].filter(parent =>
      parent !== node.id && ids.has(parent) && !ancestors(parent, nodes).has(node.id))
    if (node.parents.length === 0) node.parents = [ROOT]
  }
  return nodes
}

function layout(nodes) {
  const lookup = new Map(nodes.map(node => [node.id, node]))
  const levels = new Map([[ROOT, 0]])
  function level(id) {
    if (!levels.has(id)) levels.set(id, 1 + Math.max(...lookup.get(id).parents.map(level)))
    return levels.get(id)
  }
  const columns = new Map()
  const positions = new Map([[ROOT, { x: 0, y: 0 }]])
  for (const node of nodes) {
    const column = level(node.id)
    if (!columns.has(column)) columns.set(column, [])
    columns.get(column).push(node)
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
      const group = columns.get(column) ?? []
      const columnX = row % 2 === 0 ? offset : columnsPerRow - 1 - offset
      height = Math.max(height, group.length * (CARD_H + GAP_Y) - GAP_Y)
      group.forEach((node, index) => positions.set(node.id, node.position ?? {
        x: columnX * (CARD_W + GAP_X),
        y: rowY + index * (CARD_H + GAP_Y),
      }))
    }
    rowY += height + 100
  }
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
  const after = nodes.filter(next => ancestors(next.id, nodes).has(node.id))
  const stepName = item => item.detail ? item.title + '（' + item.detail + '）' : item.title
  const stepList = items => items.map(item => '- ' + stepName(item)).join('\n')
  const editedDependencies = [node, ...after].flatMap(item => {
    const parents = item.parents.map(id => nodes.find(candidate => candidate.id === id)).filter(Boolean)
    return parents.length ? ['- ' + item.title + ' ← ' + parents.map(parent => parent.title).join('、')] : []
  })
  return [
    '【任务地图 Guide】',
    node.source ? '目标步骤：' + stepName(node) : '引导对象：以下步骤',
    node.source && node.title !== node.sourceTitle ? 'DeepSeek 原待办：' + node.sourceTitle : '',
    approval && before.size > Number(before.has(ROOT))
      ? '我认可以下上游步骤及已完成的成果。保留已有成果，尚未完成的前置步骤请按原计划完成。\n'
        + stepList(nodes.filter(item => before.has(item.id)))
      : '',
    guide ? '我的引导：\n' + guide : '',
    after.length ? '下游步骤：\n' + stepList(after) : '',
    editedDependencies.length ? '地图中的前置依赖：\n' + editedDependencies.join('\n') : '',
    node.source
      ? '把这条 Guide 应用于目标步骤及其下游。结合当前执行状态继续任务，并同步更新待办的步骤与状态。'
      : '把这条 Guide 应用于下面的步骤。结合当前执行状态继续任务，并同步更新待办的步骤与状态。',
  ].filter(Boolean).join('\n\n')
}
