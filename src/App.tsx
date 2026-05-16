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
      if (newRevealed.every(x => x)) {
        // All 6 revealed → main team keeps all accumulated points
        setTimeout(() => {
          setScores(prev => ({ ...prev, [s.activeTeam!]: prev[s.activeTeam!] + newPts }));
          setPhase('round-end');
        }, 1000);
      }
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

  // ─── SAVE & PROCEED round-end / round3-end → game-end ─────────────
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


  // ─── DERIVED ──────────────────────────────────────────────────────
  const currentRound = DATA[currentRoundIdx];
  const r3 = isRound3(currentRoundIdx);
  const stealingTeam = activeTeam === 'A' ? 'B' : (activeTeam === 'B' ? 'A' : null);
   const allRevealed = revealed.every(Boolean);

   // Same-group phases hide the bottom bar
   const showBottomBar = phase !== 'intro' && phase !== 'round-end' && phase !== 'round3-end';

  // Floating status badge for room screen
  function statusBadge() {
    if (phase === 'game-end' || phase === 'intro') return null;
    if (r3) {
      return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 md:px-8 py-2 md:py-3 rounded-2xl text-lg md:text-2xl font-black uppercase tracking-wider border-2 border-blue-400/40">
          VÒNG 3 — LUÂN PHIÊN
        </div>
      );
    }
    if (phase === 'steal') {
      return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-red-600 to-red-700 text-white px-5 md:px-10 py-2 md:py-3 rounded-2xl text-lg md:text-2xl font-black uppercase tracking-wider animate-pulse border-4 border-red-400/40 shadow-[0_0_40px_rgba(220,38,38,0.6)]">
          🔥 CƯỚP ĐIỂM — ĐỘI {stealingTeam}
        </div>
      );
    }
    if (phase === 'team-select') {
      return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/10 border-2 border-white/20 px-5 md:px-8 py-2 rounded-2xl text-lg md:text-2xl font-black tracking-wider">
          VÒNG {currentRoundIdx + 1} — CHỌN ĐỘI BẮT ĐẦU
        </div>
      );
    }
    // play
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/10 border-2 border-white/20 px-5 md:px-8 py-2 rounded-2xl text-lg md:text-2xl font-black tracking-wider">
        VÒNG {currentRoundIdx + 1} — ĐỘI {activeTeam ?? '?'} ĐANG CHƠI
      </div>
    );
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
        <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 mb-8">
          <h2 className="text-xl md:text-2xl text-[#eab308] font-black uppercase tracking-wider mb-4 text-center">Chi tiết điểm từng vòng</h2>
          {roundScores.map((rs, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0 px-2">
              <span className="text-white/80 text-sm md:text-base">Vòng {i + 1}</span>
              <span className="text-[#eab308] font-mono text-base md:text-lg font-black">{rs.A.toLocaleString()} — {rs.B.toLocaleString()}</span>
            </div>
          ))}
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

  // ─── RENDERING HELPERS ────────────────────────────────────────────
  // show all answers without interactivity (overlays / team-select / reveal)
  const sneakReveal = phase === 'team-select' || phase === 'reveal' || phase === 'round-end' || phase === 'round3-end';
  // phases where clicking cells is allowed
  const interactivePhase = phase === 'play' || phase === 'steal' || phase === 'reveal';

  const cellClickable = (idx: number) => {
    if (revealed[idx]) return false;
    if (!interactivePhase) return false;
    if (r3 && r3ActiveTeam === null) return false;
    return true;
  };

  // ─── RENDERING ────────────────────────────────────────────────────
  // Phases that show game board
  const showBoard = phase !== 'game-end' && phase !== 'round-end' && phase !== 'round3-end';

  return (
    <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      {statusBadge()}

      {showBoard && (
        <div className="flex flex-col h-full w-full max-w-6xl mx-auto px-4">
          {/* Question */}
          <div className="w-full border-[3px] border-[#eab308] bg-gradient-to-b from-[#0a1930] to-[#01081a] rounded-3xl p-4 md:p-6 mb-3 text-center shadow-[0_10px_40px_rgba(234,179,8,0.2)] flex-shrink-0">
            <h1 className="text-xl md:text-2xl xl:text-3xl text-white font-black uppercase tracking-wide leading-tight">{currentRound.question}</h1>
            {phase !== 'team-select' && (
              <div className="flex items-center justify-center bg-black/80 border-2 border-[#eab308]/50 rounded-xl px-5 py-1.5 md:py-2 shadow-[0_5px_20px_rgba(0,0,0,0.5)] mt-3 gap-3">
                <span className="text-[#eab308] text-xs md:text-sm uppercase tracking-[3px] font-black">ĐIỂM VÒNG</span>
                <span className="font-mono text-3xl md:text-4xl text-[#eab308] font-black leading-none">{roundPoints}</span>
              </div>
            )}
          </div>

          {/* Strikes r1-r2 */}
          {(phase === 'play' || phase === 'steal') && !r3 && (
            <div className="flex items-center gap-3 mb-3 flex-shrink-0">
              {[0, 1, 2].map(i => (
                <div key={i}
                  className={`w-[36px] h-[36px] md:w-[50px] md:h-[50px] border-[3px] rounded-xl flex items-center justify-center font-bold transition-all duration-300
                    ${i < strikes ? 'border-[#ff0000] text-[#ff0000] bg-[#600000] shadow-[0_0_15px_#ff0000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                  <X strokeWidth={5} className="w-5 h-5 md:w-8 md:h-8" />
                </div>
              ))}
              <span className="text-white/80 text-sm md:text-sm font-bold tracking-wider">({strikes}/3)</span>
            </div>
          )}

          {/* Strikes r3 — dual */}
          {r3 && (phase === 'play' || phase === 'steal') && (
            <div className="flex items-center gap-6 mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm uppercase mr-1">Đội A:</span>
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className={`w-[28px] h-[28px] md:w-[38px] md:h-[38px] border-[3px] rounded-lg flex items-center justify-center transition-all duration-300
                      ${i < r3StrikesA ? 'border-[#ff0000] text-[#ff0000] bg-[#600000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                    <X strokeWidth={4} className="w-3 h-3 md:w-6 md:h-6" />
                  </div>
                ))}
                <span className="text-red-400 text-xs md:text-sm font-bold ml-1">({r3StrikesA}/3)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm uppercase mr-1">Đội B:</span>
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className={`w-[28px] h-[28px] md:w-[38px] md:h-[38px] border-[3px] rounded-lg flex items-center justify-center transition-all duration-300
                      ${i < r3StrikesB ? 'border-[#ff0000] text-[#ff0000] bg-[#600000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                    <X strokeWidth={4} className="w-3 h-3 md:w-6 md:h-6" />
                  </div>
                ))}
                <span className="text-red-400 text-xs md:text-sm font-bold ml-1">({r3StrikesB}/3)</span>
              </div>
            </div>
          )}

          {/* R1-2 reveal hint */}
          {!r3 && phase === 'reveal' && !allRevealed && (
            <div className="text-center text-[#eab308] text-sm md:text-base font-black uppercase tracking-widest mb-2 animate-pulse flex-shrink-0">
              Lật hết đáp án còn lại để sang vòng mới
            </div>
          )}

          {/* Answer grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 md:gap-y-4 md:gap-x-6 xl:gap-y-6 xl:gap-x-10 w-full flex-1 min-h-0 mb-4">
            {currentRound.answers.map((ans, i) => {
              const exposed = sneakReveal || revealed[i];
              return (
                <div key={i} className={`relative w-full h-full min-h-[55px] md:min-h-[65px]
                  ${cellClickable(i) ? 'cursor-pointer group' : 'cursor-default'}`}
                  onClick={() => cellClickable(i) && handleFlip(i)}>
                  <motion.div
                    className="w-full h-full relative preserve-3d"
                    animate={{ rotateX: exposed ? 180 : 0 }}
                    transition={{ duration: 0.55, type: "spring", bounce: 0.35 }}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] border-[3px] md:border-[4px] border-[#eab308] rounded-xl flex items-center justify-center shadow-[0_5px_10px_rgba(0,0,0,0.6),inset_0_2px_15px_rgba(255,255,255,0.1)]">
                      {!exposed && (
                        <div className="bg-gradient-to-br from-[#fef08a] to-[#ca8a04] w-10 h-10 md:w-14 md:h-14 xl:w-16 xl:h-16 rounded-full flex items-center justify-center text-2xl md:text-3xl xl:text-4xl font-black text-black border-[3px] md:border-[4px] border-white shadow-[0_3px_10px_rgba(0,0,0,0.4)]">
                          {i + 1}
                        </div>
                      )}
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#0f172a] to-[#020617] border-[3px] md:border-[4px] border-[#eab308] rounded-xl shadow-[0_5px_15px_rgba(234,179,8,0.2),inset_0_2px_15px_rgba(255,255,255,0.1)] flex items-center justify-between px-3 md:px-6 xl:px-8"
                      style={{ transform: 'rotateX(180deg)' }}>
                      <div className="text-white font-black text-sm md:text-lg xl:text-2xl uppercase tracking-wider drop-shadow-[1px_1px_0_#000] text-left leading-tight overflow-hidden h-full flex items-center shrink">
                        <span className="line-clamp-2 md:line-clamp-3 w-full">{ans.text}</span>
                      </div>
                      <div className="font-mono text-2xl md:text-4xl xl:text-5xl text-[#eab308] font-black leading-none drop-shadow-[2px_2px_0_#000] min-w-[50px] md:min-w-[70px] xl:min-w-[90px] text-center border-l-2 md:border-l-4 border-white/20 pl-2 md:pl-4 xl:pl-6 shrink-0 flex items-center justify-center h-full">
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

      {/* ─── BOTTOM CONTROLS ─── */}
      {showBottomBar && (
        <div className="h-[140px] md:h-[180px] lg:h-[190px] shrink-0 w-full bg-gradient-to-b from-[#1a0505] to-[#000] border-t-[6px] md:border-t-[8px] border-[#eab308] flex items-center px-3 md:px-8 gap-3 md:gap-4 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">

          {/* Team A score */}
          <div className={`flex-1 flex flex-col justify-center items-center h-full rounded-2xl md:rounded-3xl border-2 md:border-4 transition-all duration-300 relative overflow-hidden
            ${r3 && r3ActiveTeam === 'A' && phase === 'play' ? 'shadow-[0_0_30px_rgba(234,179,8,0.5)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-xs md:text-lg xl:text-xl uppercase tracking-[2px] md:tracking-[4px] text-white font-black mb-1 z-10">ĐỘI A</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[4px] border-[#eab308] px-3 md:px-8 py-1 md:py-2 rounded-xl md:rounded-2xl text-center min-w-[70px] shadow-[inset_0_0_20px_rgba(234,179,8,0.2),0_5px_15px_rgba(0,0,0,0.8)] z-10">
              <div className="font-mono text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none">{scores.A.toString().padStart(3, '0')}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-[2] flex flex-col items-center justify-center border-x-2 border-white/10 px-2 md:px-4 h-full gap-2 md:gap-3">

            {/* R1-R2: team-select */}
            {phase === 'team-select' && !r3 && (
              <div className="flex gap-3 md:gap-4 w-full max-w-lg">
                <button onClick={() => handleTeamSelect('A')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] border-[#1e3a8a] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-3 md:px-6 py-4 md:py-5 uppercase text-xs md:text-xl font-black rounded-xl md:rounded-2xl transition-all shadow-lg">
                  ĐỘI A CHƠI TRƯỚC
                </button>
                <button onClick={() => handleTeamSelect('B')}
                  className="flex-1 bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] border-[#1e3a8a] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-3 md:px-6 py-4 md:py-5 uppercase text-xs md:text-xl font-black rounded-xl md:rounded-2xl transition-all shadow-lg">
                  ĐỘI B CHƠI TRƯỚC
                </button>
              </div>
            )}

            {/* R3: two team-answer buttons */}
            {r3 && phase === 'play' && (
              <div className="flex gap-3 md:gap-4 w-full max-w-lg">
                <button onClick={() => handleR3TeamPick('A')}
                  disabled={r3StrikesA >= 3}
                  className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl uppercase font-black text-xs md:text-base transition-all
                    ${r3StrikesA >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'A'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesA >= 3 ? 'ĐỘI A ĐÃ KHÓA 3❌' : 'ĐỘI A TRẢ LỜI'}
                </button>
                <button onClick={() => handleR3TeamPick('B')}
                  disabled={r3StrikesB >= 3}
                  className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl uppercase font-black text-xs md:text-base transition-all
                    ${r3StrikesB >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'B'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesB >= 3 ? 'ĐỘI B ĐÃ KHÓA 3❌' : 'ĐỘI B TRẢ LỜI'}
                </button>
              </div>
            )}

            {/* R1-R2 play: SAI button */}
            {phase === 'play' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[6px] md:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-8 md:px-14 py-4 md:py-5 uppercase text-lg md:text-2xl font-black rounded-xl md:rounded-2xl transition-all shadow-[0_5px_15px_rgba(220,38,38,0.5)] w-full max-w-sm">
                SAI ❌
              </button>
            )}

            {/* R3 + SAI button */}
            {r3 && phase === 'play' && r3ActiveTeam && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[6px] border-[#7f1d1d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-8 md:px-14 py-3 md:py-4 uppercase text-base md:text-xl font-black rounded-xl transition-all shadow-[0_5px_15px_rgba(220,38,38,0.5)] w-full max-w-sm">
                SAI ❌ — Đội {r3ActiveTeam}
              </button>
            )}

            {/* R1-R2 steal: STEAL SAI button */}
            {phase === 'steal' && !r3 && (
              <button onClick={handleStrike}
                className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[6px] md:border-b-[8px] border-[#7f1d1d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-8 md:px-14 py-4 md:py-5 uppercase text-lg md:text-2xl font-black rounded-xl md:rounded-2xl transition-all shadow-[0_5px_15px_rgba(220,38,38,0.5)] w-full max-w-sm">
                STEAL SAI ❌
              </button>
            )}

            {/* R1-2 reveal: hint */}
            {phase === 'reveal' && !r3 && (
              !allRevealed
                ? <div className="text-center">
                  <div className="text-white/60 text-sm px-2">Tiếp tục lật các ô chưa mở</div>
                </div>
                : <button onClick={nextRound}
                  className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[5px] md:border-b-[8px] border-[#14532d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-8 md:px-12 py-3 md:py-4 uppercase text-base md:text-xl font-black rounded-xl transition-all shadow-[0_5px_15px_rgba(22,163,74,0.4)] w-full max-w-sm flex items-center justify-center gap-2">
                  SANG VÒNG TIẾP <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                </button>
            )}

            {/* SANG VÒNG TIẾP — r3-end */}
            {r3 && phase === 'round3-end' && (
              <button onClick={toGameEnd}
                className="bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[6px] border-[#713f12] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-black px-8 md:px-12 py-3 md:py-4 uppercase text-base md:text-xl font-black rounded-xl transition-all shadow-[0_5px_15px_rgba(234,179,8,0.4)] w-full max-w-sm">
                XEM KẾT QUẢ CUỐI CÙNG
              </button>
            )}
          </div>

          {/* Team B score */}
          <div className={`flex-1 flex flex-col justify-center items-center h-full rounded-2xl md:rounded-3xl border-2 md:border-4 transition-all duration-300 relative overflow-hidden
            ${r3 && r3ActiveTeam === 'B' && phase === 'play' ? 'shadow-[0_0_30px_rgba(234,179,8,0.5)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-xs md:text-lg xl:text-xl uppercase tracking-[2px] md:tracking-[4px] text-white font-black mb-1 z-10">ĐỘI B</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-2 md:border-[4px] border-[#eab308] px-3 md:px-8 py-1 md:py-2 rounded-xl md:rounded-2xl text-center min-w-[70px] shadow-[inset_0_0_20px_rgba(234,179,8,0.2),0_5px_15px_rgba(0,0,0,0.8)] z-10">
              <div className="font-mono text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none">{scores.B.toString().padStart(3, '0')}</div>
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
