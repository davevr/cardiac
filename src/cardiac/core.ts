// CARDIAC machine core: pure, immutable state transitions.
//
// Cells hold a sign and three decimal digits (-999..999).
// The accumulator holds a sign and four decimal digits (-9999..9999).
// Cell 00 is permanently 001; cell 99 receives the return address on a jump.

export const MEM_SIZE = 100
export const CELL_MAX = 999
export const ACC_MOD = 10000

export type Status = 'ready' | 'halted'

export interface OpInfo {
  code: number
  mnemonic: string
  name: string
  /** Wording in the style of the card's instruction decoder. */
  describe: (addr: string) => string
}

export const OPS: OpInfo[] = [
  { code: 0, mnemonic: 'INP', name: 'Input', describe: (a) => `Move the input card into cell ${a}. Advance the input strip.` },
  { code: 1, mnemonic: 'CLA', name: 'Clear and add', describe: (a) => `Clear the accumulator. Add the contents of cell ${a} to it.` },
  { code: 2, mnemonic: 'ADD', name: 'Add', describe: (a) => `Add the contents of cell ${a} to the accumulator.` },
  { code: 3, mnemonic: 'TAC', name: 'Test accumulator contents', describe: (a) => `If the accumulator is negative, move the bug to cell ${a}.` },
  { code: 4, mnemonic: 'SFT', name: 'Shift', describe: (a) => `Shift the accumulator left ${a[0]} place(s), then right ${a[1]} place(s).` },
  { code: 5, mnemonic: 'OUT', name: 'Output', describe: (a) => `Copy the contents of cell ${a} onto the output card. Advance the output strip.` },
  { code: 6, mnemonic: 'STO', name: 'Store', describe: (a) => `Copy the accumulator into cell ${a}.` },
  { code: 7, mnemonic: 'SUB', name: 'Subtract', describe: (a) => `Subtract the contents of cell ${a} from the accumulator.` },
  { code: 8, mnemonic: 'JMP', name: 'Jump', describe: (a) => `Write the bug's cell number into cell 99. Move the bug to cell ${a}.` },
  { code: 9, mnemonic: 'HRS', name: 'Halt and reset', describe: (a) => `Move the bug to cell ${a}. Stop.` },
]

export interface Trace {
  /** Cell the instruction was fetched from. */
  at: number
  instruction: number
  op: number
  addr: number
  read?: number
  write?: number
  jumped?: boolean
  /** INP found no card: the machine took the "bug to cell 00, stop" exit. */
  blank?: boolean
  /** Accumulator before the instruction, and the word it was combined with. */
  accBefore?: number
  operand?: number
  text: string
}

export interface Machine {
  mem: readonly number[]
  acc: number
  /** The "bug": address of the next instruction. */
  pc: number
  /** Instruction register (the last instruction fetched). */
  ir: number
  input: readonly number[]
  /** Index of the next unread input card. */
  inputPos: number
  output: readonly number[]
  status: Status
  cycles: number
  trace: Trace | null
}

export const pad = (n: number, width: number) => String(Math.abs(n)).padStart(width, '0')
export const fmtCell = (n: number) => (n < 0 ? '-' : '') + pad(n, 3)
export const fmtAcc = (n: number) => (n < 0 ? '-' : '+') + pad(n, 4)
export const fmtAddr = (n: number) => pad(n, 2)

/** Clamp any integer into a legal cell value, keeping the low three digits. */
export function toCell(n: number): number {
  const mag = Math.abs(Math.trunc(n)) % 1000
  return n < 0 ? -mag : mag
}

function toAcc(n: number): number {
  const mag = Math.abs(n) % ACC_MOD
  return n < 0 ? -mag : mag
}

export function createMachine(): Machine {
  const mem = new Array<number>(MEM_SIZE).fill(0)
  mem[0] = 1
  mem[99] = 800 // the card has the "8" of a return jump pre-printed
  return {
    mem,
    acc: 0,
    pc: 0,
    ir: 0,
    input: [],
    inputPos: 0,
    output: [],
    status: 'ready',
    cycles: 0,
    trace: null,
  }
}

/** Write a cell, honouring the read-only cell 00. */
export function poke(m: Machine, addr: number, value: number): Machine {
  if (addr <= 0 || addr >= MEM_SIZE) return m
  const mem = m.mem.slice()
  mem[addr] = toCell(value)
  return { ...m, mem }
}

export function decode(instruction: number) {
  const mag = Math.abs(instruction)
  return { op: Math.floor(mag / 100), addr: mag % 100 }
}

