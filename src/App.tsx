import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';

type Phase = 'intro' | 'team-select' | 'play' | 'steal' | 'reveal' | 'round-end' | 'round3-end' | 'game-end';
type Team = 'A' | 'B';

const DATA = [
  {
    question: "Bạn cảm thấy không an toàn, bị ép buộc hoặc lo sợ trước hành vi của ai đó. Bạn ưu tiên làm gì nhất?",
    answers: [
      { text: 'Tìm cách rời đi ngay', points: 35 },
      { text: 'Nhắn tin/Gọi điện cầu cứu', points: 25 },
      { text: 'Đến chỗ đông người/sáng đèn', points: 15 },
      { text: 'Kiên quyết nói "Không"', points: 10 },
      { text: 'Cố ý gây sự chú ý', points: 8 },
      { text: 'Cầm sẵn vật phòng thân/điện thoại', points: 7 },
    ]
  },
  {
    question: "Lý do chính khiến người ngoài cuộc không can thiệp vụ quấy rối?",
    answers: [
      { text: 'Sợ rước họa/bị trả thù', points: 35 },
      { text: 'Nghĩ người khác sẽ giúp', points: 25 },
      { text: 'Tưởng là chuyện riêng/cãi nhau', points: 15 },
      { text: 'Không biết cách can thiệp an toàn', points: 10 },
      { text: 'Ngại phiền phức', points: 8 },
      { text: 'Sợ nạn nhân phản ứng ngược', points: 7 },
    ]
  },
  {
    question: "Bạn bè khóc lóc kể bị xâm hại, họ cần nhất điều gì ở bạn?",
    answers: [
      { text: 'Lắng nghe, không phán xét', points: 35 },
      { text: 'Tin tưởng, không đổ lỗi', points: 25 },
      { text: 'Giữ bí mật tuyệt đối', points: 15 },
      { text: 'Hỏi họ cần gì', points: 12 },
      { text: 'Gợi ý gọi Tổng đài 111/chuyên gia', points: 8 },
      { text: 'Đưa đến nơi an toàn', points: 5 },
    ]
  }
];

function isRound3(idx: number) { return idx === DATA.length - 1; }

