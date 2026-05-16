import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { X, ChevronRight, Volume2, VolumeX } from 'lucide-react';

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

function OpeningScreen({ onStart, openingRef }: { onStart: () => void; openingRef: any }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleMusic = () => {
    const audio = openingRef.current;
    if (!audio) {
      console.log('Audio ref is null');
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = 0.65;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Play error:', e));
    }
  };

  // Aggressive autoplay bypass
  useEffect(() => {
    const audio = openingRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.loop = true;
      audio.volume = 0.65;
      audio.muted = true;
      audio.play().then(() => {
        setTimeout(() => {
          if (audio) {
            audio.muted = false;
            setIsPlaying(true);
          }
        }, 80);
      }).catch(() => {});
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-[#020513] text-white items-center justify-center font-sans font-bold relative opening-screen">
      <button
        onClick={toggleMusic}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
      >
        {isPlaying ? <VolumeX size={28} /> : <Volume2 size={28} />}
      </button>

      <div className="text-[120px] text-[#eab308] font-black tracking-[12px]">CHUNG SỨC</div>
      <button onClick={onStart} className="mt-8 bg-[#eab308] text-black px-16 py-5 text-3xl font-black rounded-3xl">BẮT ĐẦU CHƠI</button>
    </div>
  );
}

export default function App() {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [scores, setScores] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [roundPoints, setRoundPoints] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(Array(6).fill(false));
  const [strikes, setStrikes] = useState(0);

  const [r3StrikesA, setR3StrikesA] = useState(0);
  const [r3StrikesB, setR3StrikesB] = useState(0);
  const [r3ActiveTeam, setR3ActiveTeam] = useState<Team | null>(null);

  const [roundScores, setRoundScores] = useState<{ A: number; B: number }[]>([]);
  const [notification, setNotification] = useState<{ text: string; type: 'steal' | 'success' | 'fail' | 'strike' | 'end' | 'win' } | null>(null);
  const [flyingPoints, setFlyingPoints] = useState<{ id: number; pts: number; team: Team; x: number; y: number }[]>([]);
  const [roundScoreThis, setRoundScoreThis] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [answerTimer, setAnswerTimer] = useState(15);
  const [firstTeamOfGame, setFirstTeamOfGame] = useState<Team | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);

  const stateRef = useRef({ phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores, r3StrikesA, r3StrikesB, r3ActiveTeam });
  useEffect(() => {
    stateRef.current = { phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores, r3StrikesA, r3StrikesB, r3ActiveTeam };
  });

  const audiosRef = useRef<{ [k: string]: HTMLAudioElement }>({});
  const openingRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audiosRef.current = {
      ding: new Audio('https://www.myinstants.com/media/sounds/family-feud-good-answer.mp3'),
      strike: new Audio('https://www.myinstants.com/media/sounds/family-feud-strike-sfx_kN6Z99k.mp3'),
      win: new Audio('https://www.myinstants.com/media/sounds/family-feud-win-sound-effect.mp3'),
    };
    const audio = new Audio('/family-feud-theme.mp3');
    audio.autoplay = true;
    audio.muted = true;
    audio.loop = true;
    audio.volume = 0.65;
    audio.play().then(() => {
      audio.muted = false;
    }).catch(() => {});
    openingRef.current = audio;
    if (openingRef.current) {
      openingRef.current.loop = true;
      openingRef.current.volume = 0.6;
    }
    Object.values(audiosRef.current).forEach(a => (a as HTMLAudioElement).load());
  }, []);

  const playSound = useCallback((type: 'ding' | 'strike' | 'win') => {
    try {
      const a = audiosRef.current[type];
      if (a) { const c = a.cloneNode() as HTMLAudioElement; c.play().catch(() => { }); }
    } catch { }
  }, []);

  const handleFlip = useCallback((i: number) => {
    const s = stateRef.current;
    if (s.revealed[i]) return;
    const canFlip = s.phase === 'play' || s.phase === 'steal' || s.phase === 'reveal';
    if (!canFlip) return;
    if (isRound3(s.currentRoundIdx) && s.r3ActiveTeam === null) return;

    playSound('ding');
    const newRevealed = [...s.revealed];
    newRevealed[i] = true;
    setRevealed(newRevealed);
    setAnswerTimer(15);
    setIsTimerActive(false);

    // Bay điểm animation
    const rect = (document.querySelectorAll('.preserve-3d')[i] as HTMLElement)?.getBoundingClientRect();
    if (rect) {
      const team = isRound3(s.currentRoundIdx) ? s.r3ActiveTeam! : (s.phase === 'steal' ? (s.activeTeam === 'A' ? 'B' : 'A') : s.activeTeam!);
      const pts = isRound3(s.currentRoundIdx) ? DATA[s.currentRoundIdx].answers[i].points : (s.phase === 'steal' ? DATA[s.currentRoundIdx].answers[i].points * 2 : DATA[s.currentRoundIdx].answers[i].points);
      setFlyingPoints(prev => [...prev, { id: Date.now(), pts, team, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]);
      setTimeout(() => setFlyingPoints(p => p.filter(f => f.id !== Date.now())), 900);
    }

    if (isRound3(s.currentRoundIdx)) {
      const scoringTeam = s.r3ActiveTeam!;
      setScores(prev => {
        const pts = DATA[s.currentRoundIdx].answers[i].points;
        return { ...prev, [scoringTeam]: prev[scoringTeam] + pts };
      });
      setR3ActiveTeam(null);
      if (newRevealed.every(x => x)) {
        setTimeout(() => setPhase('round3-end'), 800);
      }
    } else if (s.phase === 'play') {
      const pts = DATA[s.currentRoundIdx].answers[i].points;
      const newPts = s.roundPoints + pts;
      setRoundPoints(newPts);
      setScores(prev => ({ ...prev, [s.activeTeam!]: prev[s.activeTeam!] + pts }));
    } else if (s.phase === 'steal') {
      const cellPts = DATA[s.currentRoundIdx].answers[i].points * 2;
      const stealingTeam = s.activeTeam === 'A' ? 'B' : 'A';
      setScores(prev => ({ ...prev, [stealingTeam]: prev[stealingTeam] + cellPts }));
      setNotification({ text: `CƯỚP THÀNH CÔNG! +${cellPts}`, type: 'success' });
      setTimeout(() => { setNotification(null); setPhase('reveal'); }, 1600);
    }
  }, [playSound]);

  const handleStrike = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'play' && s.phase !== 'steal') return;
    playSound('strike');

    if (isRound3(s.currentRoundIdx)) {
      const target = s.r3ActiveTeam!;
      if (target === 'A') {
        const n = s.r3StrikesA + 1;
        setR3StrikesA(n);
        if (n >= 3) setR3ActiveTeam(null);
      } else {
        const n = s.r3StrikesB + 1;
        setR3StrikesB(n);
        if (n >= 3) setR3ActiveTeam(null);
      }
      setR3ActiveTeam(null);
      if ((s.r3StrikesA + (s.r3ActiveTeam === 'A' ? 1 : 0) >= 3) && (s.r3StrikesB + (s.r3ActiveTeam === 'B' ? 1 : 0) >= 3)) {
        setTimeout(() => setPhase('round3-end'), 600);
      }
    } else if (s.phase === 'play') {
      setStrikes(prev => {
        const n = prev + 1;
        if (n === 3) {
          const stealTeam = s.activeTeam === 'A' ? 'B' : 'A';
          setNotification({ text: `ĐỘI ${stealTeam} CƯỚP ĐIỂM!`, type: 'steal' });
          setTimeout(() => { setNotification(null); setPhase('steal'); }, 1400);
        }
        return n;
      });
    } else if (s.phase === 'steal') {
      setNotification({ text: 'CƯỚP THẤT BẠI!', type: 'fail' });
      setTimeout(() => { setNotification(null); setPhase('reveal'); }, 1600);
    }
  }, [playSound]);

  const handleTeamSelect = useCallback((team: Team) => {
    setActiveTeam(team);
    setPhase('play');
    setAnswerTimer(15);
    if (currentRoundIdx === 0 && !firstTeamOfGame) {
      setFirstTeamOfGame(team);
    }
  }, [currentRoundIdx, firstTeamOfGame]);

  const handleStart = useCallback(() => {
    // Fade nhạc mượt
    if (openingRef.current) {
      const fade = setInterval(() => {
        if (openingRef.current) {
          openingRef.current.volume = Math.max(0, openingRef.current.volume - 0.12);
          if (openingRef.current.volume <= 0.05) {
            openingRef.current.pause();
            openingRef.current.volume = 0.65;
            clearInterval(fade);
          }
        }
      }, 60);
    }

    // Animation chuyển cảnh cao cấp (scale + blur + fade)
    const introEl = document.querySelector('.opening-screen');
    if (introEl) {
      introEl.classList.add(
        'scale-[0.92]', 
        'opacity-0', 
        'blur-sm',
        'transition-all', 
        'duration-500', 
        'ease-[cubic-bezier(0.22,1,0.36,1)]'
      );
    }

    setTimeout(() => {
      playSound('win');
      setPhase('team-select');
    }, 520);
  }, [playSound]);

  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.currentRoundIdx < DATA.length - 1) {
      const nextIdx = s.currentRoundIdx + 1;
      setCurrentRoundIdx(nextIdx);
      setRevealed(Array(6).fill(false));
      setRoundPoints(0);
      setStrikes(0);
      if (isRound3(nextIdx)) {
        setR3StrikesA(0);
        setR3StrikesB(0);
        setR3ActiveTeam(null);
        setActiveTeam(null);
        setPhase('play');
      } else {
        // Vòng 2 tự động đội còn lại
        const nextTeam = firstTeamOfGame === 'A' ? 'B' : 'A';
        setActiveTeam(nextTeam);
        setPhase('play');
        setAnswerTimer(15);
      }
    }
  }, []);

  const currentRound = DATA[currentRoundIdx];
  const r3 = isRound3(currentRoundIdx);
  const stealingTeam = activeTeam === 'A' ? 'B' : 'A';
  const allRevealed = revealed.every(Boolean);
  const showBottomBar = phase !== 'intro' && phase !== 'round-end' && phase !== 'round3-end' && phase !== 'game-end';

  // Tự động lật hết ô còn lại khi vào reveal
  useEffect(() => {
    if (phase !== 'reveal') return;
    if (allRevealed) return;

    let idx = 0;
    const unrevealed = revealed.map((r, i) => !r ? i : -1).filter(i => i !== -1);
    const timer = setInterval(() => {
      if (idx < unrevealed.length) {
        const i = unrevealed[idx];
        setRevealed(prev => { const n = [...prev]; n[i] = true; return n; });
        idx++;
      } else {
        clearInterval(timer);
      }
    }, 280);
    return () => clearInterval(timer);
  }, [phase]);

  // Timer 15s cho tất cả vòng (chỉ đếm khi bấm nút)
  useEffect(() => {
    if (phase !== 'play' || !isTimerActive) return;

    const isR3Active = r3 && r3ActiveTeam;
    const isR1R2Active = !r3 && activeTeam;
    if (!isR3Active && !isR1R2Active) return;

    if (answerTimer <= 0) {
      handleStrike();
      setIsTimerActive(false);
      setAnswerTimer(15);
      return;
    }
    const t = setTimeout(() => setAnswerTimer(answerTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, r3, r3ActiveTeam, activeTeam, answerTimer, isTimerActive]);

  // Auto play opening music khi vào intro
  useEffect(() => {
    if (phase === 'intro' && openingRef.current) {
      openingRef.current.currentTime = 0;
      openingRef.current.loop = true;
      openingRef.current.volume = 0.65;
      openingRef.current.play().catch(() => {});
    }
  }, [phase]);



  useEffect(() => {
    if (phase !== 'reveal' || !allRevealed) return;
    // Lưu điểm vòng này để tổng kết
    setRoundScoreThis({ A: scores.A, B: scores.B });

    // Chỉ hiện thông báo, KHÔNG tự chuyển phase
    setNotification({ text: `KẾT THÚC VÒNG ${currentRoundIdx + 1}!`, type: 'end' });
    const timer = setTimeout(() => setNotification(null), 1800);
    return () => clearTimeout(timer);
  }, [phase, allRevealed, r3]);

  // Lật hết 6 trong play → chuyển sang reveal để hiện nút chuyển vòng + cộng điểm đã xong
  useEffect(() => {
    if (phase === 'play' && allRevealed && !r3) {
      setPhase('reveal');
    }
  }, [phase, allRevealed, r3]);



  const toGameEnd = useCallback(() => {
    setRoundScores(prev => [...prev, { A: scores.A, B: scores.B }]);
    setPhase('game-end');
    playSound('win');
  }, [scores, playSound]);

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

  function statusBadge() {
    if (phase === 'game-end' || phase === 'intro') return null;
    const base = "absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-2xl font-black uppercase tracking-widest border text-sm sm:text-base";
    if (r3) return <div className={`${base} bg-blue-600/90 border-blue-400 text-white`}>VÒNG 3 — LUÂN PHIÊN</div>;
    if (phase === 'steal') return <div className={`${base} bg-red-600 border-red-400 text-white animate-pulse`}>🔥 ĐỘI {stealingTeam} ĐANG CƯỚP ĐIỂM</div>;
    if (phase === 'team-select') return <div className={`${base} bg-white/10 border-white/30`}>VÒNG {currentRoundIdx + 1} — CHỌN ĐỘI BẮT ĐẦU</div>;
    return <div className={`${base} bg-white/10 border-white/30`}>VÒNG {currentRoundIdx + 1} — ĐỘI {activeTeam} ĐANG CHƠI</div>;
  }

  if (phase === 'game-end') {
    const winner = scores.A > scores.B ? 'ĐỘI A' : scores.B > scores.A ? 'ĐỘI B' : null;
    return (
      <div className="flex h-screen w-screen flex-col bg-[#020513] text-white items-center justify-center font-sans font-bold relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 bg-[#eab308] rounded-full animate-[confetti_1.8s_linear_infinite]" style={{ left: `${(i * 7) % 100}%`, top: `-${20 + (i % 5) * 10}px`, animationDelay: `-${i * 0.07}s` }} />
          ))}
        </div>
        <div className="text-7xl text-[#eab308] font-black mb-6 z-10">CHUNG SỨC</div>
        <div className="text-6xl font-black mb-10 z-10">{winner ? `${winner} CHIẾN THẮNG!` : 'HÒA!'}</div>
        <div className="flex gap-12 mb-8 text-4xl z-10">
          <div>ĐỘI A: <span className="font-mono text-[#eab308]">{scores.A}</span></div>
          <div>ĐỘI B: <span className="font-mono text-[#eab308]">{scores.B}</span></div>
        </div>
        <button onClick={() => window.location.reload()} className="bg-[#eab308] text-black px-12 py-4 text-2xl font-black rounded-2xl z-10">CHƠI LẠI</button>
      </div>
    );
  }

  // ─── OPENING SCREEN (tách riêng) ────────────────────────────────
  if (phase === 'intro') {
    return <OpeningScreen onStart={handleStart} openingRef={openingRef} />;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none">
      {statusBadge()}

      <div className="flex-1 flex flex-col max-w-[1800px] mx-auto w-full px-3 sm:px-4 md:px-6 pt-12 md:pt-14 lg:pt-16">
        <div className="border-[3px] md:border-4 border-[#eab308] bg-[#0a1930] rounded-2xl md:rounded-3xl p-4 md:p-6 text-center mb-3 md:mb-4">
          <div className="text-base sm:text-lg md:text-xl lg:text-2xl font-black tracking-wide leading-tight">{currentRound.question}</div>
          {!r3 && phase !== 'team-select' && <div className="mt-2 md:mt-3 text-4xl md:text-5xl lg:text-6xl font-mono text-[#eab308]">{roundPoints}</div>}
        </div>

        {/* Strikes */}
        {!r3 && (phase === 'play' || phase === 'steal') && (
          <div className="flex justify-center gap-2 md:gap-3 mb-2 md:mb-3">
            {[0,1,2].map(i => <div key={i} className={`w-9 h-9 md:w-11 md:h-11 border-4 rounded-xl flex items-center justify-center ${i < strikes ? 'border-red-600 text-red-600' : 'border-white/20 text-white/20'}`}><X size={22} className="md:hidden" /><X size={28} strokeWidth={6} className="hidden md:block" /></div>)}
            <span className="self-center ml-2 text-xs md:text-sm text-white/60">({strikes}/3)</span>
            {phase === 'play' && <span className="ml-4 text-yellow-400 font-mono text-xl">{answerTimer}s</span>}
          </div>
        )}
        {r3 && (phase === 'play' || phase === 'steal') && (
          <div className="flex justify-center gap-4 md:gap-8 mb-2 md:mb-3 text-sm md:text-base">
            {(['A','B'] as const).map(t => {
              const sc = t === 'A' ? r3StrikesA : r3StrikesB;
              return <div key={t} className="flex items-center gap-1.5"><span className="text-white/70">ĐỘI {t}</span>{[0,1,2].map(i => <div key={i} className={`w-7 h-7 md:w-8 md:h-8 border-2 rounded flex items-center justify-center ${i<sc?'border-red-600 text-red-600':'border-white/20'}`}><X size={16} strokeWidth={5}/></div>)}<span className="text-xs text-red-400">({sc}/3)</span></div>;
            })}
            {r3ActiveTeam && <div className="ml-4 text-yellow-400 font-mono text-xl">{answerTimer}s</div>}
          </div>
        )}

        {/* Grid - tối ưu desktop landscape & mobile */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6 flex-1 pb-2">
          {currentRound.answers.map((ans, i) => {
            const exposed = phase === 'reveal' || phase === 'round-end' || phase === 'round3-end' || revealed[i];
            return (
              <div key={i} onClick={() => handleFlip(i)} className="h-[72px] sm:h-20 md:h-24 lg:h-28 cursor-pointer">
                <motion.div 
                  animate={{ rotateX: exposed ? 180 : 0, scale: exposed ? 1.03 : 1 }} 
                  transition={{ type: "spring", stiffness: 280, damping: 20, mass: 0.8 }}
                  className="relative w-full h-full preserve-3d"
                >
                  <div className="absolute inset-0 backface-hidden bg-[#1e3a8a] border-[3px] md:border-4 border-[#eab308] rounded-2xl flex items-center justify-center">
                    {!exposed && <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#eab308] text-black text-3xl md:text-4xl font-black flex items-center justify-center">{i + 1}</div>}
                  </div>
                  <div className="absolute inset-0 backface-hidden bg-[#0f172a] border-[3px] md:border-4 border-[#eab308] rounded-2xl flex items-center justify-between px-4 md:px-6" style={{ transform: 'rotateX(180deg)' }}>
                    <div className="text-white text-sm md:text-lg lg:text-xl font-black leading-tight pr-2">{ans.text}</div>
                    <div className="text-3xl md:text-5xl font-mono text-[#eab308] font-black">{ans.points}</div>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar - tối ưu mobile landscape & desktop */}
      {showBottomBar && (
        <div className="h-20 sm:h-24 md:h-28 bg-black border-t-[6px] md:border-t-8 border-[#eab308] flex items-stretch px-3 md:px-6 gap-2 md:gap-4">
          <div className="flex-1 flex flex-col justify-center items-center border-4 border-[#eab308] rounded-xl md:rounded-2xl bg-black/70">
            <div className="text-[10px] md:text-sm text-white/70">ĐỘI A</div>
            <div className="text-4xl md:text-6xl font-mono text-[#eab308] font-black leading-none">{scores.A.toString().padStart(3, '0')}</div>
          </div>

          <div className="flex-[2] flex items-center justify-center gap-2 md:gap-3">
            {phase === 'team-select' && !r3 && (
              <>
                <button onClick={() => handleTeamSelect('A')} className="flex-1 bg-blue-600 text-white text-sm md:text-xl font-black py-3 md:py-4 rounded-xl md:rounded-2xl">ĐỘI A CHƠI TRƯỚC</button>
                <button onClick={() => handleTeamSelect('B')} className="flex-1 bg-blue-600 text-white text-sm md:text-xl font-black py-3 md:py-4 rounded-xl md:rounded-2xl">ĐỘI B CHƠI TRƯỚC</button>
              </>
            )}

            {r3 && phase === 'play' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full max-w-lg">
                <button onClick={() => setR3ActiveTeam('A')}
                  disabled={r3StrikesA >= 3}
                  className={`flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl uppercase font-black text-sm md:text-base transition-all
                    ${r3StrikesA >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'A'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesA >= 3 ? 'ĐỘI A ĐÃ KHÓA 3❌' : 'ĐỘI A TRẢ LỜI'}
                </button>
                <button onClick={() => setR3ActiveTeam('B')}
                  disabled={r3StrikesB >= 3}
                  className={`flex-1 py-2.5 md:py-3 rounded-xl md:rounded-2xl uppercase font-black text-sm md:text-base transition-all
                    ${r3StrikesB >= 3
                      ? 'bg-gray-800/60 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                      : r3ActiveTeam === 'B'
                        ? 'bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[3px] border-[#1e3a8a] text-white shadow-lg'
                        : 'bg-white/10 border-2 border-white/20 text-white/80 hover:bg-white/20'}`}>
                  {r3StrikesB >= 3 ? 'ĐỘI B ĐÃ KHÓA 3❌' : 'ĐỘI B TRẢ LỜI'}
                </button>
              </div>
            )}

            {phase === 'play' && !r3 && (
              <>
                <button 
                  onClick={() => {
                    setAnswerTimer(15);
                    setIsTimerActive(true);
                    setNotification({ text: 'BẮT ĐẦU ĐẾM 15 GIÂY!', type: 'end' });
                    setTimeout(() => setNotification(null), 1200);
                  }} 
                  className="bg-yellow-600 text-black text-sm md:text-lg font-black px-4 py-2 rounded-xl mb-1"
                >
                  BẮT ĐẦU ĐẾM 15s
                </button>
                <button onClick={handleStrike} className="bg-red-600 text-white text-xl md:text-3xl font-black px-8 md:px-16 py-3 md:py-4 rounded-xl md:rounded-2xl">SAI ❌</button>
              </>
            )}
            {r3 && phase === 'play' && r3ActiveTeam && (
              <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md items-center">
                <button 
                  onClick={() => {
                    setAnswerTimer(15);
                    setIsTimerActive(true);
                    setNotification({ text: 'BẮT ĐẦU ĐẾM 15 GIÂY!', type: 'end' });
                    setTimeout(() => setNotification(null), 1200);
                  }} 
                  className="flex-1 bg-yellow-600 text-black text-sm md:text-base font-black px-4 py-2.5 rounded-xl"
                >
                  BẮT ĐẦU ĐẾM 15s
                </button>
                <button onClick={handleStrike} className="flex-1 bg-red-600 text-white text-base md:text-xl font-black px-6 py-2.5 rounded-xl">SAI ❌ — ĐỘI {r3ActiveTeam}</button>
              </div>
            )}
            {phase === 'steal' && !r3 && <button onClick={handleStrike} className="bg-red-600 text-white text-xl md:text-3xl font-black px-8 md:px-16 py-3 md:py-4 rounded-xl md:rounded-2xl">STEAL SAI ❌</button>}

            {phase === 'reveal' && allRevealed && (
              <button onClick={r3 ? toGameEnd : nextRound} className="bg-green-600 text-white text-lg md:text-2xl font-black px-6 md:px-12 py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center gap-2">
                {r3 ? 'XEM KẾT QUẢ' : 'SANG VÒNG TIẾP'} <ChevronRight size={22} className="md:hidden" /><ChevronRight size={28} className="hidden md:block" />
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center border-4 border-[#eab308] rounded-xl md:rounded-2xl bg-black/70">
            <div className="text-[10px] md:text-sm text-white/70">ĐỘI B</div>
            <div className="text-4xl md:text-6xl font-mono text-[#eab308] font-black leading-none">{scores.B.toString().padStart(3, '0')}</div>
          </div>
        </div>
      )}

      {/* Flying points animation */}
      {flyingPoints.map(fp => (
        <div key={fp.id} className="absolute z-[60] text-4xl font-black text-[#eab308] pointer-events-none" style={{ left: fp.x, top: fp.y }}>
          <motion.div 
            initial={{ y: 0, opacity: 1, scale: 0.6 }} 
            animate={{ y: -160, opacity: 0, scale: 1.3 }} 
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            +{fp.pts}
          </motion.div>
        </div>
      ))}

      {/* Notification animations */}
      {notification && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className={`px-10 py-6 rounded-3xl text-4xl md:text-6xl font-black text-center border-4 shadow-2xl
              ${notification.type === 'steal' ? 'bg-red-600 border-red-400 text-white animate-pulse' : ''}
              ${notification.type === 'success' ? 'bg-yellow-400 border-yellow-300 text-black' : ''}
              ${notification.type === 'fail' || notification.type === 'strike' ? 'bg-red-700 border-red-500 text-white' : ''}
              ${notification.type === 'end' ? 'bg-[#eab308] border-yellow-400 text-black' : ''}
            `}>
            {notification.text}
          </motion.div>
        </div>
      )}

      {/* Overlays */}

      {phase === 'round3-end' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center z-50">
          <div className="text-6xl text-[#eab308] font-black mb-6">VÒNG 3 KẾT THÚC</div>
          <div className="text-3xl mb-8 text-white/80">Điểm vòng này</div>
          <div className="flex gap-16 text-5xl font-mono mb-10">
            <div className="text-[#eab308]">ĐỘI A: {roundScoreThis.A}</div>
            <div className="text-[#eab308]">ĐỘI B: {roundScoreThis.B}</div>
          </div>
          <button onClick={toGameEnd} className="bg-[#eab308] text-black px-16 py-5 text-3xl font-black rounded-2xl">XEM KẾT QUẢ CUỐI CÙNG</button>
        </div>
      )}
    </div>
  );
}
