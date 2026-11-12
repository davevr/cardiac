export interface Sample {
  id: string
  title: string
  blurb: string
  source: string
  /** Input cards the program expects. */
  input: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'add',
    title: 'Add two numbers',
    blurb: 'Reads two cards and prints their sum.',
    input: '123 456',
    source: `; Add two numbers from the input strip
        ORG 10
        INP a
        INP b
        CLA a
        ADD b
        STO sum
        OUT sum
        HRS 10

a:      DATA 0
b:      DATA 0
sum:    DATA 0
`,
  },
  {
    id: 'count',
    title: 'Count to N',
    blurb: 'Reads N, then prints 1, 2, ... N.',
    input: '10',
    source: `; Count from 1 to N (N is read from a card)
        ORG 10
        INP n
loop:   CLA count
        ADD 00          ; cell 00 always holds 001
        STO count
        OUT count
        CLA n
        SUB count       ; n - count
        SUB 00          ; negative once count = n
        TAC done
        JMP loop
done:   HRS 10

n:      DATA 0
count:  DATA 0
`,
  },
  {
    id: 'sumlist',
    title: 'Sum a list',
    blurb: 'First card is how many numbers follow; prints the total.',
    input: '5 10 20 30 40 50',
    source: `; Sum a list. First card = how many numbers follow.
        ORG 10
        INP n
loop:   CLA n
        SUB 00
        TAC done        ; n went below zero: finished
        STO n
        INP x
        CLA sum
        ADD x
        STO sum
        JMP loop
done:   OUT sum
        HRS 10

n:      DATA 0
x:      DATA 0
sum:    DATA 0
`,
  },
  {
    id: 'multiply',
    title: 'Multiply',
    blurb: 'Multiplies two cards by repeated addition.',
    input: '12 34',
    source: `; Multiply a * b by repeated addition
        ORG 10
        INP a
        INP b
loop:   CLA b
        SUB 00
        TAC done
        STO b
        CLA prod
        ADD a
        STO prod
        JMP loop
done:   OUT prod
        HRS 10

a:      DATA 0
b:      DATA 0
prod:   DATA 0
`,
  },
  {
    id: 'reverse',
    title: 'Reverse digits',
    blurb: 'Uses SFT to reverse a three-digit number.',
    input: '123',
    source: `; Reverse the digits of a three-digit number using SFT.
; The accumulator has four digits; SFT xy shifts left x, then right y.
        ORG 10
        INP n
        CLA n
        SFT 33          ; 0abc -> c000 -> 000c
        SFT 20          ; 000c -> 0c00
        STO r
        CLA n
        SFT 23          ; 0abc -> bc00 -> 000b
        SFT 10          ; 000b -> 00b0
        ADD r
        STO r
        CLA n
        SFT 02          ; 0abc -> 000a
        ADD r
        STO r
        OUT r
        HRS 10

n:      DATA 0
r:      DATA 0
`,
  },
  {
    id: 'subroutine',
    title: 'Subroutine call',
    blurb: 'JMP leaves a return jump in cell 99; the subroutine copies it to its exit.',
    input: '7 21',
    source: `; Double each input card with a subroutine.
; JMP writes "8nn" (a jump back to the caller) into cell 99.
        ORG 10
        INP x
        JMP double
        OUT x
        INP x
        JMP double
        OUT x
        HRS 10

double: CLA 99          ; fetch the return jump
        STO exit        ; plant it at the end of the subroutine
        CLA x
        ADD x
        STO x
exit:   HRS 00          ; overwritten with the return jump

x:      DATA 0
`,
  },
  {
    id: 'countdown',
    title: 'Rocket countdown',
    blurb: 'Counts up from -004 to zero, using TAC to loop while negative.',
    input: '',
    source: `; Countdown: prints -003, -002, -001, 000.
; TAC jumps only while the accumulator is negative (zero counts as positive).
        ORG 19
t:      DATA -4
        CLA t
loop:   ADD 00
        STO 18
        OUT 18
        TAC loop
        HRS 20
`,
  },
  {
    id: 'tictactoe',
    title: 'Tic-tac-toe',
    blurb: 'The machine opens in the centre and never loses. Feed your moves as cards; 999 = machine wins, 000 = draw.',
    input: '1 6 8 3',
    source: `; Tic-tac-toe. The board is numbered clockwise round the edge, so
; that geometry becomes arithmetic modulo 8:
;
;     1 2 3      opposite cell      = n + 4
;     8 9 4      next cell clockwise = n + 1
;     7 6 5      9 is the centre
;
; The machine takes the centre, then plays next to your first move.
; Every machine move threatens the cell opposite it (through the
; centre), so you must block there; if you do not, it takes that cell
; and wins. Its moves step round by +1, +2, +3 and finally +6.
; Output: the machine's moves, then 999 (it won) or 000 (a draw).
        ORG 10
        CLA 00
        STO inc         ; first step is +1
        OUT nine        ; machine takes the centre
        INP m           ; your first move, 1-8
round:  CLA m
        ADD inc
        JMP wrap
        STO m
        OUT m           ; machine's move
        ADD four
        JMP wrap
        STO e           ; the cell you must block
        INP h
        CLA h
        SUB e
        TAC win         ; h < e: not blocked
        SUB 00
        TAC blocked     ; h = e
win:    OUT e           ; machine completes its line
        OUT won
        HRS 10
blocked: CLA inc
        ADD 00
        STO inc
        SUB four
        TAC round       ; three rounds: steps 1, 2, 3
        CLA m
        ADD six         ; the one cell left
        JMP wrap
        STO m
        OUT m
        OUT zero
        HRS 10

nine:   DATA 9
eight:  DATA 8
six:    DATA 6
four:   DATA 4
won:    DATA 999
zero:   DATA 0
inc:    DATA 0
m:      DATA 0
e:      DATA 0
h:      DATA 0

; wrap: bring the accumulator back into 1-8. It ends in cell 99, where
; JMP has just written the return jump, so it needs no exit code.
        ORG 95
wrap:   SUB nine
        TAC 98          ; was 8 or less: just undo the subtraction
        SUB eight
        ADD nine
`,
  },
]