export default function App() {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [scores, setScores] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);   // main team r1-r2
  const [roundPoints, setRoundPoints] = useState(0);                  // accumulated r1-r2
  const [revealed, setRevealed] = useState<boolean[]>(Array(6).fill(false));
  const [strikes, setStrikes] = useState(0);                          // r1-r2 strikes

  // Round 3
  const [r3StrikesA, setR3StrikesA] = useState(0);
  const [r3StrikesB, setR3StrikesB] = useState(0);
  const [r3ActiveTeam, setR3ActiveTeam] = useState<Team | null>(null);

  // Per-round scores for game-end summary
  const [roundScores, setRoundScores] = useState<{ A: number; B: number }[]>([]);

  const stateRef = useRef({ phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores, r3StrikesA, r3StrikesB, r3ActiveTeam });
  useEffect(() => {
    stateRef.current = { phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores, r3StrikesA, r3StrikesB, r3ActiveTeam };
  });

  // ─── Audio ────────────────────────────────────────────────────────
  const audiosRef = useRef<{ [k: string]: HTMLAudioElement }>({});
  useEffect(() => {
    audiosRef.current = {
      ding: new Audio('https://www.myinstants.com/media/sounds/family-feud-good-answer.mp3'),
      strike: new Audio('https://www.myinstants.com/media/sounds/family-feud-strike-sfx_kN6Z99k.mp3'),
      win: new Audio('https://www.myinstants.com/media/sounds/family-feud-win-sound-effect.mp3'),
    };
    Object.values(audiosRef.current).forEach(a => (a as HTMLAudioElement).load());
  }, []);

  const playSound = useCallback((type: 'ding' | 'strike' | 'win') => {
    try {
      const a = audiosRef.current[type];
      if (a) { const c = a.cloneNode() as HTMLAudioElement; c.play().catch(() => { }); }
    } catch { }
  }, []);

  // ─── R3: select answering team ────────────────────────────────────
  const handleR3TeamPick = useCallback((team: Team) => {
    setR3ActiveTeam(team);
  }, []);

  // ─── FLIP ANSWER ──────────────────────────────────────────────────
  const handleFlip = useCallback((i: number) => {
    const s = stateRef.current;
    if (s.revealed[i]) return;
    const canFlip = s.phase === 'play' || s.phase === 'steal' || s.phase === 'reveal';
    if (!canFlip) return;
    // r3: must have picked a team first
    if (isRound3(s.currentRoundIdx) && s.r3ActiveTeam === null) return;

    playSound('ding');
    const newRevealed = [...s.revealed];
    newRevealed[i] = true;
    setRevealed(newRevealed);

    if (isRound3(s.currentRoundIdx)) {
      // ── Round 3 scoring ──
      const scoringTeam = s.r3ActiveTeam!;
      setScores(prev => {
        const roundData = DATA[s.currentRoundIdx];
        return { ...prev, [scoringTeam as Team]: prev[scoringTeam as Team] + roundData.answers[i].points };
      });

      // End round3 if all revealed
      if (newRevealed.every(x => x)) {
        setTimeout(() => setPhase('round3-end'), 1200);
      } else {
        // Deselect team after a correct answer
        setR3ActiveTeam(null);
      }
    } else if (s.phase === 'play') {
      // ── Rounds 1-2: main team accumulates ──
      const newPts = s.roundPoints + DATA[s.currentRoundIdx].answers[i].points;
      setRoundPoints(newPts);
      // (round-end is handled by useEffect watching allRevealed + phase === 'reveal')
    } else if (s.phase === 'steal') {
      // ── Steal correct: x2 cell points → stealing team only ──
      const cellPts = DATA[s.currentRoundIdx].answers[i].points * 2;
      const stealingTeam = s.activeTeam === 'A' ? 'B' : 'A';
      setScores(prev => ({ ...prev, [stealingTeam]: prev[stealingTeam] + cellPts }));
      // Continue to reveal phase — don't end round
      setPhase('reveal');
    }
  }, [playSound]);

  // ─── STRIKE ───────────────────────────────────────────────────────
  const handleStrike = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'play' && s.phase !== 'steal') return;

    playSound('strike');

    if (isRound3(s.currentRoundIdx)) {
      // ── Round 3 strikes — per team ──
      const targetTeam = s.r3ActiveTeam ?? s.activeTeam!;
      if (targetTeam === 'A') {
        const n = s.r3StrikesA + 1;
        setR3StrikesA(n);
        if (n >= 3 && s.r3StrikesB >= 3) {
          setTimeout(() => setPhase('round3-end'), 800);
        }
      } else {
        const n = s.r3StrikesB + 1;
        setR3StrikesB(n);
        if (n >= 3 && s.r3StrikesA >= 3) {
          setTimeout(() => setPhase('round3-end'), 800);
        }
      }
      setR3ActiveTeam(null);
    } else if (s.phase === 'play') {
      // ── Rounds 1-2 strikes ──
      setStrikes(prev => {
        const n = prev + 1;
        if (n === 3) setTimeout(() => setPhase('steal'), 400);
        return n;
      });
    } else if (s.phase === 'steal') {
      // ── Steal wrong: nothing happens, go to reveal ──
      setPhase('reveal');
    }
  }, [playSound]);

  // ─── PICK MAIN TEAM (r1-r2) ───────────────────────────────────────
  const handleTeamSelect = useCallback((team: Team) => {
    setActiveTeam(team);
    setPhase('play');
  }, []);

  // ─── START GAME ───────────────────────────────────────────────────
  const handleStart = useCallback(() => setPhase('team-select'), []);

  // ─── NEXT ROUND ───────────────────────────────────────────────────
  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.currentRoundIdx < DATA.length - 1) {
      const nextIdx = s.currentRoundIdx + 1;
      if (isRound3(nextIdx)) {
        // Enter Round 3
        setCurrentRoundIdx(nextIdx);
        setRevealed(Array(6).fill(false));
        setR3StrikesA(0);
        setR3StrikesB(0);
        setR3ActiveTeam(null);
        setRoundPoints(0);
        setPhase('play');
      } else {
        // Next round 1-2
        setCurrentRoundIdx(nextIdx);
        setRevealed(Array(6).fill(false));
        setStrikes(0);
        setRoundPoints(0);
        setActiveTeam(null);
        setPhase('team-select');
      }
    }
  }, []);

  // ─── DERIVED ──────────────────────────────────────────────────────
  const currentRound = DATA[currentRoundIdx];
  const r3 = isRound3(currentRoundIdx);
  const stealingTeam = activeTeam === 'A' ? 'B' : (activeTeam === 'B' ? 'A' : null);
   const allRevealed = revealed.every(Boolean);
  const showBottomBar = phase !== 'intro' && phase !== 'round-end' && phase !== 'round3-end';

  // ─── AUTO-ADVANCE: khi lật hết 6 ô trong reveal → sang round-end ───
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (!allRevealed) return;
    // Tự động cộng điểm tích lũy cho đội chơi chính nếu chưa cộng
    if (!r3 && roundPoints > 0 && activeTeam) {
      setScores(prev => ({ ...prev, [activeTeam]: prev[activeTeam] + roundPoints }));
    }
    // Chuyển sang round-end sau 1.5s để người xem thấy hết đáp án
    const timer = setTimeout(() => setPhase('round-end'), 1500);
    return () => clearTimeout(timer);
  }, [phase, allRevealed, r3, roundPoints, activeTeam]);

  // ─── SAVE round scores → game-end ─────────────────────────────────
  const toGameEnd = useCallback(() => {
    setRoundScores(prev => {
      if (prev.length > currentRoundIdx) return prev;
      return [...prev, { A: scores.A, B: scores.B }];
    });
    setPhase('game-end');
    playSound('win');
  }, [currentRoundIdx, scores, playSound]);

  // ─── KEYBOARD ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      const s = stateRef.current;

      if (['1', '2', '3', '4', '5', '6'].includes(k)) { handleFlip(parseInt(k) - 1); return; }
      if (k === 'x' || k === ' ') { e.preventDefault(); handleStrike(); return; }
      if (k === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { });
        else document.exitFullscreen().catch(() => { });
        return;
      }
      if (s.phase === 'team-select') { if (k === 'a') handleTeamSelect('A'); if (k === 'b') handleTeamSelect('B'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFlip, handleStrike, handleTeamSelect]);



  // Floating status badge for room screen
  function statusBadge() {
    if (phase === 'game-end' || phase === 'intro') return null;
    const isStealPhase = phase === 'steal';
    const base  = "absolute top-[6px] sm:top-3 left-1/2 -translate-x-1/2 z-30 shrink-0 max-w-[90vw] text-center px-2 sm:px-3 md:px-6 lg:px-8 py-1 sm:py-1.5 md:py-2.5 lg:py-3 rounded-lg sm:rounded-xl md:rounded-2xl font-black uppercase tracking-wider border";
    const r3Cls = base + " bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-400/40";
    const stCls   = base + " bg-gradient-to-r from-red-600 to-red-700 text-white border-2 sm:border-3 md:border-4 border-red-400/40 shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse";
    const defCls  = base + " bg-white/10 border-white/20";
    // Reduce text size on steal badge on mobile — it has extra emoji chars
    const txtMobile = isStealPhase ? "text-[9px]" : "text-[11px]";
    const fullR3  = `${r3Cls} ${txtMobile} sm:text-xs md:text-sm lg:text-base truncate`;
    const fullSt  = `${stCls} ${txtMobile} sm:text-xs md:text-sm lg:text-base truncate`;
    const fullDef = `${defCls} ${txtMobile} sm:text-xs md:text-sm lg:text-base truncate`;
    if (r3) {
      return (<div className={fullR3}>VÒNG 3 — LUÂN PHIÊN</div>);
    }
    if (isStealPhase) {
      return (<div className={fullSt}>🔥 CƯỚP ĐIỂM — ĐỘI {stealingTeam}</div>);
    }
    if (phase === 'team-select') {
      return (<div className={fullDef}>VÒNG {currentRoundIdx + 1} — CHỌN ĐỘI BẮT ĐẦU</div>);
    }
    return (<div className={fullDef}>VÒNG {currentRoundIdx + 1} — ĐỘI {activeTeam ?? '?'} ĐANG CHƠI</div>);
  }

  // ─── WIN SCREEN ───────────────────────────────────────────────────
  if (phase === 'game-end') {
    const winner = scores.A > scores.B ? 'ĐỘI A' : scores.B > scores.A ? 'ĐỘI B' : 'HÒA';
    return (
      <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="text-6xl md:text-8xl text-[#eab308] font-black drop-shadow-[0_0_20px_rgba(234,179,8,0.6)] uppercase tracking-wider mb-8">CHUNG CUỘC</div>
        <div className="text-5xl md:text-7xl font-black text-white animate-pulse drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] tracking-wider mb-12 border-4 border-white/20 px-12 py-6 rounded-full bg-white/5">
          {winner === 'HÒA' ? 'TRẬN HÒA!' : `${winner} CHIẾN THẮNG!`}
        </div>
        <div className="flex gap-8 md:gap-16 mb-10">
          <div className="text-center">
            <div className="text-xl md:text-2xl text-white/70 uppercase tracking-widest mb-2">Đội A</div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black">{scores.A.toLocaleString()}</div>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <div className="text-xl md:text-2xl text-white/70 uppercase tracking-widest mb-2">Đội B</div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black">{scores.B.toLocaleString()}</div>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[6px] border-[#713f12] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-black px-10 py-4 md:px-14 md:py-5 uppercase text-xl md:text-2xl font-black rounded-2xl cursor-pointer transition-all shadow-[0_10px_30px_rgba(234,179,8,0.4)]">
          CHƠI LẠI TỪ ĐẦU
        </button>
      </div>
    );
  }

  // ─── INTRO ────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.15)_0%,transparent_70%)] pointer-events-none" />
        <h1 className="text-[min(12vw,120px)] text-[#eab308] font-black tracking-widest uppercase drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">CHUNG SỨC</h1>
        <button onClick={handleStart}
          className="z-10 bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[8px] border-[#713f12] active:border-b-0 active:translate-y-[8px] hover:brightness-110 text-black px-16 py-6 uppercase text-3xl font-black rounded-3xl cursor-pointer transition-all shadow-[0_10px_30px_rgba(234,179,8,0.4)]">
          BẮT ĐẦU CHƠI
        </button>
      </div>
    );
  }

  // RENDERING ─────────────────────────────────────────────────────────
  // Phases that show game board
  const showBoard = phase !== 'game-end' && phase !== 'round-end' && phase !== 'round3-end';

  return (
    <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      {statusBadge()}

      {showBoard && (
        <div className="flex flex-col h-full w-full max-w-[1800px] mx-auto px-2 sm:px-3 md:px-4">
          {/* spacer for absolute status badge */}
          <div className="h-5 sm:h-6 md:h-8 lg:h-9 shrink-0" />
          {/* Question */}
          <div className="w-full border-[2.5px] border-[#eab308] bg-gradient-to-b from-[#0a1930] to-[#01081a] rounded-2xl md:rounded-3xl p-2.5 sm:p-3 md:p-5 lg:p-6 mb-1.5 sm:mb-2 md:mb-3 text-center shadow-[0_3px_16px_rgba(234,179,8,0.18)] flex-shrink-0">
            <h1 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-white font-black uppercase tracking-wide leading-[1.25] md:leading-[1.3] max-w-full px-0.5 sm:px-1">{currentRound.question}</h1>
            {phase !== 'team-select' && (
              <div className="flex items-center justify-center bg-black/80 border-2 border-[#eab308]/50 rounded-lg md:rounded-xl px-3 sm:px-4 md:px-6 py-1 sm:py-1.5 md:py-2 shadow-[0_2px_8px_rgba(0,0,0,0.5)] mt-2 sm:mt-2.5 md:mt-3 shrink-0">
                <span className="text-[#eab308] text-[9px] sm:text-[10px] md:text-xs uppercase tracking-[1px] md:tracking-[2px] lg:tracking-[3px] font-black mr-2 sm:mr-3 md:mr-4 shrink-0">ĐIỂM</span>
                <span className="font-mono text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-[#eab308] font-black leading-none shrink-0">{roundPoints}</span>
              </div>
            )}
          </div>

          {/* ── Strikes r1-r2 ── */}
          {(phase === 'play' || phase === 'steal') && !r3 && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 md:mb-3 flex-shrink-0">
              {[0, 1, 2].map(i => (
                <div key={i}
                  className={`w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 lg:w-12 lg:h-12 border-[2.5px] md:border-[3px] rounded-lg md:rounded-xl flex items-center justify-center font-bold transition-all duration-300 shrink-0
                    ${i < strikes ? 'border-[#ff0000] text-[#ff0000] bg-[#600000] shadow-[0_0_12px_#ff0000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                  <X strokeWidth={5} className="w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </div>
              ))}
              <span className="text-white/80 text-xs sm:text-sm font-bold tracking-wider ml-1 shrink-0">({strikes}/3)</span>
            </div>
          )}

          {/* ── Strikes r3 — dual ── */}
          {r3 && (phase === 'play' || phase === 'steal') && (
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-2 md:mb-3 flex-shrink-0 flex-wrap">
              {(['A', 'B'] as const).map(team => {
                const sc = team === 'A' ? r3StrikesA : r3StrikesB;
                return (
                  <div key={team} className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-white/70 text-xs sm:text-sm uppercase mr-0.5 shrink-0">Đội {team}:</span>
                    {[0, 1, 2].map(i => (
                      <div key={i}
                        className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 border-[2px] md:border-[2.5px] rounded flex items-center justify-center transition-all duration-300 shrink-0
                          ${i < sc ? 'border-[#ff0000] text-[#ff0000] bg-[#600000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                        <X strokeWidth={4} className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-5 md:h-5" />
                      </div>
                    ))}
                    <span className="text-red-400 text-xs font-bold ml-0.5 shrink-0">({sc}/3)</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── R1-2 reveal hint ── */}
          {!r3 && phase === 'reveal' && !allRevealed && (
            <div className="text-center text-[#eab308] text-xs sm:text-sm md:text-base font-black uppercase tracking-widest mb-2 animate-pulse flex-shrink-0">
              Lật hết đáp án còn lại để sang vòng mới
            </div>
          )}

          {/* ── Answer grid ── */}
          <div className="grid grid-cols-2 w-full flex-1 min-h-[80px] md:min-h-[180px] mb-2 md:mb-4 gap-y-[6px] sm:gap-y-2 md:gap-y-3 gap-x-2 sm:gap-x-3 md:gap-x-4 lg:gap-x-6">
            {currentRound.answers.map((ans, i) => {
              const exposed = phase === 'reveal' || phase === 'round-end' || phase === 'round3-end' || revealed[i];
              return (
                <div key={i} className="relative w-full h-[52px] sm:h-[56px] md:h-auto min-h-[52px]"
                   onClick={() => {
                     if (revealed[i]) return;
                     if (!(phase === 'play' || phase === 'steal' || phase === 'reveal')) return;
                     if (r3 && r3ActiveTeam === null) return;
                     handleFlip(i);
                   }}>
                  <motion.div
                    className="w-full h-full relative preserve-3d"
                    animate={{ rotateX: exposed ? 180 : 0 }}
                    transition={{ duration: 0.45, type: "spring", bounce: 0.3 }}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] border-[2.5px] md:border-[3px] lg:border-[4px] border-[#eab308] rounded-lg md:rounded-xl flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                      {!exposed && (
                        <div className="bg-gradient-to-br from-[#fef08a] to-[#ca8a04] w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-lg sm:text-xl md:text-2xl lg:text-3xl font-black text-black border-[2px] md:border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] shrink-0">
                          {i + 1}
                        </div>
                      )}
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#0f172a] to-[#020617] border-[2.5px] md:border-[3px] lg:border-[4px] border-[#eab308] rounded-lg md:rounded-xl shadow-[0_2px_8px_rgba(234,179,8,0.15)] flex items-center justify-between px-2 sm:px-3 md:px-4 lg:px-6"
                      style={{ transform: 'rotateX(180deg)' }}>
                      <div className="text-white font-black text-[10px] sm:text-xs md:text-sm lg:text-lg xl:text-xl uppercase tracking-wide drop-shadow-[1px_1px_0_#000] text-left leading-tight overflow-hidden h-full flex items-center shrink min-w-0">
                        <span className="line-clamp-1 md:line-clamp-2 lg:line-clamp-2 w-full break-words">{ans.text}</span>
                      </div>
                      <div className="font-mono text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-[#eab308] font-black leading-none drop-shadow-[1px_1px_0_#000] min-w-[40px] sm:min-w-[50px] md:min-w-[60px] lg:min-w-[70px] text-center border-l-2 md:border-l-[3px] border-white/15 pl-1.5 sm:pl-2 md:pl-3 lg:pl-4 shrink-0 flex items-center justify-center h-full">
                        {ans.points}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BOTTOM BAR ─── */}
      {showBottomBar && (
        <div className="min-h-[110px] h-[min(18vh,190px)] shrink-0 w-full bg-gradient-to-b from-[#1a0505] to-[#000] border-t-[4px] sm:border-t-[6px] md:border-t-[8px] border-[#eab308] flex items-stretch px-2 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-3 md:gap-4 relative z-20 shadow-[0_-16px_40px_rgba(0,0,0,0.8)]">

          {/* Team A score */}
          <div className={`flex-1 min-w-0 flex flex-col justify-center items-center h-full rounded-xl sm:rounded-2xl md:rounded-3xl border-2 md:border-[3px] lg:border-4 transition-all duration-300 relative overflow-hidden py-2 md:py-3
            ${r3 && r3ActiveTeam === 'A' && phase === 'play' ? 'shadow-[0_0_24px_rgba(234,179,8,0.5)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-[10px] sm:text-sm md:text-base lg:text-xl uppercase tracking-[1px] md:tracking-[2px] lg:tracking-[3px] text-white font-black mb-0.5 md:mb-1 z-10 text-center">ĐỘI A</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[3px] lg:border-[4px] border-[#eab308] px-2 sm:px-4 md:px-6 lg:px-8 py-1 md:py-1.5 rounded-lg md:rounded-xl lg:rounded-2xl text-center min-w-[50px] sm:min-w-[80px] md:min-w-[100px] shadow-[inset_0_0_8px_rgba(234,179,8,0.15),0_3px_10px_rgba(0,0,0,0.6)] z-10 mx-auto w-fit">
              <div className="font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none">{scores.A.toString().padStart(3, '0')}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-[1.5] sm:flex-[2] flex flex-col items-center justify-center border-x border-white/10 px-1.5 sm:px-2 md:px-4 h-full gap-1.5 sm:gap-2 md:gap-3 min-w-0">

            {/* R1-R2: team-select */}
            {phase === 'team-select' && !r3 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full max-w-md">
                <button onClick={() => handleTeamSelect('A')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-2 sm:px-3 md:px-6 py-2 sm:py-2.5 md:py-4 lg:py-5 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-lg text-center leading-tight">
                  ĐỘI A CHƠI TRƯỚC
                </button>
                <button onClick={() => handleTeamSelect('B')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-2 sm:px-3 md:px-6 py-2 sm:py-2.5 md:py-4 lg:py-5 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-lg text-center leading-tight">
                  ĐỘI B CHƠI TRƯỚC
                </button>
              </div>
            )}

            {/* R3: two team-answer buttons */}
            {r3 && phase === 'play' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full max-w-md">
                <button onClick={() => handleR3TeamPick('A')}
                  disabled={r3StrikesA >= 3}
                  className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-4 rounded-lg sm:rounded-xl md:rounded-2xl uppercase font-black text-[10px] sm:text-xs md:text-sm lg:text-base transition-all text-center
                    ${r3StrikesA >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'A'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesA >= 3 ? 'ĐỘI A ĐÃ KHÓA 3❌' : 'ĐỘI A TRẢ LỜI'}
                </button>
                <button onClick={() => handleR3TeamPick('B')}
                  disabled={r3StrikesB >= 3}
                  className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-4 rounded-lg sm:rounded-xl md:rounded-2xl uppercase font-black text-[10px] sm:text-xs md:text-sm lg:text-base transition-all text-center
                    ${r3StrikesB >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'B'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesB >= 3 ? 'ĐỘI B ĐÃ KHÓA 3❌' : 'ĐỘI B TRẢ LỜI'}
                </button>
              </div>
            )}

            {/* R1-R2 play: SAI button */}
            {phase === 'play' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] sm:border-b-[5px] md:border-b-[6px] lg:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-14 py-2 sm:py-2.5 md:py-3 lg:py-5 uppercase text-xs sm:text-sm md:text-lg lg:text-2xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-[280px] md:max-w-sm">
                SAI ❌
              </button>
            )}

            {/* R3 + SAI button */}
            {r3 && phase === 'play' && r3ActiveTeam && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] md:border-b-[6px] border-[#7f1d1d] active:border-b-0 active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-6 md:px-8 lg:px-14 py-2 md:py-3 lg:py-4 uppercase text-xs sm:text-sm md:text-base lg:text-xl font-black rounded-lg md:rounded-xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-sm">
                SAI ❌ — Đội {r3ActiveTeam}
              </button>
            )}

            {/* R1-R2 steal: STEAL SAI button */}
            {phase === 'steal' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] sm:border-b-[5px] md:border-b-[6px] lg:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-14 py-2 sm:py-2.5 md:py-3 lg:py-5 uppercase text-xs sm:text-sm md:text-lg lg:text-2xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-[280px] md:max-w-sm">
                STEAL SAI ❌
              </button>
            )}

            {/* R1-2 reveal: hint */}
            {phase === 'reveal' && !r3 && (
              !allRevealed
                ? <div className="text-center px-2">
                  <div className="text-white/60 text-xs sm:text-sm px-1">Tiếp tục lật các ô chưa mở</div>
                </div>
                : <button onClick={nextRound}
                  className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[4px] md:border-b-[6px] lg:border-b-[8px] border-[#14532d] active:border-b-0 active:translate-y-[2px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-2.5 md:py-3 lg:py-4 uppercase text-xs sm:text-sm md:text-base lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(22,163,74,0.4)] w-full max-w-[240px] md:max-w-sm flex items-center justify-center gap-1 sm:gap-2">
                  SANG VÒNG TIẾP <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </button>
            )}
          </div>

          {/* r3-end button */}
          {r3 && phase === 'round3-end' && (
            <div className="flex-[1.5] sm:flex-[2] flex items-center justify-center px-1.5 sm:px-2 md:px-4 h-full min-w-0">
              <button onClick={toGameEnd}
                className="bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[5px] md:border-b-[6px] lg:border-b-[8px] border-[#713f12] active:border-b-0 active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-black px-6 md:px-8 lg:px-12 py-2 md:py-3 lg:py-4 uppercase text-xs sm:text-sm md:text-base lg:text-xl font-black rounded-lg md:rounded-xl transition-all shadow-[0_3px_10px_rgba(234,179,8,0.4)] w-full max-w-sm text-center">
                XEM KẾT QUẢ CUỐI CÙNG
              </button>
            </div>
          )}

          {/* Team B score */}
          <div className={`flex-1 min-w-0 flex flex-col justify-center items-center h-full rounded-xl sm:rounded-2xl md:rounded-3xl border-2 md:border-[3px] lg:border-4 transition-all duration-300 relative overflow-hidden py-2 md:py-3
            ${r3 && r3ActiveTeam === 'B' && phase === 'play' ? 'shadow-[0_0_24px_rgba(234,179,8,0.5)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-[10px] sm:text-sm md:text-base lg:text-xl uppercase tracking-[1px] md:tracking-[2px] lg:tracking-[3px] text-white font-black mb-0.5 md:mb-1 z-10 text-center">ĐỘI B</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[3px] lg:border-[4px] border-[#eab308] px-2 sm:px-4 md:px-6 lg:px-8 py-1 md:py-1.5 rounded-lg md:rounded-xl lg:rounded-2xl text-center min-w-[50px] sm:min-w-[80px] md:min-w-[100px] shadow-[inset_0_0_8px_rgba(234,179,8,0.15),0_3px_10px_rgba(0,0,0,0.6)] z-10 mx-auto w-fit">
              <div className="font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none">{scores.B.toString().padStart(3, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM CONTROLS ─── */}
      {showBottomBar && (
        <div className="min-h-[110px] h-[min(18vh,190px)] shrink-0 w-full bg-gradient-to-b from-[#1a0505] to-[#000] border-t-[4px] sm:border-t-[6px] md:border-t-[8px] border-[#eab308] flex items-stretch px-2 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-3 md:gap-4 relative z-20 shadow-[0_-16px_40px_rgba(0,0,0,0.8)]">

          {/* Team A score */}
          <div className={`flex-1 min-w-0 flex flex-col justify-center items-center h-full rounded-xl sm:rounded-2xl md:rounded-3xl border-2 md:border-[3px] lg:border-4 transition-all duration-300 relative overflow-hidden py-2 md:py-3
            ${r3 && r3ActiveTeam === 'A' && phase === 'play' ? 'shadow-[0_0_24px_rgba(234,179,8,0.45)] bg-[#eab308]/15 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-[10px] sm:text-sm md:text-base lg:text-xl uppercase tracking-wider text-white font-black mb-0.5 md:mb-1 z-10 text-center shrink-0">ĐỘI A</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[3px] lg:border-[4px] border-[#eab308] px-2 sm:px-4 md:px-6 lg:px-8 py-1 md:py-1.5 rounded-lg md:rounded-xl lg:rounded-2xl text-center shadow-[inset_0_0_6px_rgba(234,179,8,0.12),0_2px_8px_rgba(0,0,0,0.6)] z-10 mx-auto w-fit shrink-0">
              <div className="font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none whitespace-nowrap">{scores.A.toString().padStart(3, '0')}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-[1.6] sm:flex-[2] flex flex-col items-center justify-center border-x border-white/10 px-1.5 sm:px-2 md:px-4 h-full gap-1.5 sm:gap-2 md:gap-3 min-w-0">

            {/* R1-R2: team-select */}
            {phase === 'team-select' && !r3 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full max-w-lg">
                <button onClick={() => handleTeamSelect('A')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-2 sm:px-3 md:px-6 py-2.5 sm:py-3 md:py-4 lg:py-5 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-lg text-center leading-tight h-10 sm:h-12 md:h-auto min-h-[36px]">
                  ĐỘI A CHƠI TRƯỚC
                </button>
                <button onClick={() => handleTeamSelect('B')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-2 sm:px-3 md:px-6 py-2.5 sm:py-3 md:py-4 lg:py-5 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-lg text-center leading-tight h-10 sm:h-12 md:h-auto min-h-[36px]">
                  ĐỘI B CHƠI TRƯỚC
                </button>
              </div>
            )}

            {/* R3: two team-answer buttons */}
            {r3 && phase === 'play' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full max-w-lg">
                <button onClick={() => handleR3TeamPick('A')}
                  disabled={r3StrikesA >= 3}
                  className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-4 rounded-lg sm:rounded-xl md:rounded-2xl uppercase font-black text-[10px] sm:text-xs md:text-sm lg:text-base transition-all text-center min-h-[36px] sm:min-h-[42px] md:min-h-auto
                    ${r3StrikesA >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'A'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesA >= 3 ? 'ĐỘI A ĐÃ KHÓA 3❌' : 'ĐỘI A TRẢ LỜI'}
                </button>
                <button onClick={() => handleR3TeamPick('B')}
                  disabled={r3StrikesB >= 3}
                  className={`flex-1 py-2 sm:py-2.5 md:py-3 lg:py-4 rounded-lg sm:rounded-xl md:rounded-2xl uppercase font-black text-[10px] sm:text-xs md:text-sm lg:text-base transition-all text-center min-h-[36px] sm:min-h-[42px] md:min-h-auto
                    ${r3StrikesB >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'B'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] sm:border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesB >= 3 ? 'ĐỘI B ĐÃ KHÓA 3❌' : 'ĐỘI B TRẢ LỜI'}
                </button>
              </div>
            )}

            {/* R1-R2 play: SAI button */}
            {phase === 'play' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] sm:border-b-[5px] md:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-14 py-2 sm:py-3 md:py-4 lg:py-5 uppercase text-sm sm:text-base md:text-lg lg:text-2xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-[280px] md:max-w-sm min-h-[44px]">
                SAI ❌
              </button>
            )}

            {/* R3 + SAI button */}
            {r3 && phase === 'play' && r3ActiveTeam && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] sm:border-b-[5px] md:border-b-[6px] border-[#7f1d1d] active:border-b-0 active:translate-y-[3px] sm:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-14 py-2 sm:py-3 md:py-3 lg:py-4 uppercase text-xs sm:text-sm md:text-base lg:text-xl font-black rounded-lg sm:rounded-xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-sm min-h-[44px]">
                SAI ❌ — Đội {r3ActiveTeam}
              </button>
            )}

            {/* R1-R2 steal: STEAL SAI button */}
            {phase === 'steal' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] sm:border-b-[5px] md:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-14 py-2 sm:py-3 md:py-4 lg:py-5 uppercase text-sm sm:text-base md:text-lg lg:text-2xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(220,38,38,0.5)] w-full max-w-[280px] md:max-w-sm min-h-[44px]">
                STEAL SAI ❌
              </button>
            )}

            {/* R1-2 reveal: hint / next button */}
            {phase === 'reveal' && !r3 && (
              !allRevealed
                ? <div className="text-center px-1">
                  <div className="text-white/50 text-[10px] sm:text-xs md:text-sm px-1">Tiếp tục lật các ô chưa mở</div>
                </div>
                : <button onClick={nextRound}
                  className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[4px] sm:border-b-[5px] md:border-b-[8px] border-[#14532d] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-white px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-3 md:py-3 lg:py-4 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(22,163,74,0.4)] w-full max-w-[240px] md:max-w-sm flex items-center justify-center gap-1 sm:gap-2 min-h-[44px]">
                  SANG VÒNG TIẾP <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8" />
                </button>
            )}
          </div>

          {/* r3-end to-game button */}
          {r3 && phase === 'round3-end' && (
            <div className="flex-[1.6] sm:flex-[2] flex items-center justify-center px-1.5 sm:px-2 md:px-4 h-full min-w-0">
              <button onClick={toGameEnd}
                className="bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[4px] sm:border-b-[5px] md:border-b-[8px] border-[#713f12] active:border-b-0 active:translate-y-[2px] sm:active:translate-y-[3px] md:active:translate-y-[4px] hover:brightness-110 text-black px-4 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-3 md:py-3 lg:py-4 uppercase text-[10px] sm:text-xs md:text-sm lg:text-xl font-black rounded-lg sm:rounded-xl md:rounded-2xl transition-all shadow-[0_3px_10px_rgba(234,179,8,0.4)] w-full max-w-sm min-h-[44px]">
                XEM KẾT QUẢ CUỐI CÙNG
              </button>
            </div>
          )}

          {/* Team B score */}
          <div className={`flex-1 min-w-0 flex flex-col justify-center items-center h-full rounded-xl sm:rounded-2xl md:rounded-3xl border-2 md:border-[3px] lg:border-4 transition-all duration-300 relative overflow-hidden py-2 md:py-3
            ${r3 && r3ActiveTeam === 'B' && phase === 'play' ? 'shadow-[0_0_24px_rgba(234,179,8,0.45)] bg-[#eab308]/15 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-[10px] sm:text-sm md:text-base lg:text-xl uppercase tracking-wider text-white font-black mb-0.5 md:mb-1 z-10 text-center shrink-0">ĐỘI B</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[3px] lg:border-[4px] border-[#eab308] px-2 sm:px-4 md:px-6 lg:px-8 py-1 md:py-1.5 rounded-lg md:rounded-xl lg:rounded-2xl text-center shadow-[inset_0_0_6px_rgba(234,179,8,0.12),0_2px_8px_rgba(0,0,0,0.6)] z-10 mx-auto w-fit shrink-0">
              <div className="font-mono text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none whitespace-nowrap">{scores.B.toString().padStart(3, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ROUND-END OVERLAY (r1-r2) ─── */}
      {phase === 'round-end' && !r3 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020513]/95 gap-6 md:gap-8">
          <div className="text-3xl md:text-5xl text-[#eab308] font-black uppercase tracking-wider">VÒNG {currentRoundIdx + 1} KẾT THÚC</div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-sm">
            <div className="flex justify-between items-center text-white/70 text-sm uppercase tracking-wider mb-3">
              <span>Đội A</span><span>Đội B</span>
            </div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black text-center">
              {scores.A.toLocaleString()}
            </div>
            <div className="text-white/60 text-xs text-center uppercase tracking-wider py-2">—</div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black text-center">
              {scores.B.toLocaleString()}
            </div>
          </div>

          {currentRoundIdx < DATA.length - 2 && (
            <button onClick={() => setPhase('team-select')}
              className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[6px] border-[#14532d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-10 py-4 uppercase text-lg md:text-2xl font-black rounded-2xl transition-all shadow-[0_10px_30px_rgba(22,163,74,0.4)]">
              SANG VÒNG TIẾP
            </button>
          )}
          {currentRoundIdx === DATA.length - 2 && (
            <button onClick={() => { nextRound(); }}
              className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[6px] border-[#14532d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-10 py-4 uppercase text-lg md:text-2xl font-black rounded-2xl transition-all shadow-[0_10px_30px_rgba(22,163,74,0.4)]">
              VÀO VÒNG 3
            </button>
          )}
        </div>
      )}

      {/* ─── ROUND-3-END OVERLAY ─── */}
      {phase === 'round3-end' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020513]/95 gap-6 md:gap-8">
          <div className="text-3xl md:text-5xl text-[#eab308] font-black uppercase tracking-wider">VÒNG 3 KẾT THÚC</div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-sm">
            <div className="flex justify-between items-center text-white/70 text-sm uppercase tracking-wider mb-3">
              <span>Đội A</span><span>Đội B</span>
            </div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black text-center">
              {scores.A.toLocaleString()}
            </div>
            <div className="text-white/60 text-xs text-center uppercase tracking-wider py-2">—</div>
            <div className="font-mono text-4xl md:text-6xl text-[#eab308] font-black text-center">
              {scores.B.toLocaleString()}
            </div>
          </div>
          <button onClick={toGameEnd}
            className="bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[6px] border-[#713f12] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-black px-10 py-4 uppercase text-lg md:text-2xl font-black rounded-2xl transition-all shadow-[0_10px_30px_rgba(234,179,8,0.4)]">
            XEM KẾT QUẢ CUỐI CÙNG
          </button>
        </div>
      )}

    </div>
  );
}
