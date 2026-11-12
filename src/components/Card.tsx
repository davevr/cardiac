import { useState, type ReactNode } from 'react'
import { decode, fmtAddr, fmtCell, OPS, pad, type Machine } from '../cardiac/core'
import type { Cardiac } from '../cardiac/useCardiac'

// Drawing space. The card sits between TOP and BOTTOM; slide tabs and the
// I/O strips stick out above and below it, as on the real thing.
const W = 1680
const H = 800
const TOP = 52
const BOTTOM = 712

// Memory grid: six columns of seventeen cells, numbered down the columns.
const ROWS = 17
const GRID_X = 1130
const GRID_Y = 114
const CELL_W = 86
const CELL_H = 34
const cellPos = (addr: number) => ({
  x: GRID_X + Math.floor(addr / ROWS) * CELL_W,
  y: GRID_Y + (addr % ROWS) * CELL_H,
})

type Route = 'decoder' | 'bypass' | 'stop' | null

function routeOf(m: Machine): Route {
  const t = m.trace
  if (!t || t.instruction < 0) return null
  if (t.blank) return 'stop'
  if (t.op === 3 && !t.jumped) return 'bypass'
  return 'decoder'
}

export function Card({ cardiac }: { cardiac: Cardiac }) {
  const { machine, actions, running } = cardiac
  const [editing, setEditing] = useState<number | null>(null)
  const { op, addr } = decode(machine.ir)
  const tens = Math.floor(addr / 10)
  const ones = addr % 10
  const route = routeOf(machine)
  const negative = machine.acc < 0

  return (
    <svg className="card" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="CARDIAC cardboard computer">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrowhead" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrowhead on" />
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Slides and strips poking out behind the card */}
      <SlideTab x={400} width={84} offset={negative ? 1 : 0} label={['ACCUMU-', 'LATOR TEST']} />
      <SlideTab x={572} width={56} offset={op} label={['OP', 'CODE']} />
      <SlideTab x={634} width={56} offset={tens} label={['ADDRESS', '(2)']} />
      <SlideTab x={696} width={56} offset={ones} label={['ADDRESS', '(1)']} />
      <StripTail x={34} read={machine.input.slice(0, machine.inputPos)} />
      <StripTail x={844} read={[]} />

      {/* The card itself: two panels and a fold */}
      <g filter="url(#shadow)">
        <rect x={20} y={TOP} width={W - 40} height={BOTTOM - TOP} rx={10} className="stock" />
      </g>
      <line x1={820} y1={TOP} x2={820} y2={BOTTOM} className="fold" />

      <CpuPanel machine={machine} route={route} op={op} tens={tens} ones={ones} />
      <MemoryPanel
        machine={machine}
        editing={editing}
        setEditing={setEditing}
        onSetCell={actions.setCell}
        onSetPc={actions.setPc}
        locked={running}
      />
    </svg>
  )
}

// ---------------------------------------------------------------- CPU panel

