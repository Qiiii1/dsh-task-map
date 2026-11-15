import { initialPlan, projectPlan } from './src/plan.js'

export const name = 'dsh-task-map'
export const inject = ['sessionProjections']

function validTask(task) {
  return task === null || (typeof task?.key === 'string' && typeof task.title === 'string')
}

function validTodos(todos) {
  return Array.isArray(todos) && todos.every(item => typeof item?.content === 'string'
    && ['pending', 'in_progress', 'completed'].includes(item.status))
}

function validRefs(refs) {
  return refs === undefined || (Array.isArray(refs) && refs.every(ref => typeof ref?.kind === 'string' && typeof ref.text === 'string'))
}

function validMission(mission) {
  return typeof mission?.key === 'string' && typeof mission.title === 'string'
    && (mission.todos === null || validTodos(mission.todos)) && validRefs(mission.refs)
}

const schema = {
  parse(value) {
    if (!value || !validTask(value.task) || !validTask(value.plan)
      || (value.plan && !validTodos(value.plan.todos))
      || (value.missions !== undefined && (!Array.isArray(value.missions) || !value.missions.every(validMission)))) {
      throw new TypeError('Invalid task map projection')
    }
    return value
  },
}

export async function apply(ctx) {
  await ctx.sessionProjections.register({
    key: 'dshTaskMap',
    stateVersion: 1,
    stateSchema: schema,
    init: initialPlan,
    apply: projectPlan,
    wire: { viewSchema: schema, view: state => state, summary: true },
  })
}
