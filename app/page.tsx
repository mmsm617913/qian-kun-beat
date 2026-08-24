'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'gesture' | 'color' | 'number' | 'gestureColor';
type Phase = 'setup' | 'countdown' | 'demo' | 'formal-ready' | 'formal' | 'paused' | 'done';
type Item = { id: string; label: string; value: string; color?: string; side?: '左手' | '右手'; spriteColor?: number };

const BPMS = [60, 80, 100, 110, 120, 150];
const COUNTS = [4, 8, 10, 12, 20];
const ROUNDS = [1, 3, 5, 10];
const COLORS = [
  { label: '紅色', value: '紅', color: '#ef3340' }, { label: '藍色', value: '藍', color: '#2878c7' },
  { label: '綠色', value: '綠', color: '#43a047' }, { label: '黃色', value: '黃', color: '#ffb703' },
];
const GESTURES = [{ label: '剪刀', value: '✌️' }, { label: '石頭', value: '✊' }, { label: '布', value: '✋' }];

function randomSequence(mode: Mode, count: number): Item[] {
  const pool: Omit<Item, 'id'>[] = mode === 'gesture'
    ? (['左手', '右手'] as const).flatMap((side) => GESTURES.map((g) => ({ ...g, side })))
    : mode === 'gestureColor'
      ? (['左手', '右手'] as const).flatMap((side) => GESTURES.flatMap((g) => COLORS.map((c, colorIndex) => ({ ...g, side, color: c.color, spriteColor: colorIndex + 1 }))))
    : mode === 'color' ? COLORS : Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, value: `${i + 1}` }));
  const result: Item[] = [];
  for (let i = 0; i < count; i++) {
    let pick = pool[Math.floor(Math.random() * pool.length)];
    let attempts = 0;
    while (i > 1 && result[i - 1].label === pick.label && result[i - 2].label === pick.label && attempts++ < 12) pick = pool[Math.floor(Math.random() * pool.length)];
    result.push({ ...pick, id: `${Date.now()}-${i}-${Math.random()}` });
  }
  return result;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('gesture');
  const [bpm, setBpm] = useState(80);
  const [count, setCount] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<Item[]>(() => randomSequence('gesture', 8));
  const [phase, setPhase] = useState<Phase>('setup');
  const [index, setIndex] = useState(-1);
  const [countdown, setCountdown] = useState(3);
  const [muted, setMuted] = useState(false);
  const resumePhase = useRef<'demo' | 'formal'>('demo');
  const audioContext = useRef<AudioContext | null>(null);
  const melodyStep = useRef(0);

  const beat = useCallback((accent = false) => {
    if (muted) return;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext.current ??= new AudioCtor();
    const ctx = audioContext.current;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = accent ? 880 : 520;
    gain.gain.setValueAtTime(0.16, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.1);
  }, [muted, bpm]);

  const backingStep = useCallback(() => {
    if (muted) return;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext.current ??= new AudioCtor();
    const ctx = audioContext.current;
    if (ctx.state === 'suspended') void ctx.resume();
    const step = melodyStep.current++;
    const sixteenth = 60000 / bpm / 4000;
    const progressions = [
      [261.63, 329.63, 392.0], [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63], [196.0, 246.94, 293.66],
    ];
    const chord = progressions[Math.floor(step / 16) % progressions.length];
    const voice = (frequency: number, type: OscillatorType, duration: number, volume: number, delay = 0) => {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain).connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration + 0.03);
    };
    const kick = () => {
      const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(150, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.13);
      gain.gain.setValueAtTime(0.32, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.22);
    };
    const snare = () => {
      const duration = 0.13; const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const source = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1850; filter.Q.value = 0.65;
      gain.gain.setValueAtTime(0.17, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(ctx.destination); source.start();
      voice(185, 'triangle', 0.09, 0.065);
    };
    if (step % 4 === 0) kick();
    if (step % 16 === 4 || step % 16 === 12) snare();
    if (step % 16 === 0) {
      chord.forEach((note) => voice(note, 'sine', sixteenth * 14.5, 0.019));
      voice(chord[0] / 2, 'triangle', sixteenth * 3.4, 0.07);
    }
    const bassPattern = [0, 3, 8, 11];
    if (bassPattern.includes(step % 16)) voice(chord[(step % 16) >= 8 ? 2 : 0] / 2, 'triangle', sixteenth * 2.8, 0.055);
    if (step % 2 === 0) voice(chord[(step / 2) % 3] * 2, 'triangle', sixteenth * 1.45, 0.021);
    const leadPattern = [0, 2, 4, 7, 4, 2, 1, 2];
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
    if (step % 4 === 2) voice(scale[leadPattern[(step / 2) % leadPattern.length]], 'sine', sixteenth * 1.65, 0.017);
    if (step % 4 === 2) {
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.035)), ctx.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = ctx.createBufferSource(); const gain = ctx.createGain(); const filter = ctx.createBiquadFilter();
      source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 5200; gain.gain.value = 0.012;
      source.connect(filter).connect(gain).connect(ctx.destination); source.start();
    }
    if (step % 16 === 15) {
      [0, 1, 2].forEach((n) => voice(chord[n] * 2, 'triangle', sixteenth * 0.48, 0.024, n * sixteenth * 0.28));
    }
  }, [muted, bpm]);

  useEffect(() => {
    if (!['countdown', 'demo', 'formal'].includes(phase) || muted) return;
    backingStep();
    const timer = window.setInterval(backingStep, 60000 / bpm / 4);
    return () => window.clearInterval(timer);
  }, [phase, bpm, muted, backingStep]);

  const begin = useCallback((fresh = true) => {
    if (fresh) setSequence(randomSequence(mode, count));
    setRound(1); melodyStep.current = 0; setIndex(-1); setCountdown(3); setPhase('countdown');
  }, [mode, count]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    beat(countdown === 1);
    if (countdown === 0) { setIndex(0); setPhase('demo'); return; }
    const timer = window.setTimeout(() => setCountdown((v) => v - 1), 700);
    return () => window.clearTimeout(timer);
  }, [phase, countdown, beat]);

  useEffect(() => {
    if (phase !== 'demo' && phase !== 'formal') return;
    beat(index === 0);
    const timer = window.setTimeout(() => {
      if (index < sequence.length - 1) setIndex((v) => v + 1);
      else if (phase === 'demo') { setPhase('formal-ready'); setIndex(-1); }
      else if (round < rounds) {
        setRound((v) => v + 1); setSequence(randomSequence(mode, count)); setIndex(-1); setCountdown(3); setPhase('countdown');
      } else setPhase('done');
    }, 60000 / bpm);
    return () => window.clearTimeout(timer);
  }, [phase, index, sequence.length, bpm, beat, round, rounds, mode, count]);

  useEffect(() => {
    if (phase !== 'formal-ready') return;
    const timer = window.setTimeout(() => { setIndex(0); setPhase('formal'); }, 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const togglePause = useCallback(() => {
    if (phase === 'demo' || phase === 'formal') { resumePhase.current = phase; setPhase('paused'); }
    else if (phase === 'paused') setPhase(resumePhase.current);
  }, [phase]);
  const toggleFullscreen = useCallback(async () => { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); phase === 'setup' ? begin(true) : togglePause(); }
      if (event.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [phase, begin, togglePause, toggleFullscreen]);

  const visibleItems = useMemo(() => {
    const page = Math.max(0, Math.floor(Math.max(index, 0) / 8));
    return sequence.slice(page * 8, page * 8 + 8).map((item, localIndex) => ({ item, globalIndex: page * 8 + localIndex }));
  }, [sequence, index]);
  const phaseLabel = phase === 'demo' ? '示範回合' : phase === 'formal' ? '正式挑戰' : phase === 'paused' ? '已暫停' : '';
  const running = ['countdown', 'demo', 'formal', 'paused', 'formal-ready'].includes(phase);
  const spriteStyle = (item: Item) => {
    const row = item.label === '剪刀' ? 0 : item.label === '石頭' ? 50 : 100;
    const col = (item.spriteColor ?? 0) * 25;
    return {
      '--sprite-x': `${col}%`,
      '--sprite-y': `${row}%`,
      backgroundImage: "url('hand-sprites.png')",
    } as React.CSSProperties;
  };

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark" aria-label="月月"><span>☾</span></div><div><p className="eyebrow">節奏 × 反應 × 左右協調</p><h1>乾坤節奏王</h1></div>
      <div className="top-actions"><button className="icon-btn" onClick={() => setMuted((v) => !v)} aria-label={muted ? '開啟聲音' : '關閉聲音'}>{muted ? '🔇' : '🔊'}</button><button className="outline-btn" onClick={toggleFullscreen}>⛶ 全螢幕</button></div>
    </header>
    <section className="workspace">
      <aside className="settings" aria-label="遊戲設定">
        <div className="step-heading"><b>1</b><div><h2>選擇挑戰</h2><p>今天要練習什麼？</p></div></div>
        <div className="mode-grid">{([['gesture', '✌️', '手勢'], ['color', '●', '顏色'], ['number', '7', '數字'], ['gestureColor', '✋', '手勢＋顏色']] as const).map(([value, icon, label]) =>
          <button key={value} disabled={running} className={`mode-card ${mode === value ? 'selected' : ''}`} onClick={() => { setMode(value); setSequence(randomSequence(value, count)); }}><span className={`mode-icon ${value}`}>{icon}</span><strong>{label}</strong></button>)}</div>
        <div className="step-heading compact"><b>2</b><div><h2>速度 BPM</h2><p>選擇節拍速度</p></div></div>
        <div className="chip-row">{BPMS.map((value) => <button disabled={running} key={value} onClick={() => setBpm(value)} className={bpm === value ? 'active' : ''}>{value}</button>)}</div>
        <div className="step-heading compact"><b>3</b><div><h2>題目格數</h2><p>每回合的挑戰長度</p></div></div>
        <div className="chip-row count-row">{COUNTS.map((value) => <button disabled={running} key={value} onClick={() => { setCount(value); setSequence(randomSequence(mode, value)); }} className={count === value ? 'active' : ''}>{value}格</button>)}</div>
        <div className="step-heading compact"><b>4</b><div><h2>回合數</h2><p>選擇連續挑戰次數</p></div></div>
        <div className="chip-row count-row">{ROUNDS.map((value) => <button disabled={running} key={value} onClick={() => setRounds(value)} className={rounds === value ? 'active' : ''}>{value}回</button>)}</div>
        <button className="start-btn" disabled={running} onClick={() => begin(true)}>▶ 開始挑戰<span>{bpm} BPM・歡樂伴奏・{count}格・{rounds}回</span></button><p className="shortcut">空白鍵：開始／暫停　・　F：全螢幕</p>
      </aside>
      <section className="game-stage" aria-live="polite">
        <div className="stage-head"><div><span className={`status-dot ${phase}`}></span><strong>{phaseLabel || (phase === 'done' ? '挑戰完成' : '準備區')}</strong></div><div className="stats"><span>{mode === 'gesture' ? '手勢' : mode === 'color' ? '顏色' : mode === 'number' ? '數字' : '手勢＋顏色'}</span><span>{bpm} BPM</span><span>♫ 歡樂伴奏</span><span>第 {round} / {rounds} 回</span><span>{Math.max(index + 1, 0)} / {count}</span></div></div>
        <div className="stage-body">
          {phase === 'setup' && <div className="welcome"><div className="hands-preview"><span>✌️</span><span>✊</span><span>✋</span></div><h2>看準節拍，動動雙手！</h2><p>選好挑戰、速度和格數，就可以開始囉</p><div className="flow"><span>示範一次</span><i>→</i><span>正式挑戰</span><i>→</i><span>完成！</span></div></div>}
          {phase === 'countdown' && <div className="countdown"><p>準備</p><b>{countdown || 'GO!'}</b><span>跟著節拍一起來</span></div>}
          {phase === 'formal-ready' && <div className="round-banner formal"><span>示範完成</span><b>正式挑戰！</b></div>}
          {phase === 'done' && <div className="complete"><div className="trophy">★</div><h2>挑戰完成！</h2><p>節奏、反應、左右手都配合得很棒</p><div className="finish-actions"><button onClick={() => begin(false)}>同題再玩</button><button onClick={() => begin(true)}>新題挑戰</button><button onClick={() => { setPhase('setup'); setIndex(-1); }}>返回設定</button></div></div>}
          {(phase === 'demo' || phase === 'formal' || phase === 'paused') && <div className="track-wrap"><div className={`round-banner ${phase === 'formal' ? 'formal' : ''}`}><span>{phase === 'paused' ? '暫停中' : phase === 'demo' ? '先看一次，記住順序' : '換你挑戰，跟上節拍'}</span><b>{phaseLabel}</b></div><div className="track">{visibleItems.map(({ item, globalIndex }) =>
            <article key={item.id} className={`beat-card ${globalIndex === index ? 'current' : ''} ${globalIndex < index ? 'passed' : ''}`} style={{ '--card-color': item.color || '#2878c7' } as React.CSSProperties}><small>{globalIndex + 1}</small>
              {(mode === 'gesture' || mode === 'gestureColor') && <span aria-label={`${item.side}${item.label}`} className={`gesture-sprite ${item.side === '左手' ? 'left' : ''}`} style={spriteStyle(item)} />}
              {mode === 'color' && <span aria-label={item.label} className="color-shape" />}
              {mode === 'number' && <span aria-label={`數字${item.value}`} className="number-value">{item.value}</span>}
            </article>)}</div>{count > 8 && <p className="page-note">畫面分段顯示，避免題目過度擁擠</p>}</div>}
        </div>
        {phase !== 'setup' && phase !== 'done' && <div className="controls"><button onClick={togglePause}>{phase === 'paused' ? '▶ 繼續' : '⏸ 暫停'}</button><button onClick={() => begin(false)}>↻ 重新開始</button><button onClick={() => { setPhase('setup'); setIndex(-1); }}>← 返回設定</button></div>}
      </section>
    </section>
  </main>;
}