function CpuPanel({ machine, route, op, tens, ones }: { machine: Machine; route: Route; op: number; tens: number; ones: number }) {
  const on = (r: Route) => (route === r ? ' on' : '')
  const marker = (r: Route) => `url(#${route === r ? 'arrow-on' : 'arrow'})`
  const fetched = machine.trace !== null

  return (
    <g>
      <Logo x={548} y={62} />
      <text x={792} y={136} className="print tiny" textAnchor="end">
        A CARDBOARD ILLUSTRATIVE AID TO COMPUTATION
      </text>
      <text x={792} y={698} className="print tiny" textAnchor="end">
        AFTER THE 1968 BELL TELEPHONE LABORATORIES ORIGINAL BY DAVID HAGELBARGER AND SAUL FINGERMAN
      </text>

      {/* Instruction decoder */}
      <text x={134} y={156} className="print caption">INSTRUCTION DECODER</text>
      <rect x={130} y={162} width={612} height={40} rx={20} className={`window${on('decoder')}`} />
      <foreignObject x={140} y={162} width={592} height={40}>
        <div className="decoder">{decoderSentence(op, tens, ones)}</div>
      </foreignObject>

      {/* Decoder back to the instruction register */}
      <path d="M742 182 H780 V488 H764" className={`flow thick${fetched ? ' on' : ''}`} markerEnd={`url(#${fetched ? 'arrow-on' : 'arrow'})`} />

      {/* Instruction register */}
      <rect x={560} y={430} width={200} height={116} rx={6} className="box" />
      <text x={660} y={447} className="print caption" textAnchor="middle">INSTRUCTION REGISTER</text>
      <rect x={606} y={454} width={108} height={36} rx={18} className="window" />
      {[op, tens, ones].map((d, i) => (
        <text key={i} x={630 + i * 30} y={481} className="digit" textAnchor="middle">{d}</text>
      ))}
      <text className="print small" textAnchor="middle">
        <tspan x={660} y={507}>SET THE SLIDES TO MATCH</tspan>
        <tspan x={660} y={520}>THE CONTENTS OF</tspan>
        <tspan x={660} y={533}>THE BUG'S CELL.</tspan>
      </text>
      <path d="M660 588 V550" className="flow" markerEnd="url(#arrow)" />
      <text x={660} y={604} className="print caption" textAnchor="middle">START</text>

      {/* Move bug */}
      <path d="M560 488 H534" className={`flow${fetched ? ' on' : ''}`} markerEnd={`url(#${fetched ? 'arrow-on' : 'arrow'})`} />
      <rect x={370} y={458} width={160} height={60} rx={6} className="box" />
      <text className="print small" textAnchor="middle">
        <tspan x={450} y={484}>MOVE THE BUG AHEAD</tspan>
        <tspan x={450} y={498}>ONE CELL.</tspan>
      </text>
      <path d="M450 458 V396" className={`flow${fetched ? ' on' : ''}`} markerEnd={`url(#${fetched ? 'arrow-on' : 'arrow'})`} />

      {/* Accumulator test and its three exits */}
      <text x={334} y={345} className="print caption">ACCUMULATOR TEST</text>
      <rect x={330} y={352} width={210} height={40} rx={20} className="window" />
      <foreignObject x={338} y={352} width={194} height={40}>
        <div className="test">{testWindow(machine, op)}</div>
      </foreignObject>
      <path d="M330 372 H112 V182 H126" className={`flow${on('decoder')}`} markerEnd={marker('decoder')} />
      <path d="M540 372 H600 V426" className={`flow${on('bypass')}`} markerEnd={marker('bypass')} />
      <path d="M505 352 V333" className={`flow${on('stop')}`} markerEnd={marker('stop')} />
      <text x={505} y={326} className={`print small${on('stop')}`} textAnchor="middle">ADVANCE CARD.</text>
      <path d="M505 313 V303" className={`flow${on('stop')}`} markerEnd={marker('stop')} />
      <text x={505} y={296} className={`print small${on('stop')}`} textAnchor="middle">BUG TO CELL 00.</text>
      <path d="M505 283 V271" className={`flow${on('stop')}`} markerEnd={marker('stop')} />
      <polygon points={octagon(505, 248, 19)} className={`stop${on('stop')}`} />
      <text x={505} y={252} className="stop-text" textAnchor="middle">STOP</text>

      <Accumulator machine={machine} />
      <InputStrip machine={machine} />
    </g>
  )
}

function decoderSentence(op: number, tens: number, ones: number): ReactNode {
  const cell = <span className="hole">{tens}{ones}</span>
  switch (op) {
    case 0: return <>COPY THE INPUT CARD INTO CELL {cell}. ADVANCE THE CARD.</>
    case 1: return <>CLEAR THE ACCUMULATOR, THEN COPY CELL {cell} INTO IT.</>
    case 2: return <>ADD THE CONTENTS OF CELL {cell} TO THE ACCUMULATOR.</>
    case 3: return <>MOVE THE BUG TO CELL {cell}.</>
    case 4: return <>SHIFT ACCUMULATOR LEFT <span className="hole round">{tens}</span> PLACES, THEN RIGHT <span className="hole round">{ones}</span> PLACES.</>
    case 5: return <>COPY CELL {cell} ONTO THE OUTPUT CARD. ADVANCE THE CARD.</>
    case 6: return <>COPY THE ACCUMULATOR INTO CELL {cell}.</>
    case 7: return <>SUBTRACT THE CONTENTS OF CELL {cell} FROM THE ACCUMULATOR.</>
    case 8: return <>WRITE BUG'S CELL NO. IN CELL 99. MOVE THE BUG TO CELL {cell}.</>
    default: return <>MOVE THE BUG TO CELL {cell}. STOP.</>
  }
}

function testWindow(machine: Machine, op: number): ReactNode {
  const t = machine.trace
  if (op === 0) {
    const blank = t?.blank === true
    return (
      <>
        <span>INPUT CARD BLANK?</span>
        <span className={!blank && t ? 'pick' : ''}>NO</span>
        <span className={blank ? 'pick' : ''}>YES</span>
      </>
    )
  }
  if (op === 3) {
    const jumped = t?.jumped === true
    return (
      <>
        <span>ACCUMULATOR SIGN</span>
        <span className={t && !jumped ? 'pick' : ''}>+</span>
        <span className={jumped ? 'pick' : ''}>−</span>
      </>
    )
  }
  return <span>◀ TO THE DECODER</span>
}

