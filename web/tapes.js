// Tape programs — the BASIC source loaded when the user "inserts" a tape.
// Each tape: { id, label, side, source }.
//
// 設計來源：design 原型 tapes.jsx；資料 100% 沿用，僅於檔尾加上「同檔雙環境」匯出。

(function (root) {
  const TAPES = [
    {
      id: 'HELLO',
      label: 'HELLO',
      side: 'A',
      desc: 'GREETING ROUTINE',
      source: [
        '10 REM --- HELLO WORLD ---',
        '20 PRINT "HELLO, WORLD."',
        '30 PRINT "READY."',
      ].join('\n'),
    },
    {
      id: 'CLOCK',
      label: 'CLOCK',
      side: 'A',
      desc: 'REAL-TIME CLOCK',
      // CLOCK is special: it triggers a built-in renderer.
      source: '__BUILTIN_CLOCK__',
    },
    {
      id: 'FIB',
      label: 'FIB-12',
      side: 'B',
      desc: 'FIBONACCI 1..12',
      source: [
        '10 REM --- FIBONACCI ---',
        '20 LET A = 0',
        '30 LET B = 1',
        '40 FOR I = 1 TO 12',
        '50 PRINT I, B',
        '60 LET C = A + B',
        '70 LET A = B',
        '80 LET B = C',
        '90 NEXT I',
        '100 PRINT "DONE."',
      ].join('\n'),
    },
    {
      id: 'PRIME',
      label: 'PRIME',
      side: 'B',
      desc: 'SIEVE 2..50',
      source: [
        '10 REM --- PRIME SIEVE ---',
        '20 PRINT "PRIMES TO 50:"',
        '30 FOR N = 2 TO 50',
        '40 LET P = 1',
        '50 FOR D = 2 TO N - 1',
        '60 IF N - INT(N / D) * D = 0 THEN LET P = 0',
        '70 NEXT D',
        '80 IF P = 1 THEN PRINT N;',
        '90 NEXT N',
        '100 PRINT',
        '110 PRINT "READY."',
      ].join('\n'),
    },
    {
      id: 'GUESS',
      label: 'GUESS',
      side: 'C',
      desc: 'NUMBER GUESS GAME',
      source: [
        '10 REM --- GUESS THE NUMBER ---',
        '20 LET N = INT(RND() * 100) + 1',
        '30 LET T = 0',
        '40 PRINT "GUESS A NUMBER 1-100"',
        '50 INPUT "> "; G',
        '60 LET T = T + 1',
        '70 IF G < N THEN PRINT "HIGHER"',
        '80 IF G > N THEN PRINT "LOWER"',
        '90 IF G = N THEN GOTO 110',
        '100 GOTO 50',
        '110 PRINT "GOT IT IN "; T; " TRIES."',
      ].join('\n'),
    },
    {
      id: 'CALC',
      label: 'CALC',
      side: 'C',
      desc: 'INTERACTIVE CALCULATOR',
      source: [
        '10 REM --- DESK CALCULATOR ---',
        '20 PRINT "ENTER 0 TO QUIT"',
        '30 INPUT "A= "; A',
        '40 IF A = 0 THEN GOTO 100',
        '50 INPUT "OP (1+ 2- 3* 4/) "; O',
        '60 INPUT "B= "; B',
        '70 IF O = 1 THEN PRINT "= "; A + B',
        '75 IF O = 2 THEN PRINT "= "; A - B',
        '80 IF O = 3 THEN PRINT "= "; A * B',
        '85 IF O = 4 THEN PRINT "= "; A / B',
        '90 GOTO 30',
        '100 PRINT "BYE."',
      ].join('\n'),
    },
    {
      id: 'DIVERG',
      label: '∂.404',
      side: '?',
      desc: 'WORLD LINE METER',
      // Steins;Gate easter egg
      source: '__BUILTIN_DIVERGENCE__',
    },
  ];

  // 雙環境匯出（design.md Decision 2）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TAPES };
  }
  if (root) {
    root.TAPES = TAPES;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
