'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { useGrowth, type ShopifyStore } from './growth-api';
import { Field, Panel, selectClass } from './growth-ui';

const SIZES = {
  post: { w: 1080, h: 1350, label: 'Instagram post 4:5' },
  square: { w: 1080, h: 1080, label: 'Square 1:1' },
  story: { w: 1080, h: 1920, label: 'Story / Reel cover 9:16' },
  cover: { w: 1200, h: 630, label: 'Blog cover' },
} as const;

const STYLES = {
  plum: { name: 'Plum', bg: ['#3d2163', '#7a3f8f', '#c2578a'], fg: '#ffffff', mut: '#eadff5', pill: '#ffffff', pillfg: '#3d2163' },
  cream: { name: 'Cream', bg: ['#fbf6ef', '#f4e8e4', '#ecd9e6'], fg: '#2a1b3d', mut: '#6c5a7a', pill: '#3d2163', pillfg: '#ffffff' },
  night: { name: 'Night', bg: ['#15101d', '#241a33', '#40275a'], fg: '#ffffff', mut: '#cdbfe0', pill: '#c2578a', pillfg: '#ffffff' },
  clean: { name: 'Clean', bg: ['#ffffff', '#f6f6f8', '#eceef3'], fg: '#111827', mut: '#4b5563', pill: '#111827', pillfg: '#ffffff' },
} as const;

type SizeKey = keyof typeof SIZES;
type StyleKey = keyof typeof STYLES;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Source {
  label: string;
  head: string;
  sub: string;
}

/**
 * Finished creative from the client's real product photos. Everything runs in the browser:
 * photos are never uploaded; the PNG is downloaded straight from the canvas.
 */
