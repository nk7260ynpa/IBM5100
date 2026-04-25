// Tiny BASIC + APL interpreter for the retro terminal
// Browser global: window.IBMTerm = { makeBASICEnv, execImmediate, runProgram, evalAPL, formatAPL, tokenize }
// Node / Vitest: module.exports 同樣 API。
//
// 設計來源：design 原型 interpreter.jsx；本檔保留所有 BASIC/APL 行為
// （包含 BASIC 比較回 -1/0、APL 比較回 1/0、APL 由右而左求值等慣例），
// 僅於 IIFE 末尾加上「同檔雙環境」匯出。
//
// 內部命名空間沿用 design 原型的 IBMTerm（spec/easter-eggs 的 IBM 規則僅及於字串
// 字面值，不及於 JS identifier；詳見 issues.md）。

(function (root) {
  // ---------- BASIC ----------
  // Supports: line-numbered programs, LET/assign, PRINT, INPUT, IF...THEN, GOTO,
  // FOR/NEXT, REM, END, plus immediate-mode expressions.

  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    const s = expr;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        tokens.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
        i = j; continue;
      }
      if (c === '"') {
        let j = i + 1;
        while (j < s.length && s[j] !== '"') j++;
        tokens.push({ t: 'str', v: s.slice(i + 1, j) });
        i = j + 1; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
        const name = s.slice(i, j).toUpperCase();
        if (['AND','OR','NOT','MOD'].includes(name)) tokens.push({ t: 'op', v: name });
        else tokens.push({ t: 'id', v: name });
        i = j; continue;
      }
      // multi-char ops
      const two = s.slice(i, i + 2);
      if (['<=','>=','<>'].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/^()=<>,;'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('SYNTAX ERROR');
    }
    return tokens;
  }

  function Parser(tokens) {
    let p = 0;
    const peek = () => tokens[p];
    const eat = (t, v) => {
      const tok = tokens[p];
      if (!tok) throw new Error('SYNTAX ERROR');
      if (t && tok.t !== t) throw new Error('SYNTAX ERROR');
      if (v !== undefined && tok.v !== v) throw new Error('SYNTAX ERROR');
      p++;
      return tok;
    };
    function parseExpr() { return parseOr(); }
    function parseOr() {
      let a = parseAnd();
      while (peek() && peek().t === 'op' && peek().v === 'OR') { p++; a = { op: 'OR', a, b: parseAnd() }; }
      return a;
    }
    function parseAnd() {
      let a = parseNot();
      while (peek() && peek().t === 'op' && peek().v === 'AND') { p++; a = { op: 'AND', a, b: parseNot() }; }
      return a;
    }
    function parseNot() {
      if (peek() && peek().t === 'op' && peek().v === 'NOT') { p++; return { op: 'NOT', a: parseCmp() }; }
      return parseCmp();
    }
    function parseCmp() {
      let a = parseAdd();
      while (peek() && peek().t === 'op' && ['=','<','>','<=','>=','<>'].includes(peek().v)) {
        const op = peek().v; p++;
        a = { op, a, b: parseAdd() };
      }
      return a;
    }
    function parseAdd() {
      let a = parseMul();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = peek().v; p++; a = { op, a, b: parseMul() };
      }
      return a;
    }
    function parseMul() {
      let a = parsePow();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === 'MOD')) {
        const op = peek().v; p++; a = { op, a, b: parsePow() };
      }
      return a;
    }
    function parsePow() {
      let a = parseUnary();
      while (peek() && peek().t === 'op' && peek().v === '^') {
        p++; a = { op: '^', a, b: parseUnary() };
      }
      return a;
    }
    function parseUnary() {
      if (peek() && peek().t === 'op' && (peek().v === '-' || peek().v === '+')) {
        const op = peek().v; p++; return { op: 'u' + op, a: parseUnary() };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('SYNTAX ERROR');
      if (tok.t === 'num') { p++; return { op: 'num', v: tok.v }; }
      if (tok.t === 'str') { p++; return { op: 'str', v: tok.v }; }
      if (tok.t === 'id') {
        p++;
        if (peek() && peek().t === 'op' && peek().v === '(') {
          p++;
          const args = [];
          if (!(peek() && peek().t === 'op' && peek().v === ')')) {
            args.push(parseExpr());
            while (peek() && peek().t === 'op' && peek().v === ',') { p++; args.push(parseExpr()); }
          }
          eat('op', ')');
          return { op: 'call', name: tok.v, args };
        }
        return { op: 'var', name: tok.v };
      }
      if (tok.t === 'op' && tok.v === '(') {
        p++; const e = parseExpr(); eat('op', ')'); return e;
      }
      throw new Error('SYNTAX ERROR');
    }
    return { parseExpr, peek, eat, pos: () => p, rest: () => tokens.slice(p) };
  }

  const FUNCS = {
    ABS: (x) => Math.abs(x),
    INT: (x) => Math.floor(x),
    SQR: (x) => Math.sqrt(x),
    SIN: (x) => Math.sin(x),
    COS: (x) => Math.cos(x),
    TAN: (x) => Math.tan(x),
    RND: () => Math.random(),
    LEN: (s) => String(s).length,
    CHR$: (x) => String.fromCharCode(x | 0),
    ASC: (s) => String(s).charCodeAt(0) || 0,
    STR$: (x) => String(x),
    VAL: (s) => parseFloat(s) || 0,
    LEFT$: (s, n) => String(s).slice(0, n | 0),
    RIGHT$: (s, n) => String(s).slice(-(n | 0)),
    MID$: (s, a, b) => String(s).substr((a | 0) - 1, b | 0),
  };

  function evalNode(n, env) {
    switch (n.op) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'var': return env.vars[n.name] !== undefined ? env.vars[n.name] : (n.name.endsWith('$') ? '' : 0);
      case 'call': {
        const f = FUNCS[n.name];
        if (!f) throw new Error('UNDEF FN ' + n.name);
        return f(...n.args.map(a => evalNode(a, env)));
      }
      case '+': {
        const a = evalNode(n.a, env), b = evalNode(n.b, env);
        if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
        return a + b;
      }
      case '-': return evalNode(n.a, env) - evalNode(n.b, env);
      case '*': return evalNode(n.a, env) * evalNode(n.b, env);
      case '/': return evalNode(n.a, env) / evalNode(n.b, env);
      case '^': return Math.pow(evalNode(n.a, env), evalNode(n.b, env));
      case 'MOD': return evalNode(n.a, env) % evalNode(n.b, env);
      case 'u-': return -evalNode(n.a, env);
      case 'u+': return +evalNode(n.a, env);
      case '=': return evalNode(n.a, env) === evalNode(n.b, env) ? -1 : 0;
      case '<>': return evalNode(n.a, env) !== evalNode(n.b, env) ? -1 : 0;
      case '<': return evalNode(n.a, env) < evalNode(n.b, env) ? -1 : 0;
      case '>': return evalNode(n.a, env) > evalNode(n.b, env) ? -1 : 0;
      case '<=': return evalNode(n.a, env) <= evalNode(n.b, env) ? -1 : 0;
      case '>=': return evalNode(n.a, env) >= evalNode(n.b, env) ? -1 : 0;
      case 'AND': return (evalNode(n.a, env) && evalNode(n.b, env)) ? -1 : 0;
      case 'OR': return (evalNode(n.a, env) || evalNode(n.b, env)) ? -1 : 0;
      case 'NOT': return evalNode(n.a, env) ? 0 : -1;
    }
    throw new Error('SYNTAX ERROR');
  }

  function formatNum(v) {
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return String(Number(v.toFixed(6)));
    }
    return String(v);
  }

  // Execute a single BASIC statement (immediate or program line body).
  // Returns { jump: lineNumber } or { stop: true } or undefined.
  async function execStatement(rest, env, io) {
    if (rest.length === 0) return;
    const first = rest[0];
    const kw = first.t === 'id' ? first.v : null;

    if (kw === 'REM') return;
    if (kw === 'END' || kw === 'STOP') return { stop: true };
    if (kw === 'CLS' || kw === 'CLEAR') { io.clear(); return; }

    if (kw === 'PRINT' || kw === '?') {
      const parser = Parser(rest.slice(1));
      let buf = '';
      let trailing = false;
      while (true) {
        if (!parser.peek()) break;
        const v = parser.parseExpr();
        buf += formatNum(evalNode(v, env));
        if (parser.peek() && parser.peek().t === 'op' && parser.peek().v === ',') {
          parser.eat('op', ','); buf += '\t'; trailing = true;
        } else if (parser.peek() && parser.peek().t === 'op' && parser.peek().v === ';') {
          parser.eat('op', ';'); trailing = true;
        } else { trailing = false; break; }
      }
      io.print(buf + (trailing ? '' : '\n'));
      return;
    }

    if (kw === 'INPUT') {
      // INPUT [prompt;] var
      const parser = Parser(rest.slice(1));
      let prompt = '? ';
      if (parser.peek() && parser.peek().t === 'str') {
        prompt = parser.peek().v;
        parser.eat('str');
        if (parser.peek() && parser.peek().t === 'op' && parser.peek().v === ';') parser.eat('op', ';');
      }
      const varTok = parser.peek();
      if (!varTok || varTok.t !== 'id') throw new Error('SYNTAX ERROR');
      const value = await io.input(prompt);
      env.vars[varTok.v] = varTok.v.endsWith('$') ? value : (parseFloat(value) || 0);
      return;
    }

    if (kw === 'LET' || (first.t === 'id' && rest[1] && rest[1].t === 'op' && rest[1].v === '=')) {
      const offset = kw === 'LET' ? 1 : 0;
      const name = rest[offset].v;
      const parser = Parser(rest.slice(offset + 2));
      env.vars[name] = evalNode(parser.parseExpr(), env);
      return;
    }

    if (kw === 'GOTO') {
      const parser = Parser(rest.slice(1));
      const target = evalNode(parser.parseExpr(), env);
      return { jump: target };
    }

    if (kw === 'IF') {
      // IF cond THEN <stmt | linenum> [ELSE ...]
      const parser = Parser(rest.slice(1));
      const cond = parser.parseExpr();
      const after = rest.slice(1 + parser.pos());
      // expect THEN
      if (!after[0] || after[0].t !== 'id' || after[0].v !== 'THEN') throw new Error('SYNTAX ERROR');
      // split THEN ... ELSE ...
      let elseIdx = -1;
      for (let i = 1; i < after.length; i++) if (after[i].t === 'id' && after[i].v === 'ELSE') { elseIdx = i; break; }
      const thenPart = elseIdx >= 0 ? after.slice(1, elseIdx) : after.slice(1);
      const elsePart = elseIdx >= 0 ? after.slice(elseIdx + 1) : [];
      const branch = evalNode(cond, env) ? thenPart : elsePart;
      if (branch.length === 0) return;
      if (branch.length === 1 && branch[0].t === 'num') return { jump: branch[0].v };
      return await execStatement(branch, env, io);
    }

    if (kw === 'FOR') {
      // FOR var = start TO end [STEP s]
      const varName = rest[1].v;
      if (!(rest[2].t === 'op' && rest[2].v === '=')) throw new Error('SYNTAX ERROR');
      const after = rest.slice(3);
      let toIdx = -1, stepIdx = -1;
      for (let i = 0; i < after.length; i++) {
        if (after[i].t === 'id' && after[i].v === 'TO') toIdx = i;
        if (after[i].t === 'id' && after[i].v === 'STEP') stepIdx = i;
      }
      if (toIdx < 0) throw new Error('SYNTAX ERROR');
      const startToks = after.slice(0, toIdx);
      const endToks = after.slice(toIdx + 1, stepIdx >= 0 ? stepIdx : after.length);
      const stepToks = stepIdx >= 0 ? after.slice(stepIdx + 1) : null;
      const start = evalNode(Parser(startToks).parseExpr(), env);
      const end = evalNode(Parser(endToks).parseExpr(), env);
      const step = stepToks ? evalNode(Parser(stepToks).parseExpr(), env) : 1;
      env.vars[varName] = start;
      env.forStack.push({ varName, end, step, line: env.currentLine });
      return;
    }

    if (kw === 'NEXT') {
      const top = env.forStack[env.forStack.length - 1];
      if (!top) throw new Error('NEXT WITHOUT FOR');
      env.vars[top.varName] += top.step;
      const done = top.step > 0 ? env.vars[top.varName] > top.end : env.vars[top.varName] < top.end;
      if (done) {
        env.forStack.pop();
      } else {
        return { jumpAfter: top.line };
      }
      return;
    }

    if (kw === 'GOSUB') {
      const parser = Parser(rest.slice(1));
      const target = evalNode(parser.parseExpr(), env);
      env.gosubStack.push(env.currentLine);
      return { jump: target };
    }
    if (kw === 'RETURN') {
      const back = env.gosubStack.pop();
      if (back === undefined) throw new Error('RETURN WITHOUT GOSUB');
      return { jumpAfter: back };
    }
    if (kw === 'LIST') {
      const lines = Object.keys(env.program).map(Number).sort((a, b) => a - b);
      for (const ln of lines) io.print(ln + ' ' + env.program[ln].text + '\n');
      return;
    }
    if (kw === 'RUN') {
      await runProgram(env, io);
      return;
    }
    if (kw === 'NEW') {
      env.program = {}; env.vars = {}; env.forStack = []; env.gosubStack = [];
      return;
    }

    throw new Error('SYNTAX ERROR');
  }

  async function runProgram(env, io) {
    const lines = Object.keys(env.program).map(Number).sort((a, b) => a - b);
    if (lines.length === 0) { io.print('NO PROGRAM\n'); return; }
    let idx = 0;
    let safety = 100000;
    while (idx < lines.length && safety-- > 0) {
      if (env.aborted) { io.print('BREAK\n'); env.aborted = false; return; }
      const ln = lines[idx];
      env.currentLine = ln;
      const tokens = env.program[ln].tokens;
      try {
        const r = await execStatement(tokens, env, io);
        if (r && r.stop) return;
        if (r && r.jump !== undefined) {
          const j = lines.indexOf(r.jump);
          if (j < 0) { io.print('UNDEF LINE ' + r.jump + '\n'); return; }
          idx = j; continue;
        }
        if (r && r.jumpAfter !== undefined) {
          const j = lines.indexOf(r.jumpAfter);
          idx = j + 1; continue;
        }
      } catch (e) {
        io.print('?' + e.message + ' IN ' + ln + '\n');
        return;
      }
      idx++;
      // brief yield so the UI can update
      if (idx % 50 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }

  async function execImmediate(line, env, io) {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Line-numbered → store / replace / delete
    const m = trimmed.match(/^(\d+)\s*(.*)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const body = m[2];
      if (!body) { delete env.program[n]; return; }
      try {
        const tokens = tokenize(body);
        env.program[n] = { text: body, tokens };
      } catch (e) {
        io.print('?' + e.message + '\n');
      }
      return;
    }
    try {
      const tokens = tokenize(trimmed);
      const r = await execStatement(tokens, env, io);
      if (r && r.jump !== undefined) {
        // GOTO from immediate mode: run from that line
        const lines = Object.keys(env.program).map(Number).sort((a, b) => a - b);
        const j = lines.indexOf(r.jump);
        if (j >= 0) {
          // run from j
          let idx = j;
          while (idx < lines.length) {
            const ln = lines[idx];
            env.currentLine = ln;
            const r2 = await execStatement(env.program[ln].tokens, env, io);
            if (r2 && r2.stop) return;
            if (r2 && r2.jump !== undefined) {
              idx = lines.indexOf(r2.jump); if (idx < 0) { io.print('UNDEF LINE\n'); return; } continue;
            }
            if (r2 && r2.jumpAfter !== undefined) {
              idx = lines.indexOf(r2.jumpAfter) + 1; continue;
            }
            idx++;
          }
        }
      }
    } catch (e) {
      io.print('?' + e.message + '\n');
    }
  }

  function makeBASICEnv() {
    return { program: {}, vars: {}, forStack: [], gosubStack: [], currentLine: 0, aborted: false };
  }

  // ---------- APL (subset) ----------
  // Tiny APL-flavored evaluator: supports vectors, scalars, and a handful of glyphs.
  // Iota, rho, +, -, multiply, divide, ceil, floor, exp, abs, sort grades, depth, format,
  // assignment, indexing.
  // This is not full APL — it is a faithful flavor: enough to feel real.

  function aplTokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === '¯')) {
        let j = i;
        if (c === '¯') j++;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const num = s.slice(i, j).replace('¯', '-');
        out.push({ t: 'num', v: parseFloat(num) });
        i = j; continue;
      }
      if (/[A-Za-z]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        out.push({ t: 'id', v: s.slice(i, j) });
        i = j; continue;
      }
      if (c === "'") {
        let j = i + 1;
        while (j < s.length && s[j] !== "'") j++;
        out.push({ t: 'str', v: s.slice(i + 1, j) });
        i = j + 1; continue;
      }
      out.push({ t: 'op', v: c });
      i++;
    }
    return out;
  }

  function isVec(x) { return Array.isArray(x); }
  function asVec(x) { return isVec(x) ? x : [x]; }
  function scalarize(x) { return isVec(x) && x.length === 1 ? x[0] : x; }

  function aplApplyMonadic(op, w) {
    switch (op) {
      case '⍳': {
        const n = isVec(w) ? w[0] : w;
        return Array.from({ length: n }, (_, i) => i + 1);
      }
      case '⍴': return isVec(w) ? [w.length] : [];
      case '-': return isVec(w) ? w.map(v => -v) : -w;
      case '+': return w;
      case '×': return isVec(w) ? w.map(v => Math.sign(v)) : Math.sign(w);
      case '÷': return isVec(w) ? w.map(v => 1 / v) : 1 / w;
      case '⌈': return isVec(w) ? w.map(Math.ceil) : Math.ceil(w);
      case '⌊': return isVec(w) ? w.map(Math.floor) : Math.floor(w);
      case '|': return isVec(w) ? w.map(Math.abs) : Math.abs(w);
      case '*': return isVec(w) ? w.map(v => Math.exp(v)) : Math.exp(w);
      case '⍒': { const v = asVec(w).slice(); return v.map((_, i) => i + 1).sort((a, b) => v[b - 1] - v[a - 1]); }
      case '⍋': { const v = asVec(w).slice(); return v.map((_, i) => i + 1).sort((a, b) => v[a - 1] - v[b - 1]); }
      case '≡': return 1;
      case '⍕': return String(w);
      case '~': return isVec(w) ? w.map(v => v ? 0 : 1) : (w ? 0 : 1);
    }
    throw new Error('NONCE ERROR');
  }

  function pairwise(a, b, fn) {
    const va = asVec(a), vb = asVec(b);
    if (va.length === 1) return vb.map(v => fn(va[0], v));
    if (vb.length === 1) return va.map(v => fn(v, vb[0]));
    if (va.length !== vb.length) throw new Error('LENGTH ERROR');
    return va.map((v, i) => fn(v, vb[i]));
  }

  function aplApplyDyadic(op, a, w) {
    switch (op) {
      case '+': return scalarize(pairwise(a, w, (x, y) => x + y));
      case '-': return scalarize(pairwise(a, w, (x, y) => x - y));
      case '×': return scalarize(pairwise(a, w, (x, y) => x * y));
      case '÷': return scalarize(pairwise(a, w, (x, y) => x / y));
      case '*': return scalarize(pairwise(a, w, (x, y) => Math.pow(x, y)));
      case '⌈': return scalarize(pairwise(a, w, (x, y) => Math.max(x, y)));
      case '⌊': return scalarize(pairwise(a, w, (x, y) => Math.min(x, y)));
      case '|': return scalarize(pairwise(a, w, (x, y) => y % x));
      case '⍴': {
        const n = isVec(a) ? a[0] : a;
        const src = asVec(w);
        return Array.from({ length: n }, (_, i) => src[i % src.length]);
      }
      case '=': return scalarize(pairwise(a, w, (x, y) => (x === y ? 1 : 0)));
      case '≠': return scalarize(pairwise(a, w, (x, y) => (x !== y ? 1 : 0)));
      case '<': return scalarize(pairwise(a, w, (x, y) => (x < y ? 1 : 0)));
      case '>': return scalarize(pairwise(a, w, (x, y) => (x > y ? 1 : 0)));
      case '≤': return scalarize(pairwise(a, w, (x, y) => (x <= y ? 1 : 0)));
      case '≥': return scalarize(pairwise(a, w, (x, y) => (x >= y ? 1 : 0)));
      case ',': return [...asVec(a), ...asVec(w)];
    }
    throw new Error('NONCE ERROR');
  }

  function evalAPL(line, env) {
    if (!line.trim()) return null;
    // Assignment: NAME ← expr
    const assignIdx = line.indexOf('←');
    if (assignIdx >= 0) {
      const name = line.slice(0, assignIdx).trim();
      const val = evalAPLExpr(line.slice(assignIdx + 1).trim(), env);
      env[name] = val;
      return null; // no echo on assign
    }
    return evalAPLExpr(line, env);
  }

  // APL operator 字面集合（單元/雙元共用，由前後文決定身分）。
  const APL_OPS = '+-×÷*⌈⌊|⍳⍴⍒⍋≡⍕~=≠<>≤≥,';

  /**
   * 將 APL 表達式以「由右而左求值」策略求值。
   *
   * 演算法：先把 source tokens 折疊成「結點序列」——把連續 num token 合成 vector、
   * 把 `(...)` 子串遞迴求值成單一 value 結點，得到結點序列 `[ value | op, ... ]`。
   * 然後從序列尾端往前掃：
   *   - 維護「目前的右值 right」。
   *   - 遇到 op：若 op 左邊還有 value 結點，套 dyadic(op, left, right)；
   *     否則套 monadic(op, right）。結果回填為新的 right。
   *   - 遇到 value 結點：直接覆寫 right（前一個 right 應已被某 op 消費）。
   * 此實作對應 spec/apl-interpreter「由右而左求值」與「括號改變優先」的 scenarios
   * （例：`2 × 3 + 4 = 14`、`(2 × 3) + 4 = 10`）。
   *
   * @param {string} line - APL 表達式（不含賦值 `←`）
   * @param {object} env - APL 變數環境（id → value）
   * @returns {*} 求值結果（純量、向量、字串），或 null（空輸入）
   */
  function evalAPLExpr(line, env) {
    const toks = aplTokenize(line);
    if (toks.length === 0) return null;

    // ---------- step 1: 把 token 序列折疊成 nodes：value 結點 vs op 結點 ----------
    // value 結點：{ kind:'val', v: <scalar | vector | string> }
    // op 結點：    { kind:'op',  v: <glyph string> }
    const nodes = [];
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (t.t === 'num') {
        // 連續 num → vector strand。
        const vec = [t.v]; let j = i + 1;
        while (j < toks.length && toks[j].t === 'num') { vec.push(toks[j].v); j++; }
        nodes.push({ kind: 'val', v: vec.length === 1 ? vec[0] : vec });
        i = j; continue;
      }
      if (t.t === 'str') { nodes.push({ kind: 'val', v: t.v }); i++; continue; }
      if (t.t === 'id') {
        if (env[t.v] === undefined) throw new Error('VALUE ERROR');
        nodes.push({ kind: 'val', v: env[t.v] }); i++; continue;
      }
      if (t.t === 'op' && t.v === '(') {
        // 找對應 `)` 並遞迴求值括號內。
        let depth = 1, j = i + 1;
        while (j < toks.length && depth > 0) {
          if (toks[j].t === 'op' && toks[j].v === '(') depth++;
          else if (toks[j].t === 'op' && toks[j].v === ')') { depth--; if (depth === 0) break; }
          j++;
        }
        if (depth !== 0) throw new Error('SYNTAX ERROR');
        const inner = toks.slice(i + 1, j);
        // 將內部 tokens 還原為文字後遞迴。對 num 帶負值需以 `¯` 重新呈現以維持 APL 字面。
        const innerStr = inner.map((tt) => {
          if (tt.t === 'op') return tt.v;
          if (tt.t === 'num') return tt.v < 0 ? '¯' + String(-tt.v) : String(tt.v);
          if (tt.t === 'str') return "'" + tt.v + "'";
          return tt.v;
        }).join(' ');
        nodes.push({ kind: 'val', v: evalAPLExpr(innerStr, env) });
        i = j + 1; continue;
      }
      if (t.t === 'op' && APL_OPS.includes(t.v)) {
        nodes.push({ kind: 'op', v: t.v }); i++; continue;
      }
      // 未知 token：保留為 op 以便後續觸發 NONCE ERROR。
      nodes.push({ kind: 'op', v: t.v }); i++;
    }

    // ---------- step 2: 由右而左掃 nodes，套 monadic / dyadic ----------
    // 從 nodes[len-1] 起：先確立最右側的 right。若最右為 op（如 `⍳ 5` → ['op:⍳','val:5']）
    // 仍然從值開始累積。
    let idx = nodes.length - 1;
    if (nodes[idx].kind === 'op') {
      // 不合法：表達式不能以 op 結尾（例如 `5 +`）。
      // 但若整串只有一個 op（例如 lone `?`），交由後續 NONCE ERROR 流程。
      if (nodes.length === 1) throw new Error('NONCE ERROR');
      throw new Error('SYNTAX ERROR');
    }
    let right = nodes[idx].v;
    idx--;

    while (idx >= 0) {
      const node = nodes[idx];
      if (node.kind !== 'op') {
        // 兩個 value 相鄰（例如 `1 2 3 4`）已在 step 1 折疊；理論上不應發生。
        throw new Error('SYNTAX ERROR');
      }
      const op = node.v;
      // 看 op 左邊是否還有 value 結點。
      const left = idx - 1 >= 0 && nodes[idx - 1].kind === 'val' ? nodes[idx - 1].v : null;
      if (left !== null) {
        right = aplApplyDyadic(op, left, right);
        idx -= 2;
      } else {
        right = aplApplyMonadic(op, right);
        idx -= 1;
      }
    }
    return right;
  }

  function formatAPL(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(x => (typeof x === 'number' && !Number.isInteger(x)) ? x.toFixed(4) : String(x)).join(' ');
    return String(v);
  }

  const api = {
    makeBASICEnv,
    execImmediate,
    runProgram,
    evalAPL,
    formatAPL,
    tokenize,
  };

  // 雙環境匯出（design.md Decision 2）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.IBMTerm = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
