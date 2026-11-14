export function initialPlan() {
  return { task: null, plan: null }
}

export function projectPlan(state, event) {
  if (event.type === 'user/message' && event.data.source?.kind === 'user') {
    const text = event.data.content.filter(block => block.type === 'text').map(block => block.text).join(' ').trim()
    if (text.startsWith('【任务地图 Guide】') || text.startsWith('【任务地图 规划】')) return state
    const title = Array.from(text.replace(/\s+/g, ' ')).slice(0, 140).join('')
    return { ...state, task: { key: 'user-' + event.seq, title } }
  }
  if (event.type === 'todo/write') {
    const task = state.task ?? state.plan ?? { key: 'todo-' + event.seq, title: '' }
    return { ...state, plan: { key: task.key, title: task.title, todos: event.data.todos } }
  }
  return state
}
