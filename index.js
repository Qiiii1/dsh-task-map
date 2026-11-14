import { initialPlan, projectPlan } from './src/plan.js'

export const name = 'dsh-task-map'
export const inject = ['sessionProjections']

function validTask(task) {
  return task === null || (typeof task?.key === 'string' && typeof task.title === 'string')
}

const schema = {
  parse(value) {
    if (!value || !validTask(value.task) || !validTask(value.plan)
      || (value.plan && (!Array.isArray(value.plan.todos) || value.plan.todos.some(
        item => typeof item?.content !== 'string' || !['pending', 'in_progress', 'completed'].includes(item.status),
      )))) {
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
