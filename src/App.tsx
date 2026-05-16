import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

type Phase = 'intro' | 'team-select' | 'play' | 'steal' | 'round-end-wait' | 'round-end' | 'game-end';
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

export default function App() {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [scores, setScores] = useState({ A: 0, B: 0 });
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [roundPoints, setRoundPoints] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(Array(6).fill(false));
  const [strikes, setStrikes] = useState(0);

  const stateRef = useRef({ phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores });
  useEffect(() => {
    stateRef.current = { phase, activeTeam, roundPoints, revealed, strikes, currentRoundIdx, scores };
  });

  const audiosRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    audiosRef.current = {
       ding: new Audio('https://www.myinstants.com/media/sounds/family-feud-good-answer.mp3'),
       strike: new Audio('https://www.myinstants.com/media/sounds/family-feud-strike-sfx_kN6Z99k.mp3'),
       win: new Audio('https://www.myinstants.com/media/sounds/family-feud-win-sound-effect.mp3'),
    };
    Object.values(audiosRef.current).forEach((a) => (a as HTMLAudioElement).load());
  }, []);

  const playSound = useCallback((type: 'ding' | 'strike' | 'win') => {
    try {
      const audio = audiosRef.current[type];
      if (audio) {
        const clone = audio.cloneNode() as HTMLAudioElement;
        clone.play().catch(e => console.warn('Audio play error', e));
      }
    } catch(e) { console.warn("Audio error", e); }
  }, []);

  const handleFlip = useCallback((i: number) => {
    const s = stateRef.current;
    if (s.revealed[i]) return;
    if (s.phase === 'team-select' || s.phase === 'game-end') return;

    playSound('ding');
    const newRevealed = [...s.revealed];
    newRevealed[i] = true;
    setRevealed(newRevealed);

    if (s.phase === 'play') {
      const newPoints = s.roundPoints + DATA[s.currentRoundIdx].answers[i].points;
      setRoundPoints(newPoints);
      
      if (newRevealed.every(x => x)) {
         setTimeout(() => {
             setScores(prev => ({ ...prev, [s.activeTeam!]: prev[s.activeTeam!] + newPoints }));
             setPhase('round-end');
         }, 1000);
      }
    } else if (s.phase === 'steal') {
      const stealingTeam = s.activeTeam === 'A' ? 'B' : 'A';
      const stealPoints = DATA[s.currentRoundIdx].answers[i].points * 2;
      const totalWon = s.roundPoints + stealPoints;
      
      setRoundPoints(totalWon);
      setScores(prev => ({ ...prev, [stealingTeam]: prev[stealingTeam] + totalWon }));
      setTimeout(() => setPhase('round-end'), 1500);
    }
  }, [playSound]);

  const handleStrike = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'play' && s.phase !== 'steal') return;
    if (s.phase === 'play' && s.strikes >= 3) return;
    
    playSound('strike');

    if (s.phase === 'play') {
       setStrikes(prev => {
         const newStrikes = prev + 1;
         if (newStrikes === 3) {
            setTimeout(() => setPhase('steal'), 800);
         }
         return newStrikes;
       });
    } else if (s.phase === 'steal') {
       setPhase('round-end-wait'); // Add a temporary phase to block further actions
       setScores(prev => ({ ...prev, [s.activeTeam!]: prev[s.activeTeam!] + s.roundPoints }));
       setTimeout(() => setPhase('round-end'), 1200);
    }
  }, [playSound]);

  const handleTeamSelect = useCallback((team: Team) => {
    setActiveTeam(team);
    setPhase('play');
  }, []);

  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.currentRoundIdx < DATA.length - 1) {
      setCurrentRoundIdx(prev => prev + 1);
      setRoundPoints(0);
      setRevealed(Array(6).fill(false));
      setStrikes(0);

      setPhase('team-select');
      setActiveTeam(null);
    } else {
      setPhase('game-end');
      playSound('win');
    }
  }, [playSound]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      const s = stateRef.current;

      if (['1', '2', '3', '4', '5', '6'].includes(key)) {
         handleFlip(parseInt(key) - 1);
         return;
      }
      if (key === 'x' || key === ' ') {
         e.preventDefault();
         handleStrike();
         return;
      }
      if (key === 'f') {
         if (!document.fullscreenElement) {
           document.documentElement.requestFullscreen().catch(()=>{});
         } else {
           document.exitFullscreen().catch(()=>{});
         }
         return;
      }
      if (s.phase === 'team-select') {
         if (key === 'a') handleTeamSelect('A');
         if (key === 'b') handleTeamSelect('B');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleStrike, handleTeamSelect]);

  const currentRound = DATA[currentRoundIdx];
  const stealingTeam = activeTeam === 'A' ? 'B' : 'A';

  return (
    <div className="flex h-screen w-screen flex-col bg-[#020513] text-white overflow-hidden font-sans font-bold select-none">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      {phase === 'intro' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020513] text-center gap-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.15)_0%,transparent_70%)] pointer-events-none" />
          <h1 className="text-[min(12vw,120px)] text-[#eab308] font-black tracking-widest uppercase drop-shadow-[0_0_30px_rgba(234,179,8,0.5)]">FAMILY FEUD</h1>
          <button 
            onClick={() => { setPhase('team-select'); }}
            className="z-10 bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[8px] border-[#713f12] active:border-b-0 active:translate-y-[8px] hover:brightness-110 text-black px-16 py-6 uppercase text-3xl font-black rounded-3xl cursor-pointer transition-all shadow-[0_10px_30px_rgba(234,179,8,0.4)]"
          >
            BẮT ĐẦU CHƠI
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-[1_1_0] flex flex-col items-center justify-center pt-4 md:pt-6 pb-2 relative z-10 w-full max-w-6xl mx-auto px-4 min-h-0">
        {phase === 'game-end' ? (
          <div className="flex flex-col items-center justify-center text-center gap-6 md:gap-10 w-full flex-1">
             <h1 className="text-5xl md:text-7xl xl:text-8xl text-[#eab308] font-black mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)] uppercase tracking-wider">CHUNG CUỘC</h1>
             <div className="text-4xl md:text-6xl font-black text-[#ffffff] mt-4 md:mt-8 animate-pulse drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] tracking-widest border-4 border-white/20 px-8 py-4 md:px-12 md:py-6 rounded-full bg-white/5">
                {scores.A > scores.B ? 'ĐỘI A CHIẾN THẮNG!' : scores.B > scores.A ? 'ĐỘI B CHIẾN THẮNG!' : 'TRẬN HÒA!'}
             </div>
             <button onClick={() => window.location.reload()} className="mt-8 bg-gradient-to-b from-[#eab308] to-[#a16207] border-b-[6px] border-[#713f12] active:border-b-0 active:translate-y-[6px] hover:brightness-110 text-black px-8 py-4 md:px-12 md:py-5 uppercase text-xl md:text-2xl font-black rounded-2xl cursor-pointer text-center transition-all shadow-[0_10px_30px_rgba(234,179,8,0.4)]">CHƠI LẠI TỪ ĐẦU</button>
          </div>
        ) : (
          <div className="flex flex-col items-center h-full w-full max-w-6xl mx-auto min-h-0">
            {/* Question Box */}
            <div className={`w-full border-[4px] border-[#eab308] bg-gradient-to-b from-[#0a1930] to-[#01081a] rounded-3xl p-4 md:p-6 mb-4 text-center shadow-[0_10px_40px_rgba(234,179,8,0.2)] transition-all duration-500 flex flex-col items-center justify-center flex-shrink-0 ${phase === 'team-select' ? 'scale-105' : 'scale-100'}`}>
              <h1 className="text-2xl md:text-3xl xl:text-4xl text-white font-black uppercase tracking-wide drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] leading-tight mb-3 md:mb-4">{currentRound.question}</h1>
              {phase !== 'intro' && phase !== 'game-end' && (
                <div className="flex items-center justify-center bg-black/80 border-2 border-[#eab308]/50 rounded-2xl px-6 py-2 shadow-[0_5px_20px_rgba(0,0,0,0.5)]">
                   <span className="text-[#eab308] text-xs md:text-sm xl:text-lg uppercase tracking-[3px] font-black mr-4 drop-shadow-[1px_1px_0_#000]">ĐIỂM VÒNG {currentRoundIdx + 1}</span>
                   <span className="font-mono text-3xl md:text-4xl xl:text-5xl text-[#eab308] font-black leading-none drop-shadow-[0_0_15px_rgba(234,179,8,0.7)]">{roundPoints}</span>
                </div>
              )}
            </div>
            
            {/* Strikes */}
            {(phase === 'play' || phase === 'steal') && (
              <div className="flex gap-4 mb-4 flex-shrink-0">
                {Array.from({length: 3}).map((_, i) => (
                  <div key={i} className={`w-[40px] h-[40px] md:w-[50px] md:h-[50px] border-[3px] rounded-xl flex items-center justify-center font-black transition-all duration-300 ${i < strikes ? 'border-[#ff0000] text-[#ff0000] bg-[#600000] shadow-[0_0_15px_#ff0000]' : 'border-white/20 text-white/20 bg-black/40'}`}>
                    <X strokeWidth={5} className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                ))}
              </div>
            )}

            {/* Answer Grid */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 md:gap-y-4 md:gap-x-6 xl:gap-y-6 xl:gap-x-10 w-full perspective-1000 flex-[1_1_150px] min-h-0 mb-4 xl:mb-6">
               {currentRound.answers.map((ans, i) => (
                 <div key={i} className="relative w-full h-full min-h-[50px] cursor-pointer group" onClick={() => handleFlip(i)}>
                   <motion.div 
                     className="w-full h-full relative preserve-3d" 
                     animate={{ rotateX: revealed[i] ? 180 : 0 }}
                     transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                   >
                     <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] border-[3px] md:border-[4px] border-[#eab308] rounded-xl flex items-center justify-center shadow-[0_5px_10px_rgba(0,0,0,0.6),inset_0_2px_15px_rgba(255,255,255,0.1)] group-hover:brightness-110 transition-all">
                        <div className="bg-gradient-to-br from-[#fef08a] to-[#ca8a04] w-10 h-10 md:w-14 md:h-14 xl:w-16 xl:h-16 rounded-full flex items-center justify-center text-2xl md:text-3xl xl:text-4xl font-black text-black border-[3px] md:border-[4px] border-white shadow-[0_3px_10px_rgba(0,0,0,0.4)]">
                          {i + 1}
                        </div>
                     </div>
                     
                     <div className="absolute inset-0 backface-hidden bg-gradient-to-b from-[#0f172a] to-[#020617] border-[3px] md:border-[4px] border-[#eab308] rounded-xl shadow-[0_5px_15px_rgba(234,179,8,0.2),inset_0_2px_15px_rgba(255,255,255,0.1)] flex items-center justify-between px-3 md:px-6 xl:px-8 group-hover:brightness-110 transition-all" style={{ transform: 'rotateX(180deg)' }}>
                       <div className="text-white font-black text-sm md:text-lg xl:text-2xl break-words whitespace-normal pr-2 md:pr-4 uppercase tracking-wider drop-shadow-[1px_1px_0_#000] text-left leading-tight overflow-hidden h-full flex items-center shrink">
                          <span className="line-clamp-2 md:line-clamp-3 w-full">{ans.text}</span>
                       </div>
                       <div className="font-mono text-2xl md:text-4xl xl:text-5xl text-[#eab308] font-black leading-none drop-shadow-[2px_2px_0_#000] min-w-[50px] md:min-w-[70px] xl:min-w-[90px] text-center border-l-2 md:border-l-4 border-white/20 pl-2 md:pl-4 xl:pl-6 shrink-0 flex items-center justify-center h-full">
                          {ans.points}
                       </div>
                     </div>
                   </motion.div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar Container */}
      <div className="h-[120px] md:h-[160px] lg:h-[180px] shrink-0 w-full bg-gradient-to-b from-[#1a0505] to-[#000] border-t-8 border-[#eab308] flex items-center py-2 px-4 md:py-4 md:px-8 gap-4 md:gap-8 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
         {/* Team A */}
         <div className={`flex-1 flex flex-col justify-center items-center h-full ${activeTeam === 'A' ? 'shadow-[0_0_40px_rgba(234,179,8,0.4)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'} border-2 md:border-4 rounded-2xl md:rounded-3xl transition-all duration-300 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-sm md:text-lg xl:text-xl uppercase tracking-[2px] md:tracking-[4px] text-white font-black mb-1 md:mb-2 z-10 drop-shadow-[2px_2px_0_#000]">Đội A</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-[2px] md:border-[4px] border-[#eab308] px-4 md:px-8 py-1 md:py-2 rounded-xl md:rounded-2xl text-center min-w-[80px] md:min-w-[120px] lg:min-w-[150px] shadow-[inset_0_0_20px_rgba(234,179,8,0.2),0_5px_15px_rgba(0,0,0,0.8)] z-10">
               <div className="font-mono text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">{scores.A.toString().padStart(3, '0')}</div>
            </div>
         </div>

         {/* Controls */}
         <div className="flex-[2] flex flex-col items-center justify-center border-x-2 border-white/10 px-2 md:px-4 h-full relative overflow-hidden">
            <div className="w-full flex items-center justify-center gap-2 md:gap-4 xl:gap-8">
               {phase === 'team-select' && (
                 <>
                   <button onClick={() => handleTeamSelect('A')} className="bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-3 md:px-6 py-2 md:py-4 uppercase text-xs md:text-lg font-black rounded-xl md:rounded-2xl flex-1 transition-all shadow-lg text-center break-words">CHỌN ĐỘI A</button>
                   <button onClick={() => handleTeamSelect('B')} className="bg-gradient-to-b from-[#2563eb] to-[#1e3a8a] border-b-[4px] md:border-b-[6px] border-[#1e3a8a] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-3 md:px-6 py-2 md:py-4 uppercase text-xs md:text-lg font-black rounded-xl md:rounded-2xl flex-1 transition-all shadow-lg text-center break-words">CHỌN ĐỘI B</button>
                 </>
               )}
               
               {(phase === 'play' || phase === 'steal') && (
                  <div className="w-full max-w-sm flex flex-col items-center">
                    <button 
                      onClick={handleStrike} 
                      className="bg-gradient-to-b from-[#dc2626] to-[#991b1b] border-b-[4px] md:border-b-[6px] border-[#7f1d1d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-6 md:px-10 py-3 md:py-4 uppercase text-sm md:text-xl font-black rounded-xl md:rounded-2xl transition-all shadow-[0_5px_15px_rgba(220,38,38,0.5)] w-full text-center"
                    >
                      {phase === 'steal' ? 'CƯỚP THẤT BẠI [X]' : 'SAI [X]'}
                    </button>
                    {phase === 'steal' && (
                      <div className="text-[10px] md:text-sm text-[#eab308] font-black uppercase tracking-widest animate-pulse drop-shadow-[1px_1px_0_#000] mt-1 md:mt-2 text-center truncate w-full">
                         Cơ hội cướp điểm cho đội {stealingTeam}!
                      </div>
                    )}
                  </div>
               )}
               
               {phase === 'round-end' && (
                 <button onClick={nextRound} className="bg-gradient-to-b from-[#16a34a] to-[#15803d] border-b-[4px] md:border-b-[6px] border-[#14532d] active:border-b-0 active:translate-y-[4px] hover:brightness-110 text-white px-6 md:px-12 py-3 md:py-4 uppercase text-sm md:text-xl font-black rounded-xl md:rounded-2xl transition-all shadow-[0_5px_15px_rgba(22,163,74,0.4)] text-center">VÒNG KẾ TIẾP</button>
               )}
            </div>
         </div>

         {/* Team B */}
         <div className={`flex-1 flex flex-col justify-center items-center h-full ${activeTeam === 'B' ? 'shadow-[0_0_40px_rgba(234,179,8,0.4)] bg-[#eab308]/20 border-[#eab308]' : 'bg-black/60 border-white/10'} border-2 md:border-4 rounded-2xl md:rounded-3xl transition-all duration-300 relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 pointer-events-none" />
            <div className="text-sm md:text-lg xl:text-xl uppercase tracking-[2px] md:tracking-[4px] text-white font-black mb-1 md:mb-2 z-10 drop-shadow-[2px_2px_0_#000]">Đội B</div>
            <div className="bg-gradient-to-b from-[#111] to-[#000] border-[2px] md:border-[4px] border-[#eab308] px-4 md:px-8 py-1 md:py-2 rounded-xl md:rounded-2xl text-center min-w-[80px] md:min-w-[120px] lg:min-w-[150px] shadow-[inset_0_0_20px_rgba(234,179,8,0.2),0_5px_15px_rgba(0,0,0,0.8)] z-10">
               <div className="font-mono text-3xl md:text-5xl lg:text-6xl text-[#eab308] font-black leading-none drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">{scores.B.toString().padStart(3, '0')}</div>
            </div>
         </div>
      </div>
    </div>
  );
}
