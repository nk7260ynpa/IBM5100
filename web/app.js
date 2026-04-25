// Main React app for the IBN-5100-style terminal.
//
// 設計來源：design 原型 app.jsx；本檔保留所有 design 行為（BOOT_LINES、
// WHISPERS、DivergenceView 目標序列、ClockView、prompt 縮排、SET / setBuiltinMode 邏輯、
// idle whisper 機率 0.4、間隔 45 s）。
//
// 為符合 spec/easter-eggs「UI 字串不得出現 IBM」要求，原型首行註解的 `IBM 5100-style`
// 已替換為 `IBN-5100-style`；其餘字面字串（plate / boot / help / whisper / divergence /
// ClockView 標題等）原型已是 `IBN-5100`，未做變動。

const { useState, useEffect, useRef, useCallback } = React;

// ---------- helpers ----------
function pad2(n) { return String(n).padStart(2, '0'); }

const BOOT_LINES = [
  { delay: 200, text: 'IBN-5100  PORTABLE COMPUTER\n' },
  { delay: 220, text: 'SYSTEM ROM v3.14   (C) 1975-1979\n' },
  { delay: 280, text: '\n' },
  { delay: 200, text: 'POST .................. ' },
  { delay: 380, text: 'OK\n' },
  { delay: 200, text: 'CORE MEMORY ........... ' },
  { delay: 360, text: '65536 BYTES\n' },
  { delay: 200, text: 'CRT WARMUP ............ ' },
  { delay: 320, text: 'OK\n' },
  { delay: 200, text: 'TAPE DRIVE ............ ' },
  { delay: 320, text: 'READY\n' },
  { delay: 200, text: 'INTERPRETER ........... ' },
  { delay: 360, text: 'BASIC / APL\n' },
  { delay: 280, text: '\n' },
  { delay: 240, text: 'WORLD LINE ............ 1.130426\n' },
  { delay: 380, text: '\n' },
  { delay: 260, text: 'READY.\n' },
];

// Steins;Gate-flavored idle whispers (very rare, after long idle)
const WHISPERS = [
  '> EL PSY KONGROO',
  '> [SERN PACKET INTERCEPTED]',
  '> WORLD LINE DRIFT: 0.000048',
  '> 2010-08-21  AKIHABARA',
  '> CHANNEL OPEN',
];

