import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from 'lightweight-charts';

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

export type DrawZone = {
  from: number; // logical indeks (sham tartib raqami)
  to: number;
  top: number;
  bottom: number;
  color: string; // #rrggbb
  faded: boolean; // bekor bo'lgan zona
};

type Rect = { x0: number; x1: number; y0: number; y1: number; color: string; faded: boolean };

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

class ZonesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly rects: Rect[]) {}

  draw() {}

  // Fon qatlamida chiziladi — shamlar zonalar ustida ko'rinadi
  drawBackground(target: RenderTarget) {
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      for (const r of this.rects) {
        const x = Math.round(r.x0 * hr);
        const y = Math.round(r.y0 * vr);
        const w = Math.max(1, Math.round((r.x1 - r.x0) * hr));
        const h = Math.max(1, Math.round((r.y1 - r.y0) * vr));
        ctx.fillStyle = withAlpha(r.color, r.faded ? 0.05 : 0.2);
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = Math.max(1, Math.floor(hr));
        ctx.setLineDash(r.faded ? [4 * hr, 3 * hr] : []);
        ctx.strokeStyle = withAlpha(r.color, r.faded ? 0.45 : 0.8);
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
      ctx.setLineDash([]);
    });
  }
}

class ZonesPaneView implements IPrimitivePaneView {
  private rects: Rect[] = [];

  constructor(private readonly source: ZonesPrimitive) {}

  update() {
    const params = this.source.params;
    if (!params) return;
    const timeScale = params.chart.timeScale();
    const half = timeScale.options().barSpacing / 2;

    this.rects = [];
    for (const z of this.source.zones) {
      const x0 = timeScale.logicalToCoordinate(z.from as Logical);
      const x1 = timeScale.logicalToCoordinate(z.to as Logical);
      const y0 = params.series.priceToCoordinate(z.top);
      const y1 = params.series.priceToCoordinate(z.bottom);
      if (x0 === null || x1 === null || y0 === null || y1 === null) continue;
      this.rects.push({ x0: x0 - half, x1: x1 + half, y0, y1, color: z.color, faded: z.faded });
    }
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'bottom';
  }

  renderer() {
    return new ZonesRenderer(this.rects);
  }
}

// Zonalarni sham seriyasi ostida to'rtburchak qilib chizadigan Lightweight Charts primitivi
export class ZonesPrimitive implements ISeriesPrimitive<Time> {
  params: SeriesAttachedParameter<Time> | null = null;
  zones: DrawZone[] = [];
  private readonly views = [new ZonesPaneView(this)];

  attached(params: SeriesAttachedParameter<Time>) {
    this.params = params;
  }

  detached() {
    this.params = null;
  }

  setZones(zones: DrawZone[]) {
    this.zones = zones;
    this.params?.requestUpdate();
  }

  updateAllViews() {
    this.views.forEach((v) => v.update());
  }

  paneViews() {
    return this.views;
  }
}
