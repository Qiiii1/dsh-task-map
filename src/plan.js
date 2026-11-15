const MAX_MISSIONS = 12
const WORD_REF = /继续|接着|刚才|之前|上一步|上一段|前面|上面|沿用/gu

// 从用户消息里抽「可能是上下文引用」的线索：文件路径、引号引用、承接词。
function readRefs(text) {
  const refs = []
  const push = (kind, value) => {
    const clean = value.trim().replace(/[，。；、：；,.)）]+$/u, '')
    if (clean.length < 2 || clean.length > 80) return
    if (refs.length >= 10 || refs.some(ref => ref.text.toLowerCase() === clean.toLowerCase())) return
    refs.push({ kind, text: clean })
  }
  for (const match of text.matchAll(/(?:[A-Za-z0-9_.@-]+\/)+[A-Za-z0-9_.@-]*(?:\.[A-Za-z0-9]{1,8})?/gu)) push('path', match[0])
  for (const match of text.matchAll(/[A-Za-z0-9_-]+\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|json|md|markdown|py|yml|yaml|sh|toml|svg|png)\b/giu)) push('path', match[0])
  for (const match of text.matchAll(/「([^」]{2,60})」/gu)) push('quote', match[1])
  for (let index = refs.length - 1; index >= 0; index--) {
    const ref = refs[index]
    if (ref.kind !== 'path' || !refs.some(other => other !== ref && other.kind === 'path' && other.text.endsWith('/' + ref.text))) continue
    refs.splice(index, 1)
  }
  for (const match of text.matchAll(/“([^”]{2,60})”/gu)) push('quote', match[1])
  for (const match of text.matchAll(WORD_REF)) push('word', match[0])
  return refs
}

function readMissions(state) {
  if (Array.isArray(state.missions)) return state.missions
  if (state.plan) return [{ key: state.plan.key, title: state.plan.title ?? '', todos: state.plan.todos ?? null }]
  return []
}

export function initialPlan() {
  return { task: null, plan: null, missions: [] }
}

// 每段对话记一段 mission：user/message 开启新的一段，todo/write 填充或覆盖当前段的步骤。
export function projectPlan(state, event) {
  const missions = readMissions(state)
  if (event.type === 'user/message' && event.data.source?.kind === 'user') {
    const text = event.data.content.filter(block => block.type === 'text').map(block => block.text).join(' ').trim()
    if (text.startsWith('【任务地图 Guide】') || text.startsWith('【任务地图 规划】')) return state
    const title = Array.from(text.replace(/\s+/g, ' ')).slice(0, 140).join('')
    const mission = { key: 'user-' + event.seq, title, todos: null, refs: readRefs(text) }
    return { ...state, task: { key: mission.key, title }, missions: [...missions, mission].slice(-MAX_MISSIONS) }
  }
  if (event.type === 'todo/write') {
    const todos = event.data.todos
    const last = missions[missions.length - 1]
    if (last) {
      return {
        ...state, plan: { key: last.key, title: last.title, todos },
        missions: [...missions.slice(0, -1), { ...last, todos }],
      }
    }
    const plan = { key: 'todo-' + event.seq, title: '', todos }
    return { ...state, plan, missions: [{ key: plan.key, title: plan.title, todos }] }
  }
  return state
}