// ---------- main app ----------
function App() {
  const [powerOn, setPowerOn] = useState(false);
  const [booting, setBooting] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [lines, setLines] = useState([]); // array of {kind:'text'|'input', value}
  const [inputBuf, setInputBuf] = useState('');
  const [mode, setMode] = useState('BASIC'); // BASIC or APL
  const [tape, setTape] = useState(null); // current loaded tape
  const [tapeMenuOpen, setTapeMenuOpen] = useState(false);
  const [tapeSpinning, setTapeSpinning] = useState(false);
  const [brightness, setBrightness] = useState(80); // 0..100
  const [contrast, setContrast] = useState(70);
  const [phosphor, setPhosphor] = useState('green'); // green | amber | white
  const [scanlines, setScanlines] = useState(12);
  const [audioOn, setAudioOn] = useState(true);
  const [pendingInput, setPendingInput] = useState(null); // resolver for INPUT
  const [busy, setBusy] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [builtinMode, setBuiltinMode] = useState(null); // 'clock' | 'divergence' | null
  const [now, setNow] = useState(new Date());
  const [divergence, setDivergence] = useState('1.130426');
  const [worldLineHover, setWorldLineHover] = useState(false);

  const basicEnvRef = useRef(null);
  const aplEnvRef = useRef({});
  const screenRef = useRef(null);
  const inputRef = useRef(null);
  const powerHumRef = useRef(null);
  const idleTimerRef = useRef(null);
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);

  // init basic env
  if (!basicEnvRef.current) basicEnvRef.current = window.IBMTerm.makeBASICEnv();

  // ---------- IO ----------
  const print = useCallback((text) => {
    setLines((prev) => [...prev, { kind: 'text', value: text }]);
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const askInput = useCallback((prompt) => {
    return new Promise((resolve) => {
      setLines((prev) => [...prev, { kind: 'text', value: prompt }]);
      setPendingInput(() => (val) => {
        setLines((prev) => [...prev, { kind: 'text', value: val + '\n' }]);
        resolve(val);
      });
    });
  }, []);

  const io = { print, clear, input: askInput };

  // ---------- POWER ----------
  const powerOnSeq = useCallback(async () => {
    if (powerOn || booting) return;
    window.IBMSound.init();
    setBooting(true);
    setPowerOn(true);
    setLines([]);
    setBuiltinMode(null);
    window.IBMSound.bootBeep();
    powerHumRef.current = window.IBMSound.powerHum();

    // CRT warm-up pause
    await new Promise(r => setTimeout(r, 600));

    // Boot lines
    let acc = '';
    for (const step of BOOT_LINES) {
      await new Promise(r => setTimeout(r, step.delay));
      acc += step.text;
      setLines([{ kind: 'text', value: acc }]);
    }
    setBooting(false);
    // focus input
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [powerOn, booting]);

  const powerOffSeq = useCallback(async () => {
    if (!powerOn) return;
    window.IBMSound.shutdownWhine();
    if (powerHumRef.current) { powerHumRef.current.stop(); powerHumRef.current = null; }
    window.IBMSound.tapeStop();
    setShuttingDown(true);
    await new Promise(r => setTimeout(r, 700));
    setPowerOn(false);
    setShuttingDown(false);
    setLines([]);
    setInputBuf('');
    setBuiltinMode(null);
    setPendingInput(null);
    setBusy(false);
    setTape(null);
    setTapeSpinning(false);
  }, [powerOn]);

  // ---------- INPUT HANDLING ----------
  const submit = useCallback(async () => {
    const line = inputBuf;
    setInputBuf('');

    // Currently waiting for INPUT statement?
    if (pendingInput) {
      const resolver = pendingInput;
      setPendingInput(null);
      resolver(line);
      return;
    }

    // Otherwise: command mode
    setLines((prev) => [...prev, { kind: 'text', value: prompt() + line + '\n' }]);
    if (!line.trim()) return;
    historyRef.current.unshift(line);
    historyIdxRef.current = -1;

    // Built-in commands
    const upper = line.trim().toUpperCase();
    if (upper === 'HELP' || upper === '?HELP') {
      print(HELP_TEXT);
      return;
    }
    if (upper === 'BASIC') { setMode('BASIC'); print('MODE: BASIC\n'); return; }
    if (upper === 'APL') { setMode('APL'); print('MODE: APL\n'); return; }
    if (upper === 'CLS' || upper === 'CLEAR') { clear(); return; }
    if (upper === 'EJECT') { ejectTape(); return; }
    if (upper === 'TAPES') {
      print('AVAILABLE TAPES:\n');
      for (const t of window.TAPES) print('  ' + t.label.padEnd(10) + t.desc + '\n');
      print('USE: LOAD <NAME>\n');
      return;
    }
    if (upper.startsWith('LOAD ')) {
      const name = line.trim().slice(5).toUpperCase();
      const t = window.TAPES.find(t => t.id === name || t.label.toUpperCase() === name);
      if (!t) { print('?TAPE NOT FOUND\n'); return; }
      await loadTape(t);
      return;
    }
    // Easter egg: EL PSY KONGROO
    if (upper === 'EL PSY KONGROO' || upper === 'EL PSY CONGROO') {
      print('\n');
      print('  CHANNEL VERIFIED.\n');
      print('  TRANSMISSION SECURE.\n');
      print('\n');
      print('  ...EL PSY KONGROO.\n\n');
      return;
    }
    if (upper === 'DIVERGENCE') {
      setBuiltinMode('divergence');
      return;
    }

    // Mode-specific execution
    setBusy(true);
    try {
      if (mode === 'BASIC') {
        await window.IBMTerm.execImmediate(line, basicEnvRef.current, io);
      } else {
        try {
          const result = window.IBMTerm.evalAPL(line, aplEnvRef.current);
          if (result !== null && result !== undefined) {
            print(window.IBMTerm.formatAPL(result) + '\n');
          }
        } catch (e) {
          print('?' + e.message + '\n');
        }
      }
    } finally {
      setBusy(false);
    }
  }, [inputBuf, pendingInput, mode, print, clear]);

  function prompt() { return mode === 'BASIC' ? '> ' : '      '; /* APL indents */ }

  const ejectTape = useCallback(() => {
    if (!tape) { print('NO TAPE LOADED\n'); return; }
    window.IBMSound.tapeStop();
    setTapeSpinning(false);
    setTape(null);
    setBuiltinMode(null);
    print('TAPE EJECTED.\n');
  }, [tape, print]);

  const loadTape = useCallback(async (t) => {
    if (tape) {
      window.IBMSound.tapeStop();
      print('UNLOADING ' + tape.label + '...\n');
      await new Promise(r => setTimeout(r, 300));
    }
    setTape(t);
    setTapeSpinning(true);
    window.IBMSound.tapeStart();
    print('LOADING ' + t.label + ' [' + t.desc + ']\n');
    // simulated read
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 320));
      print('....');
    }
    print(' OK\n');
    await new Promise(r => setTimeout(r, 200));
    window.IBMSound.tapeStop();
    setTapeSpinning(false);

    if (t.source === '__BUILTIN_CLOCK__') {
      setBuiltinMode('clock');
      return;
    }
    if (t.source === '__BUILTIN_DIVERGENCE__') {
      setBuiltinMode('divergence');
      // 初始世界線值（spec: 立即顯示 1.130426，後續由 useEffect 接管 glitch 動畫）
      setDivergence('1.130426');
      return;
    }

    // Load BASIC source into env
    basicEnvRef.current.program = {};
    const sourceLines = t.source.split('\n');
    for (const sl of sourceLines) {
      if (sl.trim()) {
        try { await window.IBMTerm.execImmediate(sl, basicEnvRef.current, io); }
        catch (e) {}
      }
    }
    print('TYPE  RUN  TO EXECUTE,  LIST  TO VIEW.\n');
  }, [tape, print, io]);

  // ---------- KEY HANDLING ----------
  useEffect(() => {
    if (!powerOn || booting) return;
    const onKey = (e) => {
      if (busy && !pendingInput) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (audioOn) window.IBMSound.key();
        submit();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setInputBuf((b) => b.slice(0, -1));
        if (audioOn) window.IBMSound.key();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = Math.min(historyRef.current.length - 1, historyIdxRef.current + 1);
        if (idx >= 0 && historyRef.current[idx] !== undefined) {
          historyIdxRef.current = idx;
          setInputBuf(historyRef.current[idx]);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = historyIdxRef.current - 1;
        if (idx >= 0) { historyIdxRef.current = idx; setInputBuf(historyRef.current[idx]); }
        else { historyIdxRef.current = -1; setInputBuf(''); }
        return;
      }
      if (e.key === 'Escape') {
        if (builtinMode) { setBuiltinMode(null); return; }
        setInputBuf('');
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // APL glyph mapping when in APL mode + key with backtick prefix not implemented;
        // we just uppercase BASIC and pass through APL.
        const ch = mode === 'BASIC' ? e.key.toUpperCase() : e.key;
        setInputBuf((b) => b + ch);
        if (audioOn) window.IBMSound.key();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [powerOn, booting, busy, pendingInput, mode, submit, audioOn, builtinMode]);

  // Click anywhere to focus input
  useEffect(() => {
    const onClick = () => inputRef.current?.focus();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = screenRef.current.scrollHeight;
  }, [lines, inputBuf]);

  // Clock
  useEffect(() => {
    if (builtinMode !== 'clock') return;
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, [builtinMode]);

  // Divergence flicker
  useEffect(() => {
    if (builtinMode !== 'divergence') return;
    const targets = ['1.130426', '0.571024', '1.048596', '0.337187', '0.523299', '1.130205'];
    let i = 0;
    const id = setInterval(() => {
      // glitch-flicker between values
      const glitch = Array.from({length: 8}, () => Math.floor(Math.random()*10)).join('').slice(0,7);
      const formatted = glitch.slice(0,1) + '.' + glitch.slice(1,7);
      setDivergence(formatted);
      setTimeout(() => setDivergence(targets[i % targets.length]), 80);
      i++;
    }, 2400);
    return () => clearInterval(id);
  }, [builtinMode]);

  // Idle whispers
  useEffect(() => {
    if (!powerOn || booting || busy || builtinMode) return;
    const tid = setTimeout(() => {
      if (Math.random() < 0.4) {
        const w = WHISPERS[Math.floor(Math.random()*WHISPERS.length)];
        // print very dimly — single line, will fade with the rest
        print(w + '\n');
      }
    }, 45000);
    return () => clearTimeout(tid);
  }, [powerOn, booting, busy, builtinMode, lines, print]);

  // Apply CSS variables for tweaks
  useEffect(() => {
    const root = document.documentElement;
    const palettes = {
      green: { main: '#7fff5a', dim: 'rgba(127, 255, 90, 0.55)', faint: 'rgba(127, 255, 90, 0.22)', glow: 'rgba(127, 255, 90, 0.85)', bg: '#050b07' },
      amber: { main: '#ffb060', dim: 'rgba(255, 176, 96, 0.55)', faint: 'rgba(255, 176, 96, 0.22)', glow: 'rgba(255, 176, 96, 0.9)', bg: '#0b0703' },
      white: { main: '#e8eef0', dim: 'rgba(232, 238, 240, 0.55)', faint: 'rgba(232, 238, 240, 0.22)', glow: 'rgba(232, 238, 240, 0.9)', bg: '#06080a' },
    };
    const p = palettes[phosphor];
    root.style.setProperty('--phosphor', p.main);
    root.style.setProperty('--phosphor-dim', p.dim);
    root.style.setProperty('--phosphor-faint', p.faint);
    root.style.setProperty('--phosphor-glow', p.glow);
    root.style.setProperty('--bg-screen', p.bg);
    root.style.setProperty('--scanline-strength', String(scanlines / 100));
  }, [phosphor, scanlines]);

  // Audio toggle propagation
  useEffect(() => { window.IBMSound.setEnabled(audioOn); }, [audioOn]);

  // Compose displayed text
  const fullText = lines.map(l => l.value).join('');

  return (
    <div className="machine">
      <div className="bezel">
        <div className="plate">
          <span className="model">IBN · 5100</span>
          <span className="serial">PORTABLE COMPUTER · S/N 042-5100-A</span>
        </div>
        <div className="plate-right">
          <span>RAM 64K</span>
          <span>BASIC · APL</span>
          <span>FUTURE GADGET LAB</span>
        </div>

        <div className="crt-cabinet">
          <div className={`crt ${powerOn ? '' : 'off'} ${booting ? 'booting' : ''} ${shuttingDown ? 'shutting' : ''}`}
               style={{ filter: `brightness(${0.5 + brightness/200}) contrast(${0.6 + contrast/150})` }}>
            <div className="screen" ref={screenRef}>
              {builtinMode === 'clock' ? (
                <ClockView now={now} tape={tape} />
              ) : builtinMode === 'divergence' ? (
                <DivergenceView value={divergence} />
              ) : (
                <>
                  <pre style={{ margin: 0, font: 'inherit', color: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{fullText}</pre>
                  {!busy && !pendingInput && powerOn && !booting && (
                    <span><span className="mode-pill">{mode}</span>{prompt()}{inputBuf}<span className="cursor" /></span>
                  )}
                  {pendingInput && (
                    <span>{inputBuf}<span className="cursor" /></span>
                  )}
                  {busy && <span><span className="cursor" /></span>}
                </>
              )}
              <input
                ref={inputRef}
                value=""
                onChange={() => {}}
                autoFocus
              />
            </div>
            <div className="scanlines" />
            <div className="sweep" />
            <div className="flicker" />
            <div className="glare" />
          </div>
        </div>

        <div className="controls">
          <PowerSwitch on={powerOn} onToggle={() => powerOn ? powerOffSeq() : powerOnSeq()} />
          <div className="knob-group">
            <Knob value={brightness} onChange={(v) => { setBrightness(v); window.IBMSound.knob(); }} />
            <span className="knob-label">BRIGHT</span>
          </div>
          <div className="knob-group">
            <Knob value={contrast} onChange={(v) => { setContrast(v); window.IBMSound.knob(); }} />
            <span className="knob-label">CONTRAST</span>
          </div>
          <div className="knob-group">
            <span className={`led ${powerOn ? 'on' : ''}`} />
            <span className="knob-label">PWR</span>
            <span className={`led green ${powerOn && !busy ? 'on' : ''}`} />
            <span className="knob-label">RDY</span>
            <span className={`led amber ${tapeSpinning ? 'on' : ''}`} />
            <span className="knob-label">TAPE</span>
          </div>

          <div className="tape-deck">
            <div className="namebadge">CARTRIDGE</div>
            <div className="tape-slot" onClick={() => powerOn && setTapeMenuOpen(v => !v)}>
              {tape ? (
                <div className="tape-cart">
                  <div className={`tape-reel ${tapeSpinning ? 'spin' : ''}`} />
                  <span>{tape.label}</span>
                  <div className={`tape-reel ${tapeSpinning ? 'spin' : ''}`} />
                </div>
              ) : (
                <div className="tape-cart empty">— EMPTY —</div>
              )}
              {tapeMenuOpen && powerOn && (
                <div className="tape-menu" onClick={(e) => e.stopPropagation()}>
                  <h4>SELECT CARTRIDGE</h4>
                  {window.TAPES.map(t => (
                    <div key={t.id} className="tape-item" onClick={() => { setTapeMenuOpen(false); loadTape(t); }}>
                      <span>{t.label} <span style={{color:'#524a3f'}}>· SIDE {t.side}</span></span>
                      <span className="desc">{t.desc}</span>
                    </div>
                  ))}
                  {tape && (
                    <div className="tape-item eject" onClick={() => { setTapeMenuOpen(false); ejectTape(); }}>
                      ▲  EJECT  {tape.label}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hint">
          {!powerOn ? 'FLIP POWER SWITCH TO BEGIN' :
           booting ? '' :
           'TYPE  HELP  ·  TAPES  ·  BASIC / APL  ·  CLS'}
        </div>
      </div>

      <Tweaks
        phosphor={phosphor} setPhosphor={setPhosphor}
        scanlines={scanlines} setScanlines={setScanlines}
        audioOn={audioOn} setAudioOn={setAudioOn}
      />
    </div>
  );
}

const HELP_TEXT = `
COMMANDS:
  HELP            SHOW THIS MESSAGE
  CLS             CLEAR THE SCREEN
  TAPES           LIST AVAILABLE CARTRIDGES
  LOAD <NAME>     LOAD A TAPE INTO MEMORY
  EJECT           REMOVE CURRENT TAPE
  BASIC           SWITCH TO BASIC MODE
  APL             SWITCH TO APL MODE
  RUN  /  LIST    EXECUTE / VIEW LOADED PROGRAM
  NEW             ERASE PROGRAM IN MEMORY

BASIC EXAMPLE:
  10 FOR I = 1 TO 5
  20 PRINT I, I*I
  30 NEXT I
  RUN

APL EXAMPLE:
  +/⍳10
  3 1 4 1 5 9 2 6
  ⍳ 8

`;

// ---------- Sub components ----------

function PowerSwitch({ on, onToggle }) {
  return (
    <div className={`power-switch ${on ? 'on' : ''}`} onClick={onToggle} title="POWER">
      <div className="slide" />
    </div>
  );
}

function Knob({ value, onChange }) {
  const startRef = useRef(null);
  const onPointerDown = (e) => {
    e.preventDefault();
    startRef.current = { y: e.clientY, v: value };
    const move = (ev) => {
      const dy = startRef.current.y - ev.clientY;
      const nv = Math.max(0, Math.min(100, startRef.current.v + dy));
      onChange(Math.round(nv));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const rot = -135 + (value / 100) * 270;
  return <div className="knob" style={{ '--rot': rot + 'deg' }} onPointerDown={onPointerDown} />;
}

function ClockView({ now, tape }) {
  const h = pad2(now.getHours());
  const m = pad2(now.getMinutes());
  const s = pad2(now.getSeconds());
  const d = now;
  const dateStr = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const day = ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()];
  return (
    <div>
      <div style={{textAlign:'center', letterSpacing:'0.3em', color:'var(--phosphor-dim)', marginTop:'24px'}}>
        — REAL-TIME CLOCK · CARTRIDGE {tape?.label || ''} —
      </div>
      <div className="bigclock">
        {h}<span className="colon">:</span>{m}<span className="colon">:</span>{s}
      </div>
      <div className="bigclock-date">{dateStr}  ·  {day}</div>
      <div style={{textAlign:'center', marginTop:'40px', color:'var(--phosphor-faint)', letterSpacing:'0.2em', fontSize:'14px'}}>
        PRESS  ESC  TO RETURN TO TERMINAL
      </div>
    </div>
  );
}

function DivergenceView({ value }) {
  return (
    <div>
      <div style={{textAlign:'center', letterSpacing:'0.4em', color:'var(--phosphor-dim)', marginTop:'40px', fontSize:'16px'}}>
        — DIVERGENCE METER · ∂.404 —
      </div>
      <div className="divergence">{value}</div>
      <div className="divergence-label">WORLD LINE</div>
      <div style={{textAlign:'center', marginTop:'40px', color:'var(--phosphor-faint)', letterSpacing:'0.2em', fontSize:'14px'}}>
        EL PSY KONGROO · PRESS ESC TO RETURN
      </div>
    </div>
  );
}

function Tweaks({ phosphor, setPhosphor, scanlines, setScanlines, audioOn, setAudioOn }) {
  return (
    <TweaksPanel title="TWEAKS">
      <TweakSection title="PHOSPHOR">
        <TweakRadio
          value={phosphor}
          onChange={setPhosphor}
          options={[
            { value: 'green', label: 'P1 GREEN' },
            { value: 'amber', label: 'P3 AMBER' },
            { value: 'white', label: 'P4 WHITE' },
          ]}
        />
      </TweakSection>
      <TweakSection title="DISPLAY">
        <TweakSlider label="SCANLINES" value={scanlines} onChange={setScanlines} min={0} max={80} />
      </TweakSection>
      <TweakSection title="AUDIO">
        <TweakToggle label="SOUND FX" value={audioOn} onChange={setAudioOn} />
      </TweakSection>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
