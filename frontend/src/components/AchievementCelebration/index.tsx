import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAchievementStore } from '../../store/achievementStore';
import './AchievementCelebration.css';

const MOTIVATIONAL = [
  'Você é incrível! Cada conquista te aproxima da aprovação!',
  'Foco e determinação são suas maiores armas. Continue assim!',
  'Sua dedicação está transformando seu futuro!',
  'O caminho para a aprovação é feito de conquistas como essa!',
  'Você provou que é capaz — agora vai em busca da próxima!',
  'Disciplina gera resultados. Você está no caminho certo!',
  'Cada passo conta. Você está evoluindo todos os dias!',
  'Excelente! Continue acumulando conquistas e chegará lá!',
  'A consistência é a chave do sucesso. Parabéns!',
  'Seu esforço está valendo a pena. Nunca pare!',
];

const CATEGORY_LABELS: Record<string, string> = {
  pomodoro: '🍅 Pomodoro',
  quiz: '❓ Quiz',
  flashcards: '🃏 Flashcards',
  horas: '⏱ Horas de Estudo',
  consistencia: '🔥 Consistência',
};

function launchConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    color: string;
    w: number; h: number;
    rotation: number;
    rotSpeed: number;
    opacity: number;
  };

  const colors = ['#f59e0b','#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899','#f97316','#14b8a6','#fbbf24'];
  const particles: Particle[] = Array.from({ length: 220 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 140,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * 4 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    w: Math.random() * 14 + 5,
    h: Math.random() * 7 + 3,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.22,
    opacity: 1,
  }));

  let animId: number;
  let active = true;

  const animate = () => {
    if (!active) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let anyVisible = false;

    for (const p of particles) {
      if (p.y > canvas.height + 20) continue;
      anyVisible = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      if (p.y > canvas.height * 0.65) p.opacity = Math.max(0, p.opacity - 0.022);
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (anyVisible) animId = requestAnimationFrame(animate);
  };

  animId = requestAnimationFrame(animate);
  return () => { active = false; cancelAnimationFrame(animId); };
}

const AchievementCelebration: React.FC = () => {
  const { newUnlocks, allAchievements, clearNewUnlocks } = useAchievementStore();
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const [motivation] = useState(
    () => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const startConfetti = useCallback(() => {
    if (canvasRef.current) {
      cleanupRef.current?.();
      cleanupRef.current = launchConfetti(canvasRef.current);
    }
  }, []);

  useEffect(() => {
    if (newUnlocks.length > 0) {
      setIdx(0);
      setVisible(true);
      setTimeout(startConfetti, 60);
    }
  }, [newUnlocks, startConfetti]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const handleNext = useCallback(() => {
    if (idx < newUnlocks.length - 1) {
      setIdx(i => i + 1);
      setTimeout(startConfetti, 60);
    } else {
      cleanupRef.current?.();
      setVisible(false);
      clearNewUnlocks();
    }
  }, [idx, newUnlocks.length, clearNewUnlocks, startConfetti]);

  if (!visible || newUnlocks.length === 0) return null;

  const current = newUnlocks[idx];
  const nextLocked = allAchievements.find(a => !a.unlocked);
  const isLast = idx === newUnlocks.length - 1;

  return (
    <>
      <canvas ref={canvasRef} className="ach-confetti" />
      <div className="ach-cel__overlay" onClick={handleNext}>
        <div className="ach-cel__card" onClick={e => e.stopPropagation()}>
          <div className="ach-cel__badge">🏆 Nova Conquista Desbloqueada!</div>

          <div className="ach-cel__icon">{current.icon ?? '⭐'}</div>
          <h2 className="ach-cel__title">{current.title}</h2>
          <p className="ach-cel__cat">
            {CATEGORY_LABELS[current.category] ?? current.category}
          </p>

          <div className="ach-cel__gained">
            <span className="ach-cel__gained-icon">⭐</span>
            <span>+1 Estrela conquistada!</span>
          </div>

          <p className="ach-cel__motivation">"{motivation}"</p>

          {nextLocked && (
            <div className="ach-cel__next">
              <span className="ach-cel__next-label">O que falta desbloquear:</span>
              <div className="ach-cel__next-chip">
                <span className="ach-cel__next-lock">🔒</span>
                <div className="ach-cel__next-info">
                  <span className="ach-cel__next-name">{nextLocked.title}</span>
                  {nextLocked.threshold != null && (
                    <span className="ach-cel__next-progress">
                      {nextLocked.progress} / {nextLocked.threshold}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {newUnlocks.length > 1 && (
            <div className="ach-cel__counter">
              {idx + 1} de {newUnlocks.length} conquistas
            </div>
          )}

          <button className="ach-cel__btn" onClick={handleNext}>
            {isLast ? 'Continuar estudando!' : `Próxima conquista (${idx + 2}/${newUnlocks.length}) →`}
          </button>

          <p className="ach-cel__dismiss">Clique fora para fechar</p>
        </div>
      </div>
    </>
  );
};

export default AchievementCelebration;
