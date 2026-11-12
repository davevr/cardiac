import { useState } from 'react'
import { assemble, bootstrapDeck, parseCards, type AsmResult } from '../cardiac/assembler'
import { fmtAddr, fmtCell } from '../cardiac/core'
import { SAMPLES } from '../cardiac/samples'
import type { Cardiac } from '../cardiac/useCardiac'

const SPEEDS = [1, 2, 4, 8, 16, 60, 1000]
const speedLabel = (s: number) => (s >= 1000 ? 'max' : `${s}/s`)

export function Panel({ cardiac }: { cardiac: Cardiac }) {
  const { machine, running, speed, canGoBack, actions } = cardiac
  const [sampleId, setSampleId] = useState(SAMPLES[0].id)
  const [source, setSource] = useState(SAMPLES[0].source)
  const [inputText, setInputText] = useState(SAMPLES[0].input)
  const [result, setResult] = useState<AsmResult | null>(null)
  const [note, setNote] = useState('')

  const cards = parseCards(inputText)

  const pickSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id)!
    setSampleId(id)
    setSource(s.source)
    setInputText(s.input)
    setResult(null)
    setNote('')
  }

  const build = (viaDeck: boolean) => {
    const r = assemble(source)
    setResult(r)
    if (r.errors.length > 0) {
      setNote('')
      return
    }
    if (viaDeck) {
      actions.loadDeck([...bootstrapDeck(r.cells, r.start), ...cards.cards])
      setNote(`Deck of ${r.cells.size * 2 + 3} loader cards placed on the input strip. Bug at 00: press Run to watch it load itself.`)
    } else {
      actions.load(r.cells, r.start, cards.cards)
      setNote(`${r.cells.size} cells written. Bug at ${fmtAddr(r.start)}.`)
    }
  }

  const statusText = machine.status === 'halted' ? 'Halted' : running ? 'Running' : 'Ready'

  return (
    <aside className="panel">
      <section className="panel-block">
        <div className="controls">
          {running ? (
            <button className="btn primary" onClick={actions.stop}>Stop</button>
          ) : (
            <button className="btn primary" onClick={actions.run}>Run</button>
          )}
          <button className="btn" onClick={actions.step} disabled={running}>Step</button>
          <button className="btn" onClick={actions.back} disabled={running || !canGoBack}>Back</button>
          <button className="btn" onClick={actions.reset}>Reset</button>
          <button className="btn" onClick={actions.clear}>Clear</button>
        </div>
        <label className="speed">
          <span>Speed</span>
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={Math.max(0, SPEEDS.indexOf(speed))}
            onChange={(e) => actions.setSpeed(SPEEDS[Number(e.target.value)])}
          />
          <span className="speed-value">{speedLabel(speed)}</span>
        </label>
        <div className={`status status-${running ? 'running' : machine.status}`}>
          <strong>{statusText}</strong>
          <span>cycle {machine.cycles}</span>
        </div>
        <p className="trace">{machine.trace?.text ?? 'Load a program, then press Step or Run.'}</p>
      </section>

      <section className="panel-block">
        <div className="row">
          <h2>Program</h2>
          <select value={sampleId} onChange={(e) => pickSample(e.target.value)} aria-label="Sample program">
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <p className="hint">{SAMPLES.find((s) => s.id === sampleId)?.blurb}</p>
        <textarea
          className="code"
          spellCheck={false}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={16}
          aria-label="Assembly source"
        />
        <h2>Input cards</h2>
        <div className="row">
          <input
            className="cards-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. 12 34 -5"
            aria-label="Input cards"
          />
          <button className="btn small" onClick={() => actions.setInput(cards.cards)} title="Replace the unread cards on the strip">
            Feed strip
          </button>
        </div>
        {cards.bad.length > 0 && <p className="error">Not a card (−999 to 999): {cards.bad.join(', ')}</p>}
        <div className="controls">
          <button className="btn primary" onClick={() => build(false)}>Assemble &amp; load</button>
          <button className="btn" onClick={() => build(true)} title="Load the program the authentic way, from a self-loading card deck">
            Load from card deck
          </button>
        </div>
        {note && <p className="hint">{note}</p>}
        {result && result.errors.length > 0 && (
          <ul className="error-list">
            {result.errors.map((e, i) => (
              <li key={i}>Line {e.line}: {e.message}</li>
            ))}
          </ul>
        )}
        {result && result.errors.length === 0 && (
          <details className="listing">
            <summary>Listing</summary>
            <table>
              <tbody>
                {result.listing.map((row) => (
                  <tr key={row.addr}>
                    <td>{fmtAddr(row.addr)}</td>
                    <td>{fmtCell(row.value)}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section className="panel-block">
        <div className="row">
          <h2>Output</h2>
          <button className="btn small" onClick={actions.clearOutput} disabled={machine.output.length === 0}>Clear</button>
        </div>
        <div className="output-log">
          {machine.output.length === 0 ? <span className="hint">Nothing printed yet.</span> : machine.output.map(fmtCell).join('  ')}
        </div>
      </section>
    </aside>
  )
}
