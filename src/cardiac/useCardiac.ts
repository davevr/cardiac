import { useEffect, useMemo, useReducer } from 'react'
import { createMachine, poke, step, toCell, type Machine } from './core'

const HISTORY_LIMIT = 2000

interface State {
  machine: Machine
  /** Snapshot restored by Reset: the machine as last loaded. */
  loaded: Machine
  history: Machine[]
  running: boolean
  /** Instructions per second. */
  speed: number
}

type Action =
  | { type: 'step' }
  | { type: 'tick'; count: number }
  | { type: 'back' }
  | { type: 'run' }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'clear' }
  | { type: 'speed'; speed: number }
  | { type: 'load'; cells: Map<number, number>; start: number; input: number[] }
  | { type: 'loadDeck'; deck: number[] }
  | { type: 'setCell'; addr: number; value: number }
  | { type: 'setPc'; addr: number }
  | { type: 'setAcc'; value: number }
  | { type: 'setInput'; cards: number[] }
  | { type: 'clearOutput' }

function advance(state: State, count: number): State {
  let machine = state.machine
  const history = state.history.slice()
  let running = state.running
  for (let i = 0; i < count; i++) {
    const next = step(machine)
    history.push(machine)
    machine = next
    if (machine.status !== 'ready') {
      running = false
      break
    }
  }
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT)
  return { ...state, machine, history, running }
}

/** Apply a hand edit: keeps history so it can be undone with Back. */
function edit(state: State, machine: Machine): State {
  if (machine === state.machine) return state
  return { ...state, machine: { ...machine, trace: null }, history: [...state.history, state.machine].slice(-HISTORY_LIMIT) }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'step':
      return advance({ ...state, running: false }, 1)
    case 'tick':
      return state.running ? advance(state, action.count) : state
    case 'back': {
      if (state.history.length === 0) return state
      const history = state.history.slice()
      const machine = history.pop()!
      return { ...state, machine, history, running: false }
    }
    case 'run':
      return { ...state, running: true }
    case 'stop':
      return { ...state, running: false }
    case 'reset':
      return { ...state, machine: state.loaded, history: [], running: false }
    case 'clear': {
      const machine = createMachine()
      return { ...state, machine, loaded: machine, history: [], running: false }
    }
    case 'speed':
      return { ...state, speed: action.speed }
    case 'load': {
      let machine = createMachine()
      for (const [addr, value] of action.cells) machine = poke(machine, addr, value)
      machine = { ...machine, pc: action.start, input: action.input }
      return { ...state, machine, loaded: machine, history: [], running: false }
    }
    case 'loadDeck': {
      const machine = { ...createMachine(), input: action.deck }
      return { ...state, machine, loaded: machine, history: [], running: false }
    }
    case 'setCell':
      return edit(state, poke(state.machine, action.addr, action.value))
    case 'setPc':
      return edit(state, { ...state.machine, pc: action.addr, status: 'ready' })
    case 'setAcc': {
      const mag = Math.abs(Math.trunc(action.value)) % 10000
      return edit(state, { ...state.machine, acc: action.value < 0 ? -mag : mag })
    }
    case 'setInput': {
      // Keep the cards already read; replace what is still waiting on the strip.
      const read = state.machine.input.slice(0, state.machine.inputPos)
      const machine: Machine = { ...state.machine, input: [...read, ...action.cards.map(toCell)] }
      return edit(state, machine)
    }
    case 'clearOutput':
      return edit(state, { ...state.machine, output: [] })
  }
}

export function useCardiac() {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const machine = createMachine()
    return { machine, loaded: machine, history: [], running: false, speed: 4 }
  })

  useEffect(() => {
    if (!state.running) return
    // Above ~30 steps/s, batch several instructions per timer tick.
    const perTick = Math.max(1, Math.round(state.speed / 30))
    const interval = Math.max(1000 / state.speed, 1000 / 30)
    const id = setInterval(() => dispatch({ type: 'tick', count: perTick }), interval)
    return () => clearInterval(id)
  }, [state.running, state.speed])

  const actions = useMemo(
    () => ({
      step: () => dispatch({ type: 'step' }),
      back: () => dispatch({ type: 'back' }),
      run: () => dispatch({ type: 'run' }),
      stop: () => dispatch({ type: 'stop' }),
      reset: () => dispatch({ type: 'reset' }),
      clear: () => dispatch({ type: 'clear' }),
      setSpeed: (speed: number) => dispatch({ type: 'speed', speed }),
      load: (cells: Map<number, number>, start: number, input: number[]) =>
        dispatch({ type: 'load', cells, start, input }),
      loadDeck: (deck: number[]) => dispatch({ type: 'loadDeck', deck }),
      setCell: (addr: number, value: number) => dispatch({ type: 'setCell', addr, value }),
      setPc: (addr: number) => dispatch({ type: 'setPc', addr }),
      setAcc: (value: number) => dispatch({ type: 'setAcc', value }),
      setInput: (cards: number[]) => dispatch({ type: 'setInput', cards }),
      clearOutput: () => dispatch({ type: 'clearOutput' }),
    }),
    [],
  )

  return { ...state, canGoBack: state.history.length > 0, actions }
}

export type Cardiac = ReturnType<typeof useCardiac>
