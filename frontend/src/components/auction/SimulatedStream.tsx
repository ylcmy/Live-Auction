import { useRef, useEffect, useCallback } from 'react';

interface SimulatedStreamProps {
  roomId: number;
  productName: string;
  productImage: string | null;
  currentPrice: number;
  participantCount: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  emoji: string;
  size: number;
}

interface Comment {
  text: string;
  x: number;
  y: number;
  speed: number;
  color: string;
  alpha: number;
}

// Room-specific colors derived from roomId
function roomColors(roomId: number) {
  const hues = [
    [340, 80], [200, 70], [140, 60], [30, 80], [270, 70],
    [180, 60], [10, 80], [220, 60], [160, 70], [50, 80],
  ];
  const [bgHue, bgSat] = hues[roomId % hues.length]!;
  return {
    bg: `hsl(${bgHue}, ${bgSat}%, 12%)`,
    bgLight: `hsl(${bgHue}, ${bgSat}%, 18%)`,
    accent: `hsl(${(bgHue + 30) % 360}, 85%, 55%)`,
    accent2: `hsl(${(bgHue + 180) % 360}, 70%, 50%)`,
  };
}

const EMOJIS = ['❤️', '🔥', '🎉', '💎', '⭐', '👑', '💥', '🎯', '🏆', '✨'];
const NICKNAMES = ['拍客', '路人', '铁粉', '钻粉', '挚爱', '榜一', '守护', '会员'];
const MESSAGES = [
  '来了来了！', '冲啊！', '这价格可以', '加价加价', '别跟我抢',
  '我要了', '好东西啊', '666', '太值了', '必拿下', '绝了', '冲',
  '老板大气', '让让我吧', '势在必得', '这个好', '姐妹们冲',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function SimulatedStream({
  roomId,
  productName,
  productImage,
  currentPrice,
  participantCount,
}: SimulatedStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const commentsRef = useRef<Comment[]>([]);
  const frameRef = useRef(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageLoadedRef = useRef(false);

  // Load product image
  useEffect(() => {
    if (!productImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      imageLoadedRef.current = true;
    };
    img.src = productImage;
    return () => { imageLoadedRef.current = false; };
  }, [productImage]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const f = frameRef.current++;
    const colors = roomColors(roomId);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, colors.bg);
    bgGrad.addColorStop(0.5, colors.bgLight);
    bgGrad.addColorStop(1, colors.bg);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid pattern
    ctx.strokeStyle = `rgba(255,255,255,0.03)`;
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Animated gradient orbs
    for (let i = 0; i < 3; i++) {
      const ox = w * (0.3 + 0.4 * Math.sin(f * 0.01 + i * 2.1));
      const oy = h * (0.3 + 0.4 * Math.cos(f * 0.013 + i * 1.7));
      const r = Math.min(w, h) * 0.25;
      const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      orbGrad.addColorStop(0, `rgba(255,255,255,0.04)`);
      orbGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = orbGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Product image area (center-left)
    const imgX = w * 0.05;
    const imgY = h * 0.12;
    const imgW = w * 0.42;
    const imgH = h * 0.55;

    if (imageLoadedRef.current && imageRef.current) {
      // Image frame glow
      ctx.save();
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 20 + 10 * Math.sin(f * 0.05);
      ctx.fillStyle = colors.bgLight;
      ctx.beginPath();
      ctx.roundRect(imgX - 3, imgY - 3, imgW + 6, imgH + 6, 12);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, 10);
      ctx.clip();
      const img = imageRef.current!;
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const sx = imgX + (imgW - sw) / 2;
      const sy = imgY + (imgH - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh);
      ctx.restore();

      // Vignette on image
      const vignetteGrad = ctx.createLinearGradient(imgX, imgY, imgX, imgY + imgH);
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vignetteGrad;
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, 10);
      ctx.fill();
    } else {
      // Placeholder
      ctx.fillStyle = colors.bgLight;
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = `${imgW * 0.08}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('商品预览', imgX + imgW / 2, imgY + imgH / 2);
    }

    // Product name on image
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(imgX, imgY + imgH - 52, imgW, 52, [0, 0, 10, 10]);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(imgW * 0.06, 18)}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(productName, imgX + 14, imgY + imgH - 18);

    // Price display (right side, top)
    const priceX = w * 0.54;
    const priceY = h * 0.18;
    ctx.fillStyle = colors.accent;
    ctx.font = `bold ${Math.min(w * 0.04, 28)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('当前出价', priceX, priceY);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(w * 0.07, 48)}px sans-serif`;
    const priceText = `¥${currentPrice.toLocaleString()}`;
    const priceW = ctx.measureText(priceText).width;
    ctx.fillText(priceText, priceX, priceY + 48);

    // Price pulse
    if (Math.sin(f * 0.08) > 0.7) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(f * 0.12);
      ctx.beginPath();
      ctx.arc(priceX + priceW + 16, priceY + 38, 8 + Math.sin(f * 0.1) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Participant count
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.min(w * 0.02, 14)}px sans-serif`;
    ctx.fillText(`🔥 ${participantCount} 人参与竞拍`, priceX, priceY + 80);

    // Online count badge
    const badgeW = 72;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(w - badgeW - 16, 16, badgeW, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`👥 ${participantCount + 128}`, w - 22, 32);

    // Particles (floating emojis)
    const particles = particlesRef.current;
    if (f % 20 === 0) {
      particles.push({
        x: Math.random() * w,
        y: h + 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(1 + Math.random() * 2.5),
        life: 0,
        maxLife: 150 + Math.random() * 200,
        emoji: randomItem(EMOJIS),
        size: 18 + Math.random() * 24,
      });
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      const alpha = Math.min(1, 1 - p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `${p.size}px sans-serif`;
      ctx.fillText(p.emoji, p.x, p.y);
      ctx.globalAlpha = 1;
      if (p.life >= p.maxLife) particles.splice(i, 1);
    }

    // Scrolling comments (bottom bar)
    const comments = commentsRef.current;
    if (f % 60 === 0 && comments.length < 5) {
      const nick = randomItem(NICKNAMES);
      const msg = randomItem(MESSAGES);
      comments.push({
        text: `${nick}: ${msg}`,
        x: w + 50,
        y: h - 130 - Math.random() * 30,
        speed: 0.6 + Math.random() * 1.2,
        color: `hsl(${Math.random() * 360}, 70%, 75%)`,
        alpha: 0.85 + Math.random() * 0.15,
      });
    }
    for (let i = comments.length - 1; i >= 0; i--) {
      const c = comments[i]!;
      c.x -= c.speed;
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = c.color;
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      // Background pill
      const textW = ctx.measureText(c.text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.roundRect(c.x - 8, c.y - 11, textW + 16, 22, 11);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y + 4);
      ctx.globalAlpha = 1;
      if (c.x < -textW - 60) comments.splice(i, 1);
    }

    // Bottom gradient overlay - moved up to avoid bottom bar
    const bottomGrad = ctx.createLinearGradient(0, h - 140, 0, h - 56);
    bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, h - 140, w, 84);

    // Room title at bottom - moved up
    ctx.fillStyle = '#fff';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`直播间 · ${roomId}号厅`, 16, h - 64);

    animationRef.current = requestAnimationFrame(animate);
  }, [roomId, productName, currentPrice, participantCount]);

  const animationRef = useRef<number>(0);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [animate]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}