function octagon(cx: number, cy: number, r: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 8) * (2 * i + 1)
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function Accumulator({ machine }: { machine: Machine }) {
  const S = 38
  const x0 = 150
  const yAcc = 540
  const digits = pad(machine.acc, 4).split('')
  const t = machine.trace
  const scratch = t?.accBefore !== undefined && t.operand !== undefined
  const top = scratch ? pad(t.accBefore!, 4).slice(1).split('') : []
  const mid = scratch ? pad(t.operand!, 3).split('') : []
  const midSign = scratch ? ((t.op === 7) !== (t.operand! < 0) ? '−' : '+') : ''

  return (
    <g>
      {[0, 1].map((row) =>
        [1, 2, 3].map((col) => (
          <rect key={`${row}-${col}`} x={x0 + col * S} y={yAcc - (2 - row) * S} width={S} height={S} className="square scratch" />
        )),
      )}
      {digits.map((_, col) => (
        <rect key={col} x={x0 + col * S} y={yAcc} width={S} height={S} className="square" />
      ))}
      {top.map((d, i) => (
        <text key={`t${i}`} x={x0 + (i + 1.5) * S} y={yAcc - 2 * S + 28} className="pencil faint" textAnchor="middle">{d}</text>
      ))}
      {scratch && t.accBefore! < 0 && (
        <text x={x0 + 0.6 * S} y={yAcc - 2 * S + 28} className="pencil faint" textAnchor="middle">−</text>
      )}
      {mid.map((d, i) => (
        <text key={`m${i}`} x={x0 + (i + 1.5) * S} y={yAcc - S + 28} className="pencil faint" textAnchor="middle">{d}</text>
      ))}
      {scratch && <text x={x0 + 0.6 * S} y={yAcc - S + 28} className="pencil faint" textAnchor="middle">{midSign}</text>}
      {digits.map((d, col) => (
        <text key={col} x={x0 + (col + 0.5) * S} y={yAcc + 28} className="pencil" textAnchor="middle">{d}</text>
      ))}
      <circle cx={122} cy={yAcc + S / 2} r={15} className="window" />
      <text x={122} y={yAcc + S / 2 + 8} className="digit" textAnchor="middle">{machine.acc < 0 ? '−' : '+'}</text>
      <text x={x0 + 2 * S} y={yAcc + S + 18} className="print caption" textAnchor="middle">ACCUMULATOR</text>
    </g>
  )
}

// ------------------------------------------------------------------- strips

const STRIP_W = 58
const CARD_H = 24
const WINDOW_Y = 628
const VISIBLE = 20

/** A strip card: clipped corner, sequence number, handwritten value. */
function StripCard({ x, y, n, value, dim }: { x: number; y: number; n: number; value?: number; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.55 : 1}>
      <path d={`M${x} ${y} H${x + STRIP_W - 7} L${x + STRIP_W} ${y + 7} V${y + CARD_H} H${x} Z`} className="strip-card" />
      <text x={x + 4} y={y + 10} className="print micro">{n}</text>
      {value !== undefined && (
        <text x={x + STRIP_W / 2 + 5} y={y + 19} className="pencil small" textAnchor="middle">{fmtCell(value)}</text>
      )}
    </g>
  )
}

function InputStrip({ machine }: { machine: Machine }) {
  const x = 34
  const pending = machine.input.slice(machine.inputPos)
  return (
    <g>
      {/* Unread cards lie up the left edge, waiting to be pulled down to the window. */}
      {pending.slice(1, VISIBLE).map((v, i) => (
        <StripCard key={machine.inputPos + i + 1} x={x} y={WINDOW_Y - 34 - (i + 1) * CARD_H} n={machine.inputPos + i + 2} value={v} />
      ))}
      {pending.length > VISIBLE && (
        <text x={x + STRIP_W / 2} y={WINDOW_Y - 34 - VISIBLE * CARD_H + 16} className="print micro" textAnchor="middle">
          +{pending.length - VISIBLE} MORE
        </text>
      )}
      <text x={x + STRIP_W / 2} y={WINDOW_Y - 12} className="print caption" textAnchor="middle">INPUT ▼</text>
      <rect x={x - 6} y={WINDOW_Y - 4} width={STRIP_W + 12} height={CARD_H + 8} rx={16} className="window" />
      {pending.length > 0 ? (
        <StripCard x={x} y={WINDOW_Y} n={machine.inputPos + 1} value={pending[0]} />
      ) : (
        <text x={x + STRIP_W / 2} y={WINDOW_Y + 16} className="print micro" textAnchor="middle">BLANK</text>
      )}
    </g>
  )
}

