# CARDIAC simulator

A React simulator of CARDIAC, the CARDboard Illustrative Aid to Computation
(Bell Telephone Laboratories, 1968, David Hagelbarger and Saul Fingerman).

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # machine, assembler and sample-program tests
```

- `src/cardiac/core.ts` – the machine: 100 signed three-digit cells, a four-digit
  accumulator, ten opcodes, cell 00 fixed at 001, return jump written to cell 99.
- `src/cardiac/assembler.ts` – labels, `ORG`, `DATA`, `START`, and the
  self-loading bootstrap card deck (`002`, `800`, address/word pairs, `8ss`).
- `src/components/Card.tsx` – the cardboard face, drawn in SVG.

On the card: click a cell's contents to write in it, click a cell's hole to move the bug.