export function disassemble(value: number): string {
  if (value < 0) return ''
  const { op, addr } = decode(value)
  return `${OPS[op].mnemonic} ${fmtAddr(addr)}`
}

/** Execute one full fetch/execute cycle. */
export function step(m: Machine): Machine {
  const at = m.pc
  const instruction = m.mem[at]
  const { op, addr } = decode(instruction)
  const a = fmtAddr(addr)
  const next = (at + 1) % MEM_SIZE
  const base = { at, instruction, op, addr }
  const done = (patch: Partial<Machine>, trace: Omit<Trace, keyof typeof base>): Machine => ({
    ...m,
    ir: instruction,
    pc: next,
    status: 'ready',
    cycles: m.cycles + 1,
    ...patch,
    trace: { ...base, ...trace },
  })
  const write = (address: number, value: number) => {
    if (address === 0) return m.mem // cell 00 is permanent
    const mem = m.mem.slice()
    mem[address] = toCell(value)
    return mem
  }

  // A negative word has no valid operation code; the real machine has no rule
  // for it, so we stop rather than guess.
  if (instruction < 0) {
    return {
      ...m,
      ir: instruction,
      status: 'halted',
      trace: { ...base, text: `Cell ${fmtAddr(at)} holds ${fmtCell(instruction)}, which is not an instruction. Stopped.` },
    }
  }

  switch (op) {
    case 0: {
      if (m.inputPos >= m.input.length) {
        // The card's rule for a blank input card: bug to cell 00, stop.
        return {
          ...m,
          ir: instruction,
          pc: 0,
          status: 'halted',
          cycles: m.cycles + 1,
          trace: { ...base, blank: true, jumped: true, text: `INP ${a}: the input card is blank. Bug to cell 00. Stopped.` },
        }
      }
      const card = m.input[m.inputPos]
      return done(
        { mem: write(addr, card), inputPos: m.inputPos + 1 },
        { write: addr, text: `INP ${a}: card ${fmtCell(card)} copied into cell ${a}.` },
      )
    }
    case 1:
      return done({ acc: m.mem[addr] }, { read: addr, text: `CLA ${a}: accumulator set to ${fmtCell(m.mem[addr])}.` })
    case 2: {
      const acc = toAcc(m.acc + m.mem[addr])
      return done({ acc }, { read: addr, accBefore: m.acc, operand: m.mem[addr], text: `ADD ${a}: ${fmtAcc(m.acc)} + ${fmtCell(m.mem[addr])} = ${fmtAcc(acc)}.` })
    }
    case 3: {
      const jump = m.acc < 0
      return done(jump ? { pc: addr } : {}, {
        jumped: jump,
        text: jump
          ? `TAC ${a}: accumulator is negative, bug moves to ${a}.`
          : `TAC ${a}: accumulator is not negative, continue.`,
      })
    }
    case 4: {
      const left = Math.floor(addr / 10)
      const right = addr % 10
      let mag = Math.abs(m.acc)
      mag = (mag * 10 ** left) % ACC_MOD
      mag = Math.floor(mag / 10 ** right)
      const acc = m.acc < 0 ? -mag : mag
      return done({ acc }, { text: `SFT ${a}: left ${left}, right ${right}: ${fmtAcc(m.acc)} becomes ${fmtAcc(acc)}.` })
    }
    case 5:
      return done(
        { output: [...m.output, m.mem[addr]] },
        { read: addr, text: `OUT ${a}: ${fmtCell(m.mem[addr])} written to the output card.` },
      )
    case 6: {
      const value = toCell(m.acc)
      return done(
        { mem: write(addr, value) },
        { write: addr, text: `STO ${a}: ${fmtCell(value)} stored in cell ${a}.` },
      )
    }
    case 7: {
      const acc = toAcc(m.acc - m.mem[addr])
      return done({ acc }, { read: addr, accBefore: m.acc, operand: m.mem[addr], text: `SUB ${a}: ${fmtAcc(m.acc)} − ${fmtCell(m.mem[addr])} = ${fmtAcc(acc)}.` })
    }
    case 8:
      return done(
        { mem: write(99, 800 + next), pc: addr },
        { write: 99, jumped: true, text: `JMP ${a}: 8${fmtAddr(next)} written to cell 99, bug moves to ${a}.` },
      )
    default:
      return done({ pc: addr, status: 'halted' }, { jumped: true, text: `HRS ${a}: bug reset to ${a}. Halted.` })
  }
}

/** Run until halt or the cycle limit. */
export function run(m: Machine, limit = 100000): Machine {
  let cur = m
  for (let i = 0; i < limit; i++) {
    cur = step(cur)
    if (cur.status !== 'ready') break
  }
  return cur
}