/** Cards already read, hanging out below the card. */
function StripTail({ x, read }: { x: number; read: number[] }) {
  const shown = read.slice(-3).reverse()
  return (
    <g>
      <rect x={x} y={BOTTOM - 10} width={STRIP_W} height={18 + Math.min(read.length, 3) * CARD_H} className="strip-card" />
      {shown.map((v, i) => (
        <StripCard key={read.length - i} x={x} y={BOTTOM + 2 + i * CARD_H} n={read.length - i} value={v} dim />
      ))}
    </g>
  )
}

function OutputStrip({ machine }: { machine: Machine }) {
  const x = 844
  const out = machine.output
  const shown = out.slice(-(VISIBLE - 1))
  const first = out.length - shown.length
  return (
    <g>
      {/* Written cards move up the left edge; the newest sits just above the window. */}
      {shown.map((v, i) => (
        <StripCard key={first + i} x={x} y={WINDOW_Y - 34 - (shown.length - i) * CARD_H} n={first + i + 1} value={v} />
      ))}
      <text x={x + STRIP_W / 2} y={WINDOW_Y - 12} className="print caption" textAnchor="middle">OUTPUT ▼</text>
      <rect x={x - 6} y={WINDOW_Y - 4} width={STRIP_W + 12} height={CARD_H + 8} rx={16} className="window" />
      <StripCard x={x} y={WINDOW_Y} n={out.length + 1} />
    </g>
  )
}

function SlideTab({ x, width, offset, label }: { x: number; width: number; offset: number; label: string[] }) {
  // Each slide shifts a little with the digit it shows.
  const dy = offset * 3
  return (
    <g className="slide" style={{ transform: `translateY(${dy}px)` }}>
      <rect x={x} y={14} width={width} height={BOTTOM - 14 + 46} rx={5} className="slide-body" />
      <text className="print micro" textAnchor="middle">
        {label.map((line, i) => (
          <tspan key={i} x={x + width / 2} y={BOTTOM + 20 + i * 10}>{line}</tspan>
        ))}
      </text>
      <text x={x + width / 2} y={34} className="print micro" textAnchor="middle">▲ ▲</text>
    </g>
  )
}

// ------------------------------------------------------------- memory panel

interface MemoryProps {
  machine: Machine
  editing: number | null
  setEditing: (addr: number | null) => void
  onSetCell: (addr: number, value: number) => void
  onSetPc: (addr: number) => void
  locked: boolean
}