export function ImagesTab({ brand }: { brand: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const store = useGrowth<ShopifyStore>('/shopify');
  const blogs = useGrowth<{ blogs: { title: string }[] }>('/blogs');
  const ads = useGrowth<{ items: { adName: string; headline: string | null; hook: string | null }[] }>('/ad-plan');
  const [size, setSize] = useState<SizeKey>('post');
  const [style, setStyle] = useState<StyleKey>('plum');
  const [head, setHead] = useState('Your headline here');
  const [sub, setSub] = useState('One line about the product or offer');
  const [badge, setBadge] = useState('100% authentic');
  const [brandLine, setBrandLine] = useState(brand.toUpperCase());
  const [site, setSite] = useState('');
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    const url = store.data?.primaryUrl;
    if (url && !site) setSite(url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }, [store.data, site]);

  const sources: Source[] = [
    ...(blogs.data?.blogs ?? []).map((b) => ({ label: `Blog: ${b.title}`, head: b.title.split('. ')[0], sub: `${brand} Journal` })),
    ...(ads.data?.items ?? []).map((a) => ({ label: `Ad: ${a.adName}`, head: a.headline ?? a.adName, sub: a.hook ?? '' })),
  ];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: W, h: H } = SIZES[size];
    const T = STYLES[style];
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, T.bg[0]);
    g.addColorStop(0.6, T.bg[1]);
    g.addColorStop(1, T.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = T.fg;
    ctx.beginPath();
    ctx.arc(W * 0.95, H * 0.05, Math.min(W, H) * 0.42, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.1, H * 1.02, Math.min(W, H) * 0.34, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;

    const land = W > H * 1.2;
    const pad = Math.round(W * 0.07);
    const tx = pad;
    const tw = land ? W * 0.48 : W - 2 * pad;
    const U = Math.min(W, H) / 1080;
    const area = land ? { x: W * 0.57, y: H * 0.1, w: W * 0.37, h: H * 0.8 } : { x: pad, y: H * 0.47, w: W - 2 * pad, h: H * 0.41 };
    let y = land ? H * 0.2 : H * 0.1;

    ctx.textBaseline = 'top';
    ctx.fillStyle = T.mut;
    ctx.font = `600 ${Math.round(26 * U)}px Inter, sans-serif`;
    ctx.fillText(brandLine.toUpperCase(), tx, y);
    y += 58 * U;

    let fs = Math.round((land ? 70 : 92) * U);
    let lines: string[];
    const maxLines = land ? 4 : 3;
    do {
      ctx.font = `700 ${fs}px Inter, sans-serif`;
      lines = wrap(ctx, head, tw);
      fs -= 4;
    } while (lines.length > maxLines && fs > 30);
    ctx.fillStyle = T.fg;
    for (const l of lines) {
      ctx.fillText(l, tx, y);
      y += (fs + 4) * 1.12;
    }
    y += 14 * U;
    ctx.fillStyle = T.mut;
    ctx.font = `500 ${Math.round(34 * U)}px Inter, sans-serif`;
    for (const l of wrap(ctx, sub, tw).slice(0, 3)) {
      ctx.fillText(l, tx, y);
      y += 46 * U;
    }

    if (badge) {
      ctx.font = `600 ${Math.round(28 * U)}px Inter, sans-serif`;
      const bw = ctx.measureText(badge).width + 48 * U;
      const bh = 58 * U;
      const by = H - pad - bh;
      ctx.fillStyle = T.pill;
      roundRect(ctx, tx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = T.pillfg;
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, tx + 24 * U, by + bh / 2 + 1);
      ctx.textBaseline = 'top';
    }
    if (site) {
      ctx.fillStyle = T.mut;
      ctx.font = `500 ${Math.round(24 * U)}px Inter, sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(site, W - pad, H - pad);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }

    const n = images.length;
    if (!n) {
      ctx.save();
      ctx.setLineDash([14 * U, 12 * U]);
      ctx.lineWidth = 3 * U;
      ctx.strokeStyle = T.mut;
      ctx.globalAlpha = 0.7;
      roundRect(ctx, area.x, area.y, area.w, area.h, 28 * U);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = T.mut;
      ctx.font = `500 ${Math.round(30 * U)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Add a product photo', area.x + area.w / 2, area.y + area.h / 2);
      ctx.restore();
      return;
    }
    const gap = 22 * U;
    const stackV = land && n > 1;
    const cw = stackV ? area.w : (area.w - gap * (n - 1)) / n;
    const ch = stackV ? (area.h - gap * (n - 1)) / n : area.h;
    images.forEach((im, i) => {
      const x = stackV ? area.x : area.x + i * (cw + gap);
      const yy = stackV ? area.y + i * (ch + gap) : area.y;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.28)';
      ctx.shadowBlur = 40 * U;
      ctx.shadowOffsetY = 14 * U;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, yy, cw, ch, 28 * U);
      ctx.fill();
      ctx.restore();
      const ip = 22 * U;
      const s = Math.min((cw - 2 * ip) / im.width, (ch - 2 * ip) / im.height);
      const iw = im.width * s;
      const ih = im.height * s;
      ctx.save();
      roundRect(ctx, x, yy, cw, ch, 28 * U);
      ctx.clip();
      ctx.drawImage(im, x + (cw - iw) / 2, yy + (ch - ih) / 2, iw, ih);
      ctx.restore();
    });
  }, [size, style, head, sub, badge, brandLine, site, images]);

  useEffect(() => {
    draw();
  }, [draw]);

  function onFiles(files: FileList | null) {
    if (!files) return;
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 3);
    Promise.all(
      picked.map(
        (file) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          })
      )
    )
      .then(setImages)
      .catch(() => undefined);
  }

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${brand.replace(/\W+/g, '-').toLowerCase()}-${size}-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  return (
    <Panel title="Image maker">
      <p className="text-muted-foreground text-xs">
        Makes a finished creative from the client&apos;s real product photos: pick the text from a blog or ad, add up to three photos, choose a size and
        style, and download the PNG. Photos stay in your browser. Upload the PNG to Media to use it in a post.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Field label="Use the text from">
            <select
              className={selectClass}
              onChange={(e) => {
                const s = sources[Number(e.target.value)];
                if (s) {
                  setHead(s.head);
                  setSub(s.sub);
                }
              }}
              defaultValue=""
            >
              <option value="">Type my own</option>
              {sources.map((s, i) => (
                <option key={`${s.label}-${i}`} value={i}>
                  {s.label.slice(0, 80)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Headline">
            <Input value={head} onChange={(e) => setHead(e.target.value)} />
          </Field>
          <Field label="Line under the headline">
            <Input value={sub} onChange={(e) => setSub(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Badge">
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} />
            </Field>
            <Field label="Brand line">
              <Input value={brandLine} onChange={(e) => setBrandLine(e.target.value)} />
            </Field>
          </div>
          <Field label="Website (bottom right)">
            <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourstore.com" />
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Size</span>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SIZES) as SizeKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={size === k}
                  onClick={() => setSize(k)}
                  className={cn('rounded-full px-3 py-0.5 text-xs', size === k ? 'bg-primary text-primary-foreground' : 'border-border border')}
                >
                  {SIZES[k].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Style</span>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(STYLES) as StyleKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={style === k}
                  onClick={() => setStyle(k)}
                  className={cn('rounded-full px-3 py-0.5 text-xs', style === k ? 'bg-primary text-primary-foreground' : 'border-border border')}
                >
                  {STYLES[k].name}
                </button>
              ))}
            </div>
          </div>
          <Field label="Product photos (up to 3, plain background works best)">
            <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
          </Field>
          <div className="flex gap-2">
            <Button onClick={download}>Download PNG</Button>
            <Button variant="secondary" onClick={() => setImages([])}>
              Remove photos
            </Button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          width={1080}
          height={1350}
          aria-label="Preview of the creative"
          className="border-border block h-auto max-h-[80vh] w-full rounded-xl border object-contain"
        />
      </div>
    </Panel>
  );
}
