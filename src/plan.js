const MAX_MISSIONS = 12

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
    const mission = { key: 'user-' + event.seq, title, todos: null }
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