function MemoryPanel({ machine, editing, setEditing, onSetCell, onSetPc, locked }: MemoryProps) {
  const t = machine.trace
  const bug = cellPos(machine.pc)

  const commit = (addr: number, text: string) => {
    const v = Number(text.trim())
    if (text.trim() !== '' && Number.isInteger(v) && Math.abs(v) <= 999) onSetCell(addr, v)
    setEditing(null)
  }

  return (
    <g>
      <text x={GRID_X} y={84} className="print title">MEMORY CELLS</text>
      <OpTable />
      <OutputStrip machine={machine} />

      {Array.from({ length: 6 }, (_, col) => (
        <g key={col}>
          <text x={GRID_X + col * CELL_W + 3} y={GRID_Y - 5} className="print micro">CELL NO.</text>
          <text x={GRID_X + col * CELL_W + 44} y={GRID_Y - 5} className="print micro">CONTENTS</text>
        </g>
      ))}

      {machine.mem.map((value, addr) => {
        const { x, y } = cellPos(addr)
        const mark = t?.write === addr ? ' written' : t?.read === addr ? ' read' : ''
        return (
          <g key={addr} className={`cell${mark}`}>
            <rect x={x} y={y} width={CELL_W} height={CELL_H} className="cell-frame" />
            <rect x={x + 40} y={y} width={CELL_W - 40} height={CELL_H} className="cell-contents" />
            <text x={x + 4} y={y + 13} className="print cellno">{fmtAddr(addr)}</text>
            <circle
              cx={x + 29}
              cy={y + 18}
              r={8.5}
              className="hole-punch"
              onClick={() => !locked && onSetPc(addr)}
            >
              <title>Move the bug to cell {fmtAddr(addr)}</title>
            </circle>
            {editing === addr ? (
              <foreignObject x={x + 41} y={y + 2} width={CELL_W - 42} height={CELL_H - 4}>
                <input
                  className="cell-input"
                  autoFocus
                  defaultValue={fmtCell(value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => commit(addr, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit(addr, e.currentTarget.value)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  aria-label={`Contents of cell ${fmtAddr(addr)}`}
                />
              </foreignObject>
            ) : (
              <text
                x={x + 63}
                y={y + 25}
                className={`pencil${addr === 0 ? ' preprinted' : ''}`}
                textAnchor="middle"
                onClick={() => addr !== 0 && !locked && setEditing(addr)}
              >
                {value === 0 && addr !== 0 ? '' : fmtCell(value)}
                <title>{addr === 0 ? 'Cell 00 is permanent' : `Cell ${fmtAddr(addr)}: ${describe(value)} (click to edit)`}</title>
              </text>
            )}
            {editing !== addr && addr !== 0 && value === 0 && (
              <rect
                x={x + 40}
                y={y}
                width={CELL_W - 40}
                height={CELL_H}
                className="cell-hit"
                onClick={() => !locked && setEditing(addr)}
              />
            )}
          </g>
        )
      })}

      <g className="bug" style={{ transform: `translate(${bug.x + 29}px, ${bug.y + 18}px)` }}>
        <Ladybug />
      </g>
    </g>
  )
}

function describe(value: number) {
  if (value < 0) return 'data'
  const { op, addr } = decode(value)
  return `${OPS[op].mnemonic} ${fmtAddr(addr)}`
}

function Ladybug() {
  return (
    <g>
      <circle cx={8} cy={0} r={4.5} className="bug-head" />
      <ellipse cx={0} cy={0} rx={10} ry={9} className="bug-body" />
      <line x1={-10} y1={0} x2={10} y2={0} className="bug-line" />
      {[[-4, -4.5], [3, -4.5], [-4, 4.5], [3, 4.5], [-0.5, -1], [-0.5, 1]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.7} className="bug-spot" />
      ))}
    </g>
  )
}

function OpTable() {
  const x = 918
  const y = 150
  return (
    <g>
      <text x={x} y={y - 22} className="print caption">OP CODE</text>
      <text className="print micro">
        <tspan x={x} y={y - 6}>CODE</tspan>
        <tspan x={x + 32} y={y - 6}>ABBR.</tspan>
        <tspan x={x + 70} y={y - 6}>MEANING</tspan>
      </text>
      <line x1={x} y1={y} x2={x + 196} y2={y} className="rule" />
      {OPS.map((o, i) => (
        <text key={o.code} className="print small">
          <tspan x={x + 6} y={y + 18 + i * 22} fontWeight={700}>{o.code}</tspan>
          <tspan x={x + 32} y={y + 18 + i * 22} fontWeight={700}>{o.mnemonic}</tspan>
          <tspan x={x + 70} y={y + 18 + i * 22} fontSize={9} letterSpacing={0}>{o.name}</tspan>
        </text>
      ))}
    </g>
  )
}

// --------------------------------------------------------------------- logo

const GLYPHS: Record<string, string[]> = {
  c: ['     ', '     ', ' ### ', '#   #', '#    ', '#   #', ' ### '],
  a: ['     ', '     ', ' ### ', '    #', ' ####', '#   #', ' ####'],
  r: ['     ', '     ', '# ## ', '##  #', '#    ', '#    ', '#    '],
  d: ['    #', '    #', ' ## #', '#  ##', '#   #', '#  ##', ' ## #'],
  i: ['  #  ', '     ', ' ##  ', '  #  ', '  #  ', '  #  ', ' ### '],
}

/** Lowercase "cardiac" picked out of a field of dots. */
function Logo({ x, y }: { x: number; y: number }) {
  const word = 'cardiac'
  const pitch = 5.4
  const cols = word.length * 6 + 3
  const rows = 11
  const lit = new Set<string>()
  word.split('').forEach((ch, k) =>
    GLYPHS[ch].forEach((line, r) =>
      line.split('').forEach((px, c) => {
        if (px === '#') lit.add(`${k * 6 + 2 + c},${r + 2}`)
      }),
    ),
  )
  const dots = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = lit.has(`${c},${r}`)
      dots.push(
        <circle key={`${c},${r}`} cx={x + pitch / 2 + c * pitch} cy={y + pitch / 2 + r * pitch} r={isLit ? 2.4 : 0.9} className={isLit ? 'dot lit' : 'dot'} />,
      )
    }
  }
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={cols * pitch + 6} height={rows * pitch + 6} className="logo-frame" />
      {dots}
    </g>
  )
}
