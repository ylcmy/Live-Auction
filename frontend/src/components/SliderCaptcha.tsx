import { useRef, useCallback, useState } from 'react';
import SliderCaptchaBase from 'rc-slider-captcha';
import api from '../services/api';

interface SliderCaptchaProps {
  onVerified: (captchaToken: string) => void;
}

const POSITION_TOLERANCE = 5;

/**
 * Generate a random gradient background + puzzle piece using browser Canvas.
 * Both gap and piece use the same random y so they align vertically.
 */
function generatePuzzleImages(width: number, height: number, puzzleW: number, puzzleH: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const hue1 = Math.floor(Math.random() * 360);
  const hue2 = (hue1 + 60) % 360;
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `hsl(${hue1}, 70%, 55%)`);
  grad.addColorStop(1, `hsl(${hue2}, 70%, 55%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 15 + Math.random() * 50, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(hue1 + Math.random() * 120) | 0}, 50%, 65%, 0.25)`;
    ctx.fill();
  }

  const x = 30 + Math.floor(Math.random() * (width - puzzleW - 60));
  const y = 10 + Math.floor(Math.random() * (height - puzzleH - 20));

  // Cut puzzle piece from background at (x, y)
  const puzzleCanvas = document.createElement('canvas');
  puzzleCanvas.width = puzzleW;
  puzzleCanvas.height = puzzleH;
  const pctx = puzzleCanvas.getContext('2d')!;
  pctx.drawImage(canvas, x, y, puzzleW, puzzleH, 0, 0, puzzleW, puzzleH);
  pctx.strokeStyle = 'rgba(255,255,255,0.8)';
  pctx.lineWidth = 2;
  pctx.strokeRect(0, 0, puzzleW, puzzleH);

  // Draw gap on background at same (x, y)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y, puzzleW, puzzleH);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, puzzleW, puzzleH);

  return {
    bgUrl: canvas.toDataURL('image/png'),
    puzzleUrl: puzzleCanvas.toDataURL('image/png'),
    x,
    y,
  };
}

export default function SliderCaptcha({ onVerified }: SliderCaptchaProps) {
  const sessionIdRef = useRef<string>('');
  const expectedXRef = useRef<number>(0);
  const [puzzleTop, setPuzzleTop] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleRequest = useCallback(async () => {
    try {
      const res: any = await api.get('/auth/captcha');
      const sessionId = res?.data?.sessionId;
      if (!sessionId) throw new Error('未能获取验证码会话');
      sessionIdRef.current = sessionId;

      const { bgUrl, puzzleUrl, x, y } = generatePuzzleImages(300, 160, 55, 55);
      expectedXRef.current = x;

      // Update puzzle piece vertical position to match gap y
      setPuzzleTop(y);

      await api.post('/auth/captcha', { sessionId, x });

      return { bgUrl, puzzleUrl };
    } catch (err: any) {
      const msg = err?.message || '验证码加载失败';
      setLoadError(msg);
      throw err;
    }
  }, []);

  const handleVerify = useCallback(
    async (data: { x: number }) => {
      const sessionId = sessionIdRef.current;
      const expectedX = expectedXRef.current;
      if (!sessionId) return Promise.reject(new Error('no session'));

      // Frontend tolerance check (defense in depth — server enforces the same).
      if (Math.abs(data.x - expectedX) > POSITION_TOLERANCE) {
        return Promise.reject(new Error('位置不正确'));
      }

      // Server validates sessionId (server-generated UUID, 128-bit entropy)
      // + position tolerance. No HMAC needed — the sessionId is the proof.
      onVerified(`${sessionId}:${data.x}`);
      return Promise.resolve();
    },
    [onVerified],
  );

  if (loadError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 space-y-2">
        <p>验证码加载失败：{loadError}</p>
        <button type="button" onClick={() => setLoadError(null)} className="text-xs text-brand underline">
          重试
        </button>
      </div>
    );
  }

  return (
    <SliderCaptchaBase
      mode="embed"
      request={handleRequest}
      onVerify={handleVerify}
      bgSize={{ width: 300, height: 160 }}
      puzzleSize={{ width: 55, height: 55, left: 0, top: puzzleTop }}
      tipText={{
        default: '向右拖动滑块完成验证',
        loading: '加载中...',
        moving: '拖动到正确位置',
        verifying: '验证中...',
        success: '验证成功 ✓',
        error: '位置不对，请重试',
        loadFailed: '加载失败',
      }}
    />
  );
}
