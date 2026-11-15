window.__ModuleLoader__.load({
  id: 'dsh-task-map',
  factory(require) {
    const { createElement: h, useEffect, useLayoutEffect, useMemo, useRef, useState } = require('react')
  /* GRAPH */

    const css = /* CSS */ null
    const buildStamp = /* BUILD */ null
    const locales = /* LOCALES */ null
    const glyphs = {
      map: 'M4 5h5v5H4zM15 3h5v5h-5zM15 16h5v5h-5zM9 7.5h3v11h3M12 5.5h3',
      plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
      fit: 'M9 4H4v5m11-5h5v5m0 6v5h-5M4 15v5h5',
      grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
      check: 'm5 12 4 4L19 6', active: 'M12 3a9 9 0 1 1-9 9m9-5v5l3 2',
      pending: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
      guide: 'M4 4h16v12H10l-6 4zM8 9h8m-8 3h5',
      arrow: 'M5 12h14m-6-6 6 6-6 6', close: 'm6 6 12 12M18 6 6 18',
      layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
      refresh: 'M20 7v5h-5M4 17v-5h5M20 12a8 8 0 0 0-14-5m-2 5a8 8 0 0 0 14 5',
      square: 'M4 4h16v16H4zM9 9h6v6H9z',
      image: 'M4 5h16v14H4zM4 15l4.5-4.5 3.5 3.5 3-3L20 15M15.5 9.5h.01',
      target: 'M12 3v3.2m0 11.6V21M3 12h3.2m11.6 0H21M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z',
    }
    const icons = (name, size = 16) => h('svg', {
      viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round',
    }, h('path', { d: glyphs[name] }))
    const number = value => new Intl.NumberFormat('zh-CN').format(value)
    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    function readImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('无法读取图片：' + (file.name || '')))
        reader.onload = () => {
          const source = String(reader.result)
          resolve({
            id: globalThis.crypto.randomUUID(), name: file.name || '图片', mediaType: file.type,
            data: source.slice(source.indexOf(',') + 1), previewUrl: source,
          })
        }
        reader.readAsDataURL(file)
      })
    }
    const statusLabels = { pending: '待开始', in_progress: '进行中', completed: '已完成' }
    const statusIcons = { pending: 'pending', in_progress: 'active', completed: 'check' }
    const EMPTY_PLAN = { task: null, plan: null }
    const EMPTY_TODOS = []
    function missionEdges(groups) {
      const edges = []
      groups.forEach((group, index) => {
        const words = (group.refs ?? []).some(ref => ref.kind === 'word')
        for (let back = index - 1; back >= 0; back--) {
          const previous = groups[back].refs ?? []
          const hits = (group.refs ?? []).filter(ref => previous.some(other => other.text.toLowerCase() === ref.text.toLowerCase()))
          if (hits.length || (words && back === index - 1)) {
            edges.push({ from: groups[back].key, to: group.key, back, index, hits })
            break
          }
        }
      })
      return edges
    }

    function Action({ icon, label, text, className = '', ...props }) {
      return h('button', {
        ...props, type: 'button', className: 'tm-button ' + className,
        'aria-label': label, title: label,
      }, icon && icons(icon), text)
    }

    function Usage({ usage }) {
      const input = usage ? usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens : 0
      const output = usage?.outputTokens ?? 0
      return h('details', { className: 'tm-usage' },
        h('summary', { title: '查看会话 token 用量' }, icons('layers'),
          h('span', null, usage ? number(input + output) : '—'), h('small', null, 'tokens')),
        h('div', { className: 'tm-usage-pop' },
          h('strong', null, '会话累计用量'),
          usage ? h('dl', null,
            h('dt', null, '输入（含缓存）'), h('dd', null, number(input)),
            h('dt', null, '输出'), h('dd', null, number(output)),
            h('dt', null, '缓存读取'), h('dd', null, number(usage.cacheReadTokens)),
            h('dt', null, '缓存写入'), h('dd', null, number(usage.cacheWriteTokens)),
          ) : h('p', null, '—'),
          h('small', { className: 'tm-build' }, 'build ' + buildStamp)))
    }

    function Canvas({ nodes, title, selected, select, add, connect, move, remove, onBlank, openGuide, running, activeId, edges = [], currentKey, focus, setFocus }) {
      const viewport = useRef(null)
      const gesture = useRef(null)
      const ignoreClick = useRef(false)
      const spaceHeld = useRef(false)
      const manual = useRef(false)
      const [view, setView] = useState({ x: 30, y: 100, zoom: 0.8 })
      const [drag, setDrag] = useState(null)
      const [push, setPush] = useState(null)
      const [link, setLink] = useState(null)
      const visible = useMemo(() => focus ? focusOnly(nodes, focus) : nodes, [nodes, focus])
      const positions = useMemo(() => focus ? focusLayout(visible, focus) : layout(visible), [visible, focus])
      const bounds = useMemo(() => {
        const points = [...positions.values()]
        if (!points.length) return { left: 0, top: 0, right: CARD_W, bottom: CARD_H }
        return {
          left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)),
          right: Math.max(...points.map(p => p.x)) + CARD_W,
          bottom: Math.max(...points.map(p => p.y)) + CARD_H + 24,
        }
      }, [positions])
      const upper = useMemo(() => ancestors(selected, nodes), [selected, nodes])
      const next = useMemo(() => new Set(nodes.filter(node => node.parents.includes(selected)).map(node => node.id)), [selected, nodes])
      const focusPath = new Set([...upper, ...next, selected])
      const approved = new Set(nodes.flatMap(node => node.guides.flatMap(item => item.approvedIds ?? [])))
      const rootIds = useMemo(() => new Set(nodes.filter(node => node.root).map(node => node.id)), [nodes])

      function fit(minZoom = 0.15) {
        const box = viewport.current
        if (!box) return
        const width = bounds.right - bounds.left
        const height = bounds.bottom - bounds.top
        const factor = (box.clientWidth - 80) / width
        const zoom = Math.min(1, Math.max(minZoom, Math.min(factor, (box.clientHeight - 130) / height)))
        setView({
          zoom,
          x: Math.max(28, (box.clientWidth - width * zoom) / 2) - bounds.left * zoom,
          y: Math.max(46, (box.clientHeight - height * zoom) / 2 - 12) - bounds.top * zoom,
        })
      }
      function focusMission(key) {
        const spot = positions.get('root:' + key)
        const box = viewport.current
        if (!spot || !box) return
        setView(current => ({
          ...current,
          x: box.clientWidth / 2 - (spot.x + CARD_W / 2) * current.zoom,
          y: box.clientHeight / 2 - (spot.y + CARD_H / 2) * current.zoom,
        }))
      }
      useLayoutEffect(() => {
        if (!manual.current) fit(visible.filter(node => node.root).length === 1 ? 0.75 : 0.15)
        const watcher = new ResizeObserver(() => { if (!manual.current) fit() })
        watcher.observe(viewport.current)
        return () => watcher.disconnect()
      }, [bounds])

      function locate() {
        const cards = nodes.filter(node => !node.root)
        const target = (running && cards.find(node => node.id === activeId))
          || [...cards].reverse().find(node => node.status === 'in_progress')
          || [...cards].reverse()[0]
        const box = viewport.current
        if (!target || !box) return
        manual.current = true
        select(target.id)
        setFocus(target.id)
        setView({ zoom: 1, x: box.clientWidth / 2, y: box.clientHeight / 2 })
      }

      function zoomBy(factor, clientX, clientY) {
        const box = viewport.current.getBoundingClientRect()
        const x = clientX === undefined ? box.width / 2 : clientX - box.left
        const y = clientY === undefined ? box.height / 2 : clientY - box.top
        manual.current = true
        setView(current => {
          const zoom = Math.max(0.15, Math.min(1.8, current.zoom * factor))
          const ratio = zoom / current.zoom
          return { zoom, x: x - (x - current.x) * ratio, y: y - (y - current.y) * ratio }
        })
      }
      useEffect(() => {
        const box = viewport.current
        function wheel(event) {
          if (event.target.closest('.tm-dock')) return
          event.preventDefault()
          if (event.ctrlKey || event.metaKey) {
            zoomBy(Math.exp(-event.deltaY * 0.008), event.clientX, event.clientY)
          } else {
            manual.current = true
            setView(current => ({ ...current, x: current.x - (event.shiftKey ? event.deltaY : event.deltaX),
              y: current.y - (event.shiftKey ? 0 : event.deltaY) }))
          }
        }
        box.addEventListener('wheel', wheel, { passive: false })
        return () => box.removeEventListener('wheel', wheel)
      }, [])

      function start(event, id) {
        if (event.button !== 0 && event.button !== 1) return
        if (id && (spaceHeld.current || event.button === 1)) id = null
        if (!id && event.target.closest('button') && !spaceHeld.current && event.button !== 1) return
        const from = id ? positions.get(id) : view
        gesture.current = { id, x: event.clientX, y: event.clientY, from, moved: false }
        ignoreClick.current = false
        if (!id) viewport.current.setPointerCapture(event.pointerId)
      }

      function point(event, current) {
        const scale = current.id ? view.zoom : 1
        return {
          x: current.from.x + (event.clientX - current.x) / scale,
          y: current.from.y + (event.clientY - current.y) / scale,
        }
      }

      function shift(event) {
        const current = gesture.current
        if (!current) return
        if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return
        if (!current.moved) {
          current.moved = true
          manual.current = true
          viewport.current.setPointerCapture(event.pointerId)
        }
        const position = point(event, current)
        if (current.id) {
          setDrag({ id: current.id, position })
          setPush(repel(current.id, position))
        } else setView(value => ({ ...value, ...position }))
      }

      function release(event, cancelled = false) {
        const current = gesture.current
        if (!current) return
        gesture.current = null
        ignoreClick.current = current.moved
        setDrag(null)
        setPush(null)
        if (!cancelled && current.id && current.moved) {
          move(current.id, point(event, current))
          if (push) for (const [id, position] of push) move(id, position)
        }
        if (!cancelled && !current.id && !current.moved && !event.target.closest('button')) onBlank()
      }

      function keyboard(event) {
        if (event.key === ' ') spaceHeld.current = true
        if (event.key === 'Escape') onBlank()
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const id = event.target.dataset?.node
          const target = id && nodes.find(item => item.id === id)
          if (target && !target.root && !target.source) {
            event.preventDefault()
            remove(id)
          }
        }
        const direction = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key]
        if (!direction) return
        event.preventDefault()
        manual.current = true
        const id = event.target.dataset.node
        if (id && !rootIds.has(id)) {
          const pos = positions.get(id)
          move(id, { x: pos.x + direction[0] * 16, y: pos.y + direction[1] * 16 })
          return
        }
        setView(v => ({ ...v, x: v.x - direction[0] * 64, y: v.y - direction[1] * 64 }))
      }
      const positionOf = id => drag?.id === id ? drag.position : (push?.get(id) ?? positions.get(id))
      // 拖一张卡经过别人时，把挡路的卡沿最短方向实时推开（等价 topic-explorer 的 repelCards 阻尼推挤）。
      function repel(draggedId, spot) {
        const place = new Map()
        for (const [id, position] of positions) if (id !== draggedId) place.set(id, { ...position })
        const gap = 18
        for (let round = 0; round < 4; round++) {
          let moved = false
          for (const position of place.values()) {
            const dx = (position.x + CARD_W / 2) - (spot.x + CARD_W / 2)
            const dy = (position.y + CARD_H / 2) - (spot.y + CARD_H / 2)
            const overlapX = CARD_W + gap - Math.abs(dx)
            const overlapY = CARD_H + gap - Math.abs(dy)
            if (overlapX <= 0 || overlapY <= 0) continue
            moved = true
            if (overlapX < overlapY) position.x += (dx > 0 ? 1 : -1) * overlapX
            else position.y += (dy > 0 ? 1 : -1) * overlapY
          }
          if (!moved) break
        }
        const result = new Map()
        for (const [id, position] of place) {
          const base = positions.get(id)
          if (Math.abs(position.x - base.x) > 0.5 || Math.abs(position.y - base.y) > 0.5) result.set(id, position)
        }
        return result.size ? result : null
      }
      function worldPoint(event) {
        const box = viewport.current.getBoundingClientRect()
        return {
          x: (event.clientX - box.left - view.x) / view.zoom,
          y: (event.clientY - box.top - view.y) / view.zoom,
        }
      }
      function startLink(event, id) {
        if (event.button !== 0) return
        event.stopPropagation()
        event.preventDefault()
        viewport.current.setPointerCapture(event.pointerId)
        setLink({ from: id, ...worldPoint(event) })
      }
      function moveLink(event) {
        if (!link) return
        const at = worldPoint(event)
        setLink(current => current && { ...current, x: at.x, y: at.y })
      }
      function endLink(event) {
        if (!link) return
        const at = worldPoint(event)
        const target = nodes.find(item => {
          if (item.root) return false
          const spot = positionOf(item.id)
          return spot && at.x >= spot.x && at.x <= spot.x + CARD_W && at.y >= spot.y && at.y <= spot.y + CARD_H
        })
        const from = link.from
        setLink(null)
        if (target && target.id !== from) connect(from, target.id)
      }

      return h('div', {
        ref: viewport, className: 'tm-stage', tabIndex: 0, 'aria-label': '任务节点画布',
        onPointerDown: event => start(event, null),
        onPointerMove: event => { shift(event); moveLink(event) },
        onPointerUp: event => { if (link) { endLink(event); return } release(event) },
        onPointerCancel: event => { setLink(null); release(event, true) },
        onLostPointerCapture: event => release(event, true),
        onKeyDown: keyboard, onKeyUp: event => { if (event.key === ' ') spaceHeld.current = false },
        onBlur: () => { spaceHeld.current = false },
        style: { backgroundPosition: view.x + 'px ' + view.y + 'px',
          backgroundSize: (22 * view.zoom) + 'px ' + (22 * view.zoom) + 'px' },
      },
      h('div', { className: 'tm-world', style: { transform: 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')' } },
        h('svg', { className: 'tm-edges', 'aria-hidden': true },
          visible.flatMap(node => node.parents.map(parent => {
            const a = positionOf(parent), b = positionOf(node.id)
            const ax = a.x + CARD_W / 2, ay = a.y + CARD_H / 2
            const bx = b.x + CARD_W / 2, by = b.y + CARD_H / 2
            const dx = bx - ax, dy = by - ay
            const length = Math.hypot(dx, dy) || 1
            const ux = dx / length, uy = dy / length
            const reach = Math.min(CARD_W / 2 / Math.max(Math.abs(ux), 0.0001), CARD_H / 2 / Math.max(Math.abs(uy), 0.0001))
            const x1 = ax + ux * reach, y1 = ay + uy * reach
            const x2 = bx - ux * reach, y2 = by - uy * reach
            const span = Math.max(1, length - reach * 2)
            const bow = Math.min(64, span * 0.16)
            const nx = -uy, ny = ux
            const c1x = x1 + (x2 - x1) * 0.35 + nx * bow, c1y = y1 + (y2 - y1) * 0.35 + ny * bow
            const c2x = x1 + (x2 - x1) * 0.65 + nx * bow, c2y = y1 + (y2 - y1) * 0.65 + ny * bow
            const active = selected && upper.has(parent) && (upper.has(node.id) || node.id === selected)
              || selected === parent
            const path = 'M' + x1 + ' ' + y1 + 'C' + c1x + ' ' + c1y + ' ' + c2x + ' ' + c2y + ' ' + x2 + ' ' + y2
            const angle = Math.atan2(uy, ux) * 180 / Math.PI
            return h('g', { key: JSON.stringify([parent, node.id]), 'data-path': active ? 'active' : undefined },
              h('path', { d: path }),
              h('path', { className: 'tm-arrow', d: 'M-7 -3.6 L0 0 L-7 3.6', transform: 'translate(' + x2 + ' ' + y2 + ') rotate(' + angle + ')' }))
          })),
          edges.map(edge => {
            const from = positions.get('root:' + edge.from), to = positions.get('root:' + edge.to)
            if (!from || !to) return null
            const x1 = from.x + CARD_W / 2, y1 = from.y + CARD_H
            const x2 = to.x + CARD_W / 2, y2 = to.y
            const bulge = Math.max(36, Math.abs(y2 - y1) * 0.42)
            const label = '任务 ' + String(edge.back + 1).padStart(2, '0') + ' → 任务 ' + String(edge.index + 1).padStart(2, '0')
              + (edge.hits.length ? '\n共同引用：' + edge.hits.map(ref => ref.text).join('、') : '\n承接上一段')
            return h('path', {
              key: 'ref-' + edge.from + '-' + edge.to, className: 'tm-mission-link',
              d: 'M' + x1 + ' ' + y1 + 'C' + (x1 + bulge) + ' ' + y1 + ' ' + (x2 + bulge) + ' ' + y2 + ' ' + x2 + ' ' + y2,
            }, h('title', null, label))
          }),
          visible.filter(node => node.root).map((root, at, list) => {
            const next = list[at + 1]
            if (!next) return null
            const from = positions.get(root.id)
            const to = positions.get(next.id)
            if (!from || !to) return null
            let bottom = from.y + CARD_H
            for (const node of visible) {
              if (node.root || node.group !== root.group) continue
              const spot = positions.get(node.id)
              if (spot) bottom = Math.max(bottom, spot.y + CARD_H)
            }
            const x = from.x + CARD_W / 2
            const y1 = bottom + 12
            const y2 = to.y - 14
            if (y2 <= y1) return null
            return h('g', { key: 'band-' + root.key + '-' + next.key },
              h('path', { className: 'tm-band-link', d: 'M' + x + ' ' + y1 + 'L' + x + ' ' + (y2 - 7) }),
              h('path', { className: 'tm-band-link', d: 'M-5.5 -7 L0 0 L5.5 -7', transform: 'translate(' + x + ' ' + y2 + ')' }))
          }),
          link && h('path', { className: 'tm-link', d: 'M' + (positionOf(link.from).x + CARD_W) + ' ' + (positionOf(link.from).y + CARD_H / 2)
            + 'L' + link.x + ' ' + link.y })),
        visible.map(node => {
          const root = node.root === true
          const index = node.order ?? 0
          const p = positionOf(node.id)
          const current = selected === node.id
          const live = !root && running && activeId === node.id
          return h('div', { className: 'tm-node', key: node.id, style: { left: p.x, top: p.y },
            'data-root': root || undefined, 'data-current': root && node.key === currentKey || undefined,
            'data-status': node.status, 'data-live': live || undefined,
            'data-selected': current || undefined,
            'data-dragging': drag?.id === node.id || undefined,
            'data-muted': !root && selected && !focusPath.has(node.id) || undefined },
          !root && h('span', {
            className: 'tm-port', role: 'button', title: '拖到另一个方块，建立连接',
            'aria-label': '从「' + node.title + '」连接',
            onPointerDown: event => startLink(event, node.id),
          }),
          !root && !node.source && h('button', {
            type: 'button', className: 'tm-card-delete', title: '删除这个方块',
            'aria-label': '删除「' + node.title + '」',
            onPointerDown: event => { event.stopPropagation(); event.preventDefault() },
            onClick: event => { event.stopPropagation(); remove(node.id) },
          }, icons('close', 11)),
          h('button', {
            type: 'button', className: 'tm-card', title: node.title, 'data-node': node.id,
            'aria-pressed': current, onPointerDown: event => { if (!root) { event.stopPropagation(); start(event, node.id) } },
            onClick: () => { if (!ignoreClick.current && !root) select(node.id); ignoreClick.current = false },
            onDoubleClick: () => openGuide(node.id),
          },
          h('span', { className: 'tm-card-top' },
            h('span', { className: 'tm-kind' }, root ? icons('map', 17) :
              h('span', { className: 'tm-card-no' }, String(index).padStart(2, '0'))),
            root ? '任务 ' + String(index).padStart(2, '0') + (node.key === currentKey ? ' · 当前' : '')
              : live ? '回答中' : node.source ? statusLabels[node.status] : '手动步骤',
            !root && (live || node.status === 'in_progress') && h('span', { className: 'tm-live', 'aria-label': live ? '正在回答' : '进行中' }),
            !root && icons('grip', 15)),
          h('span', { className: 'tm-card-title' }, node.title),
          !root && h('span', { className: 'tm-card-foot' },
            icons(approved.has(node.id) ? 'check' : node.guides.length ? 'guide' : statusIcons[node.status], 14),
            approved.has(node.id) && h('span', null, '已认可'),
            approved.has(node.id) && node.guides.length > 0 && h('span', null, '·'),
            node.guides.length ? node.guides.length + ' 条 Guide' : null)),
          root && edges.some(edge => edge.to === node.key) && h('div', { className: 'tm-ref-row' },
            edges.filter(edge => edge.to === node.key).map(edge => h('span', {
              key: 'ref-' + edge.from, className: 'tm-ref-chip', role: 'button', tabIndex: 0,
              title: edge.hits.length ? '共同引用：' + edge.hits.map(ref => ref.text).join('、') : '承接上一段',
              onPointerDown: event => event.stopPropagation(),
              onClick: event => { event.stopPropagation(); focusMission(edge.from) },
            }, '↩ 任务 ' + String(edge.back + 1).padStart(2, '0')))))
        })),
      h('div', { className: 'tm-dock', 'aria-label': '画布工具' },
        h(Action, { icon: 'minus', label: '缩小', onClick: () => zoomBy(1 / 1.2) }),
        h('span', { className: 'tm-zoom' }, Math.round(view.zoom * 100) + '%'),
        h(Action, { icon: 'plus', label: '放大', onClick: () => zoomBy(1.2) }),
        h('span', { className: 'tm-dock-divider' }),
        h('button', {
          type: 'button', className: 'tm-block-add', title: '添加方块',
          'aria-label': '在画布中央添加一个方块',
          onClick: () => add({
            x: (viewport.current.clientWidth / 2 - view.x) / view.zoom - CARD_W / 2,
            y: (viewport.current.clientHeight / 2 - view.y) / view.zoom - CARD_H / 2,
          }),
        }, icons('square', 18)),
        h('span', { className: 'tm-dock-divider' }),
        h('button', {
          type: 'button', className: 'tm-locate', title: '居中到进行中的卡片，并把相关卡片排到周围',
          'aria-label': '居中到进行中的卡片', 'data-active': focus ? true : undefined,
          onClick: locate,
        }, icons('target', 18)),
        focus && h('span', { className: 'tm-focus', title: '聚焦相关卡片，点「适配画布」返回全图' }, '聚焦'),
        h(Action, { icon: 'fit', label: '适配画布', onClick: () => { setFocus(null); manual.current = false; fit() } })))
    }

    function Inspector({ node, nodes, close, update, remove, sending, canSend, running, send, notification, guideFocus, autoComplete, onAutoComplete }) {
      const [guide, setGuide] = useState('')
      const [approval, setApproval] = useState(true)
      const [error, setError] = useState('')
      const [editing, setEditing] = useState(false)
      const [title, setTitle] = useState(node.title)
      const [detail, setDetail] = useState(node.detail)
      const [images, setImages] = useState([])
      const [reading, setReading] = useState(false)
      const guideRef = useRef(null)
      const fileRef = useRef(null)
      useEffect(() => {
        if (guideFocus) guideRef.current?.focus()
      }, [guideFocus])
      const rootIds = new Set(nodes.filter(item => item.root).map(item => item.id))
      const before = ancestors(node.id, nodes)
      const hasUpstream = [...before].some(id => !rootIds.has(id))
      const eligible = nodes.filter(item => !item.root && item.group === node.group && item.id !== node.id
        && !ancestors(item.id, nodes).has(node.id))

      function toggleParent(id) {
        const fallback = node.parents.find(parent => rootIds.has(parent)) ?? [...rootIds][0] ?? ROOT
        const other = node.parents.filter(parent => !rootIds.has(parent))
        const parents = other.includes(id) ? other.filter(parent => parent !== id) : [...other, id]
        update({ parents: parents.length ? parents : [fallback] })
      }

      function save(event) {
        event.preventDefault()
        if (!title.trim()) return
        update({ title: title.trim(), detail: detail.trim() })
        setEditing(false)
      }

      async function pick(event) {
        const files = Array.from(event.target.files ?? []).filter(file => IMAGE_TYPES.includes(file.type))
        event.target.value = ''
        if (!files.length) return
        setError('')
        setReading(true)
        try {
          const loaded = await Promise.all(files.slice(0, 4).map(readImage))
          setImages(current => [...current, ...loaded].slice(0, 4))
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : '图片读取失败。')
        } finally {
          setReading(false)
        }
      }

      async function submit(event) {
        event.preventDefault()
        setError('')
        try {
          await send({ node, approval: approval && hasUpstream, guide: guide.trim(), images })
          setGuide('')
          setImages([])
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Guide 发送失败，请重试。')
        }
      }

      return h('aside', { className: 'tm-inspector', 'aria-label': '步骤详情' },
        h('div', { className: 'tm-inspector-head' },
          h('span', null, '节点详情'),
          h(Action, { icon: 'close', label: '关闭节点详情', onClick: close })),
        h('div', { className: 'tm-node-meta' }, icons(statusIcons[node.status]),
          node.source ? statusLabels[node.status] : '手动步骤'),
        h('div', { className: 'tm-status-row', role: 'group', 'aria-label': '步骤状态' },
          ['pending', 'in_progress', 'completed'].map(value => h('button', {
            key: value, type: 'button', className: 'tm-status-chip', 'aria-pressed': node.status === value,
            onClick: () => update({ status: value, autoDone: false }),
          }, statusLabels[value]))),
        node.autoDone && h('div', { className: 'tm-auto' },
          h('span', null, '回答结束，已自动标完成'),
          h(Action, { text: '撤销', onClick: () => update({ status: undefined, autoDone: false }) })),
        h('label', { className: 'tm-auto-toggle' },
          h('input', { type: 'checkbox', checked: autoComplete,
            onChange: event => onAutoComplete(event.target.checked) }),
          '回答结束后自动标完成'),
        editing ? h('form', { className: 'tm-edit', onSubmit: save },
          h('label', null, '步骤标题', h('input', { autoFocus: true, value: title, required: true, maxLength: 240,
            onChange: e => setTitle(e.target.value) })),
          h('label', null, '步骤说明', h('textarea', { rows: 2, value: detail, maxLength: 1200,
            onChange: e => setDetail(e.target.value) })),
          h('div', { className: 'tm-form-actions' },
            h(Action, { text: '取消', onClick: () => { setTitle(node.title); setDetail(node.detail); setEditing(false) } }),
            h('button', { type: 'submit', className: 'tm-button tm-primary' }, '保存步骤')))
          : h('div', { className: 'tm-detail-title' },
            h('h3', null, node.title),
            node.detail && h('p', null, node.detail),
            h(Action, { className: 'tm-edit-link', text: '编辑步骤', onClick: () => setEditing(true) })),
        h('details', { className: 'tm-dependencies' },
          h('summary', null, '前置依赖', h('span', null, node.parents.some(parent => rootIds.has(parent)) ? '任务起点' : node.parents.length + ' 个节点')),
          h('div', { className: 'tm-parent-list' }, eligible.length
            ? eligible.map(item => h('label', { key: item.id },
              h('input', { type: 'checkbox', checked: node.parents.includes(item.id), onChange: () => toggleParent(item.id) }),
              h('span', null, item.title)))
            : null)),
        h('form', { className: 'tm-guide', onSubmit: submit },
          h('label', { className: 'tm-guide-label' }, icons('guide'), '添加 Guide'),
          h('textarea', { ref: guideRef, rows: 3, value: guide, maxLength: 4000, 'aria-label': '引导词',
            onChange: e => setGuide(e.target.value) }),
          h('div', { className: 'tm-media' },
            images.map(item => h('span', { className: 'tm-thumb', key: item.id },
              h('img', { src: item.previewUrl, alt: item.name }),
              h('button', { type: 'button', className: 'tm-thumb-remove', 'aria-label': '移除 ' + item.name,
                onClick: () => setImages(current => current.filter(image => image.id !== item.id)) }, icons('close', 11)))),
            h('button', { type: 'button', className: 'tm-media-add', disabled: reading || images.length >= 4,
              onClick: () => fileRef.current?.click() }, icons('image', 15), reading ? '读取中…' : '图片'),
            h('input', { ref: fileRef, type: 'file', accept: IMAGE_TYPES.join(','), multiple: true,
              className: 'tm-file', onChange: pick })),
          hasUpstream && h('label', { className: 'tm-approval' },
            h('input', { type: 'checkbox', checked: approval, onChange: e => setApproval(e.target.checked) }),
            h('span', null, '认可上游步骤')),
          h('button', { className: 'tm-button tm-primary tm-send', type: 'submit',
            disabled: sending || !canSend || !(guide.trim() || images.length || (approval && hasUpstream)) },
          sending ? '发送中…' : '发送 Guide', icons('arrow')),
          error && h('p', { className: 'tm-error', role: 'alert' }, error),
          notification && h('p', { className: 'tm-notice', role: 'status' }, notification)),
        node.guides.length > 0 && h('details', { className: 'tm-history' },
          h('summary', null, '已发送的 Guide', h('span', null, node.guides.length)),
          h('ol', null, node.guides.map(item => h('li', { key: item.id },
            item.approval && h('strong', null, '认可上游'),
            item.text && h('p', null, item.text))))),
        !node.root && !node.source && h(Action, { className: 'tm-remove', text: '删除方块', disabled: sending, onClick: remove }))
    }

    function Workbench({ sessionId, identity, groups, title, usage, running, canSend, sendPrompt, openChat }) {
      const storageKey = 'dsh-task-map:v1:' + sessionId + ':' + identity
      const [scope, setScope] = useState(() => (readEdits(storageKey).scope === 'all' ? 'all' : 'current'))
      const [focus, setFocus] = useState(null)
      const shown = scope === 'all' || groups.length < 2 ? groups : groups.slice(-1)
      const allTodos = shown.flatMap(group => Array.isArray(group.todos) ? group.todos : [])
      const [edits, setEdits] = useState(() => readEdits(storageKey))
      const editsRef = useRef(edits)
      const [selected, setSelected] = useState(() => {
        const latest = groups[groups.length - 1]
        if (!latest || !latest.todos?.length) return null
        return todoId(latest.key, (latest.todos.find(item => item.status === 'in_progress') ?? latest.todos[0]).content)
      })
      const [sending, setSending] = useState(false)
      const [note, setNote] = useState(null)
      const [guideFocus, setGuideFocus] = useState(null)
      const [requestError, setRequestError] = useState('')
      const [planRequested, setPlanRequested] = useState(false)
      const [active, setActive] = useState(null)
      const requestLock = useRef(false)
      const nodes = useMemo(() => makeGraph(shown, edits), [shown, edits])
      const edges = useMemo(() => missionEdges(shown), [shown])
      const activeRef = useRef(null)
      const nodesRef = useRef(nodes)
      const wasRunning = useRef(running)
      activeRef.current = active
      nodesRef.current = nodes
      useEffect(() => {
        const ended = wasRunning.current && !running
        wasRunning.current = running
        if (!ended || editsRef.current.autoComplete === false) return
        const current = shown[shown.length - 1]?.key
        const ids = new Set()
        for (const item of nodesRef.current) {
          if (item.root || item.status === 'completed') continue
          if (item.id === activeRef.current?.id || item.group === current && item.status === 'in_progress') ids.add(item.id)
        }
        if (!ids.size) return
        commit(previous => {
          const overrides = { ...previous.overrides }
          for (const id of ids) overrides[id] = { ...overrides[id], status: 'completed', autoDone: true }
          return { ...previous, overrides }
        })
      }, [running])
      const node = nodes.find(n => n.id === selected)
      const visibleSelection = node ? node.id : selected === ROOT ? ROOT : null
      const completed = allTodos.filter(item => item.status === 'completed').length

      function commit(edit) {
        const value = edit(editsRef.current)
        editsRef.current = value
        setEdits(value)
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value))
        } catch {
          // The current view can still be edited without persistent browser storage.
        }
      }

      function modify(id, value) {
        commit(previous => ({
          ...previous, overrides: { ...previous.overrides, [id]: { ...previous.overrides[id], ...value } },
        }))
      }

      function choose(id) {
        setGuideFocus(null)
        setSelected(id)
      }

      function add(position) {
        const id = 'manual:' + globalThis.crypto.randomUUID()
        const roots = nodes.filter(item => item.root)
        const fallback = roots.length ? roots[roots.length - 1].id : ROOT
        commit(previous => ({
          added: [...previous.added, { id, title: '新方块', group: roots.length ? roots[roots.length - 1].key : ROOT }],
          overrides: { ...previous.overrides, [id]: { parents: [fallback], ...(position ? { position } : {}) } },
        }))
        setSelected(id)
        setGuideFocus({ at: globalThis.crypto.randomUUID() })
      }

      function connect(from, to) {
        const target = nodes.find(item => item.id === to)
        if (!target || from === to) return
        if (ancestors(from, nodes).has(to)) return
        const parents = [...target.parents.filter(parent => parent !== from && !nodes.some(item => item.id === parent && item.root)), from]
        modify(to, { parents })
        setSelected(to)
      }

      function openGuide(id) {
        setSelected(id)
        setGuideFocus({ at: globalThis.crypto.randomUUID() })
      }

      function remove(id) {
        commit(previous => {
          const overrides = { ...previous.overrides }
          delete overrides[id]
          for (const key of Object.keys(overrides)) {
            if (overrides[key].parents?.includes(id)) {
              overrides[key] = { ...overrides[key], parents: overrides[key].parents.filter(parent => parent !== id) }
            }
          }
          return { added: previous.added.filter(item => item.id !== id), overrides }
        })
        setSelected(null)
      }

      async function submit(text, mode, images = []) {
        if (requestLock.current) throw new Error('上一条消息正在发送。')
        requestLock.current = true
        setSending(true)
        try {
          await sendPrompt(text, mode, images)
        } finally {
          requestLock.current = false
          setSending(false)
        }
      }

      async function sendGuide({ node: target, approval, guide, images = [] }) {
        setNote(null)
        await submit(guidePrompt({ node: target, nodes, approval, guide: guide || (images.length ? '见附图。' : '') }),
          running ? 'steer' : 'queue', images)
        commit(previous => {
          const last = previous.overrides[target.id]
          const approvedIds = approval ? [...ancestors(target.id, nodes)].filter(id => !nodes.some(item => item.id === id && item.root)) : []
          const entry = { id: globalThis.crypto.randomUUID(), text: guide, approval, approvedIds }
          const record = { ...last, guides: [...(last?.guides ?? []), entry] }
          return { ...previous, overrides: { ...previous.overrides, [target.id]: record } }
        })
        setNote({ id: target.id, text: '已发送' })
        setActive({ id: target.id, at: Date.now() })
      }

      async function requestPlan() {
        setRequestError('')
        try {
          await submit('【任务地图 规划】\n请将我当前的任务用 Harness 的 todo_write 工具拆解为具体步骤，记录真实完成状态。请先停在规划阶段，等我确认计划或发送 Guide 后再继续执行。', 'queue')
          setPlanRequested(true)
          setActive({ id: null, at: Date.now() })
        } catch (reason) {
          setRequestError(reason instanceof Error ? reason.message : '请求规划失败，请重试。')
        }
      }

      return h('section', { className: 'tm-shell', 'aria-label': '任务地图' },
        h('style', null, css),
        h('header', { className: 'tm-heading' },
          h('div', { className: 'tm-heading-main' },
            h('span', { className: 'tm-logo' }, icons('map', 22)),
            h('div', null, h('h2', null, '任务地图', running && h('span', { className: 'tm-live', 'aria-label': '正在运行' })),
              allTodos.length ? h('p', null, completed + ' / ' + allTodos.length) : null)),
          h('div', { className: 'tm-heading-actions' },
            groups.length > 1 && h('div', { className: 'tm-scope', role: 'group', 'aria-label': '显示范围' },
              h('button', { type: 'button', className: 'tm-scope-button', 'data-active': scope !== 'all' || undefined,
                onClick: () => { setFocus(null); setScope('current'); commit(previous => ({ ...previous, scope: 'current' })) } }, '当前'),
              h('button', { type: 'button', className: 'tm-scope-button', 'data-active': scope === 'all' || undefined,
                onClick: () => { setFocus(null); setScope('all'); commit(previous => ({ ...previous, scope: 'all' })) } }, '全部')),
            h(Usage, { usage }))),
        h('div', { className: 'tm-workbench' },
          h(Canvas, { key: 'canvas-' + scope, nodes, title, selected: visibleSelection, select: choose, add, connect, remove, openGuide, edges,
            currentKey: shown.length ? shown[shown.length - 1].key : undefined,
            running, activeId: active?.id, focus, setFocus,
            move: (id, position) => modify(id, { position }), onBlank: () => choose(null) }),
          node && h(Inspector, { key: node.id, node, nodes, running, sending, canSend, guideFocus,
            autoComplete: edits.autoComplete !== false,
            onAutoComplete: value => commit(previous => ({ ...previous, autoComplete: value })),
            close: () => choose(null), update: value => modify(node.id, value),
            remove: () => remove(node.id), send: sendGuide, notification: note?.id === node.id ? note.text : '' }),
          !node && h('aside', { className: 'tm-inspector tm-empty', 'aria-label': '任务概览' },
            h('div', { className: 'tm-inspector-head' }, h('span', null, '任务概览')),
            h('p', { className: 'tm-task-text' }, title),
            !allTodos.length && h('h3', null, planRequested ? '已请求规划' : '等待规划'),
            !allTodos.length && h(Action, { icon: 'refresh', text: sending ? '请求中…' : running ? 'DeepSeek 正在运行' : '请求规划',
              className: 'tm-primary', disabled: sending || running || !canSend, onClick: requestPlan }),
            requestError && h('p', { className: 'tm-error', role: 'alert' }, requestError),
            h(Action, { className: 'tm-back', text: '返回对话', onClick: openChat }))))
    }

    function TaskMapView({ useProjection, useSession, useAccess, sessionId, sendPrompt, openView }) {
      const projection = useProjection('dshTaskMap') ?? EMPTY_PLAN
      const canonicalTodos = useProjection('todos')
      const sessionTitle = useProjection('title')
      const usage = useProjection('tokenUsage')
      const running = useSession(s => s.running)
      const sessionReady = useSession(s => s.openState === 'open' && !s.removed && !s.subagent)
      const canSend = useAccess('session/prompt') !== false && sessionReady
      const missions = Array.isArray(projection.missions) ? projection.missions : []
      const groups = missions
        .filter(mission => Array.isArray(mission.todos) && mission.todos.length)
        .map((mission, at, list) => ({
          key: mission.key, title: mission.title, refs: mission.refs ?? [],
          todos: at === list.length - 1 ? mission.todos
            : mission.todos.map(todo => todo.status === 'in_progress' ? { ...todo, status: 'pending' } : todo),
        }))
      if (!groups.length) {
        const todos = Array.isArray(canonicalTodos) && canonicalTodos.length ? canonicalTodos : projection.plan?.todos ?? EMPTY_TODOS
        if (todos.length) groups.push({ key: projection.plan?.key ?? 'current', title: projection.task?.title ?? projection.plan?.title ?? '', todos, refs: [] })
      }
      const latest = missions[missions.length - 1]
      const title = latest?.title || projection.task?.title || projection.plan?.title
      return h(Workbench, {
        key: sessionId + ':history', sessionId, identity: 'history',
        groups, title: title || (typeof sessionTitle === 'string' ? sessionTitle : '') || '当前会话任务',
        usage, running, canSend,
        sendPrompt, openChat: () => openView('chat', ''),
      })
    }

    return {
      inject: ['slots', 'sessions', 'locale'],
      apply(ctx) {
        const namespace = 'dsh-task-map'
        ctx.effect(() => ctx.locale.register(namespace, locales))
        const t = ctx.locale.bind(namespace)
        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view', id: namespace, label: () => t('name'), order: 7, locale: namespace,
          inject: sessionId => ({
            async sendPrompt(text, mode, images = []) {
              const session = ctx.sessions.binding(sessionId)?.session
              if (!session || session.getSnapshot().removed) throw new Error('当前会话不可用。')
              const attachments = images.map(image => ({ type: 'image', value: { previewUrl: image.previewUrl, name: image.name } }))
              const submission = session.beginSubmission({ mode, text, attachments })
              const content = [{ type: 'text', text }, ...images.map(image => ({
                type: 'image', mediaType: image.mediaType, data: image.data, name: image.name,
              }))]
              try {
                const result = await session.prompt(content, mode, undefined, submission.requestId)
                if (!result.ok) throw new Error(result.error?.message || 'Harness 拒绝了这条消息。')
              } catch (error) {
                submission.abandon()
                throw error
              }
            },
          }),
        }, TaskMapView))
      },
    }
  },
})
