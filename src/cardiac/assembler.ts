// A small assembler for CARDIAC.
//
//   ; comment
//   ORG 10              set the location counter
//   loop: CLA count     label, mnemonic, operand (number, label, label+n)
//         SFT 21        shift left 2, right 1
//   count: DATA 5       literal word (a bare number works too)
//   START loop          optional: where the bug starts

import { OPS, toCell } from './core'

export interface AsmError {
  line: number
  message: string
}

export interface ListingRow {
  line: number
  addr: number
  value: number
  source: string
}

export interface AsmResult {
  cells: Map<number, number>
  start: number
  listing: ListingRow[]
  labels: Map<string, number>
  errors: AsmError[]
}

const MNEMONICS = new Map(OPS.map((o) => [o.mnemonic, o.code]))
const DIRECTIVES = new Set(['ORG', 'DATA', 'DAT', 'START'])
const isKeyword = (t: string) => MNEMONICS.has(t.toUpperCase()) || DIRECTIVES.has(t.toUpperCase())
const NUMBER = /^[+-]?\d+$/
const LABEL = /^[A-Za-z_][A-Za-z0-9_]*$/

interface Stmt {
  line: number
  addr: number
  kind: 'op' | 'data'
  op: number
  operand: string
  source: string
}

export function assemble(source: string, defaultOrg = 10): AsmResult {
  const errors: AsmError[] = []
  const labels = new Map<string, number>()
  const stmts: Stmt[] = []
  let loc = defaultOrg
  let startExpr: { line: number; expr: string } | null = null

  const lines = source.split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = i + 1
    const text = raw.replace(/(;|#|\/\/).*$/, '').trim()
    if (!text) return
    let tokens = text.split(/\s+/)

    // Leading label: "name:", or a bare name directly followed by a keyword.
    let label: string | null = null
    if (tokens[0].endsWith(':')) {
      label = tokens[0].slice(0, -1)
      tokens = tokens.slice(1)
    } else if (!isKeyword(tokens[0]) && tokens.length > 1 && isKeyword(tokens[1])) {
      label = tokens[0]
      tokens = tokens.slice(1)
    }
    if (label !== null) {
      if (!LABEL.test(label)) errors.push({ line, message: `Bad label "${label}"` })
      else if (labels.has(label.toLowerCase())) errors.push({ line, message: `Label "${label}" is already defined` })
      else labels.set(label.toLowerCase(), loc)
    }
    if (tokens.length === 0) return

    const head = tokens[0].toUpperCase()
    const operand = tokens.slice(1).join('')
    const place = (kind: Stmt['kind'], op: number, opnd: string) => {
      if (loc > 99) {
        errors.push({ line, message: 'Program runs past cell 99' })
        return
      }
      if (loc === 0) errors.push({ line, message: 'Cell 00 is permanent and cannot be assembled into' })
      stmts.push({ line, addr: loc, kind, op, operand: opnd, source: raw.trim() })
      loc++
    }

    if (head === 'ORG') {
      if (!/^\d+$/.test(operand) || Number(operand) > 99) errors.push({ line, message: 'ORG needs an address 00-99' })
      else loc = Number(operand)
    } else if (head === 'START') {
      if (!operand) errors.push({ line, message: 'START needs an address or label' })
      else startExpr = { line, expr: operand }
    } else if (head === 'DATA' || head === 'DAT') {
      place('data', 0, operand || '0')
    } else if (NUMBER.test(tokens[0])) {
      if (tokens.length > 1) errors.push({ line, message: `Unexpected "${tokens[1]}"` })
      place('data', 0, tokens[0])
    } else if (MNEMONICS.has(head)) {
      if (!operand) errors.push({ line, message: `${head} needs an operand` })
      place('op', MNEMONICS.get(head)!, operand || '0')
    } else {
      errors.push({ line, message: `Unknown instruction "${tokens[0]}"` })
    }
  })

  const evaluate = (expr: string, line: number): number | null => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*|[+-]?\d+)(?:([+-])(\d+))?$/.exec(expr)
    if (!m) {
      errors.push({ line, message: `Cannot understand "${expr}"` })
      return null
    }
    let base: number
    if (NUMBER.test(m[1])) base = Number(m[1])
    else {
      const v = labels.get(m[1].toLowerCase())
      if (v === undefined) {
        errors.push({ line, message: `Undefined label "${m[1]}"` })
        return null
      }
      base = v
    }
    return m[2] ? base + (m[2] === '-' ? -1 : 1) * Number(m[3]) : base
  }

  const cells = new Map<number, number>()
  const listing: ListingRow[] = []
  for (const s of stmts) {
    const v = evaluate(s.operand, s.line)
    if (v === null) continue
    let value: number
    if (s.kind === 'data') {
      if (Math.abs(v) > 999) errors.push({ line: s.line, message: `${v} does not fit in three digits` })
      value = toCell(v)
    } else {
      if (v < 0 || v > 99) {
        errors.push({ line: s.line, message: `Operand ${v} is not an address 00-99` })
        continue
      }
      value = s.op * 100 + v
    }
    if (cells.has(s.addr)) errors.push({ line: s.line, message: `Cell ${s.addr} is assembled twice` })
    cells.set(s.addr, value)
    listing.push({ line: s.line, addr: s.addr, value, source: s.source })
  }

  let start = stmts.find((s) => s.kind === 'op')?.addr ?? defaultOrg
  if (startExpr) {
    const { line, expr } = startExpr as { line: number; expr: string }
    const v = evaluate(expr, line)
    if (v !== null) {
      if (v < 0 || v > 99) errors.push({ line, message: 'START must be an address 00-99' })
      else start = v
    }
  }

  errors.sort((a, b) => a.line - b.line)
  return { cells, start, listing, labels, errors }
}

/**
 * Build the classic self-loading card deck. Cell 00 (001) reads "002" into
 * cell 01, which reads "800" into cell 02, forming the loop
 *   00: INP 01   01: <card>   02: JMP 00
 * Each following pair is "0aa" (INP aa) then the word for cell aa. A final
 * "8ss" card jumps to the program's start.
 */
export function bootstrapDeck(cells: Map<number, number>, start: number): number[] {
  const deck = [2, 800]
  for (const addr of [...cells.keys()].sort((a, b) => a - b)) {
    deck.push(addr, cells.get(addr)!)
  }
  deck.push(800 + start)
  return deck
}

/** Parse a whitespace/comma separated list of input cards. */
export function parseCards(text: string): { cards: number[]; bad: string[] } {
  const cards: number[] = []
  const bad: string[] = []
  for (const tok of text.split(/[\s,]+/).filter(Boolean)) {
    if (NUMBER.test(tok) && Math.abs(Number(tok)) <= 999) cards.push(Number(tok))
    else bad.push(tok)
  }
  return { cards, bad }
}
