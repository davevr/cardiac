import { describe, expect, it } from 'vitest'
import { assemble, bootstrapDeck, parseCards } from './assembler'
import { createMachine, poke, run, step, type Machine } from './core'
import { SAMPLES } from './samples'

function load(cells: Record<number, number>, pc: number, input: number[] = []): Machine {
  let m = createMachine()
  for (const [a, v] of Object.entries(cells)) m = poke(m, Number(a), v)
  return { ...m, pc, input }
}

describe('core', () => {
  it('keeps cell 00 permanently at 001', () => {
    const m = run(load({ 10: 600, 11: 900 }, 10))
    expect(m.mem[0]).toBe(1)
    expect(poke(m, 0, 5).mem[0]).toBe(1)
  })

  it('CLA/ADD/SUB/STO work and STO keeps the low three digits', () => {
    const m = run(load({ 10: 120, 11: 220, 12: 630, 13: 721, 14: 900, 20: 999, 21: 5 }, 10))
    expect(m.mem[30]).toBe(998) // 999 + 999 = 1998 -> 998
    expect(m.acc).toBe(1993)
  })

  it('accumulator drops overflow past four digits', () => {
    let m = load({ 10: 220, 11: 900, 20: 999 }, 10)
    m = { ...m, acc: 9500 }
    expect(run(m).acc).toBe(499)
  })

  it('SFT shifts left then right, losing digits off both ends', () => {
    const sft = (acc: number, xy: number) => step({ ...load({ 10: 400 + xy }, 10), acc }).acc
    expect(sft(1234, 10)).toBe(2340)
    expect(sft(1234, 1)).toBe(123)
    expect(sft(123, 33)).toBe(3)
    expect(sft(-1234, 21)).toBe(-340)
  })

  it('TAC jumps only when negative', () => {
    expect(step({ ...load({ 10: 350 }, 10), acc: -1 }).pc).toBe(50)
    expect(step({ ...load({ 10: 350 }, 10), acc: 0 }).pc).toBe(11)
  })

  it('JMP stores the return jump in cell 99', () => {
    const m = step(load({ 10: 850 }, 10))
    expect(m.pc).toBe(50)
    expect(m.mem[99]).toBe(811)
  })

  it('HRS resets the bug and halts', () => {
    const m = step(load({ 10: 925 }, 10))
    expect(m.pc).toBe(25)
    expect(m.status).toBe('halted')
  })

  it('INP on a blank card sends the bug to cell 00 and stops', () => {
    const m = step(load({ 10: 20, 11: 900 }, 10))
    expect(m.status).toBe('halted')
    expect(m.pc).toBe(0)
    expect(m.trace?.blank).toBe(true)
  })
})

describe('assembler', () => {
  it('resolves labels, ORG, DATA and START', () => {
    const r = assemble('ORG 20\nstart: CLA val\n JMP start\nval: DATA -7\nSTART start')
    expect(r.errors).toEqual([])
    expect([...r.cells]).toEqual([[20, 122], [21, 820], [22, -7]])
    expect(r.start).toBe(20)
  })

  it('reports errors with line numbers', () => {
    const r = assemble('CLA nowhere\nFOO 1\nDATA 1000')
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3])
  })

  it('parses cards', () => {
    expect(parseCards('1, -20  300 x 1000')).toEqual({ cards: [1, -20, 300], bad: ['x', '1000'] })
  })
})

describe('samples', () => {
  const expected: Record<string, number[]> = {
    add: [579],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    sumlist: [150],
    multiply: [408],
    reverse: [321],
    subroutine: [14, 42],
    countdown: [-3, -2, -1, 0],
    tictactoe: [9, 2, 4, 7, 5, 0],
  }

  for (const s of SAMPLES) {
    it(`${s.id} produces the expected output`, () => {
      const r = assemble(s.source)
      expect(r.errors).toEqual([])
      const m = run(load(Object.fromEntries(r.cells), r.start, parseCards(s.input).cards))
      expect(m.status).toBe('halted')
      expect(m.output).toEqual(expected[s.id])
    })

    it(`${s.id} loads itself from a bootstrap deck`, () => {
      const r = assemble(s.source)
      const deck = [...bootstrapDeck(r.cells, r.start), ...parseCards(s.input).cards]
      const m = run({ ...createMachine(), input: deck })
      expect(m.status).toBe('halted')
      expect(m.output).toEqual(expected[s.id])
    })
  }
})

describe('tic-tac-toe', () => {
  const LINES = [[1, 2, 3], [3, 4, 5], [5, 6, 7], [7, 8, 1], [1, 9, 5], [2, 9, 6], [3, 9, 7], [4, 9, 8]]
  const wins = (cells: Set<number>) => LINES.some((l) => l.every((c) => cells.has(c)))
  const r = assemble(SAMPLES.find((s) => s.id === 'tictactoe')!.source)
  let games = 0
  let machineWins = 0

  // Play every legal sequence of human moves against the program.
  function explore(human: number[]) {
    const m = run(load(Object.fromEntries(r.cells), r.start, human))
    const out = [...m.output]
    const marker = out.length > 0 && (out.at(-1) === 999 || out.at(-1) === 0) ? out.pop() : undefined
    const x = new Set<number>()
    const o = new Set<number>()
    out.forEach((move, i) => {
      expect(move >= 1 && move <= 9 && !x.has(move) && !o.has(move), `machine move ${move} after ${human}`).toBe(true)
      x.add(move)
      if (i < human.length && !(marker !== undefined && i === out.length - 1)) o.add(human[i])
      expect(wins(o), `human wins with ${human}`).toBe(false)
    })
    if (marker === 999) {
      expect(wins(x)).toBe(true)
      games++
      machineWins++
    } else if (marker === 0) {
      expect(x.size + o.size).toBe(9)
      expect(wins(x)).toBe(false)
      games++
    } else {
      expect(out.length).toBe(human.length + 1)
      for (let c = 1; c <= 9; c++) if (!x.has(c) && !o.has(c)) explore([...human, c])
    }
  }

  it('never loses, whatever the human plays', () => {
    expect(r.errors).toEqual([])
    explore([])
    expect(games).toBeGreaterThan(0)
    console.log(`tic-tac-toe: ${games} games, ${machineWins} machine wins, ${games - machineWins} draws, ${r.cells.size} cells`)
  })
})
