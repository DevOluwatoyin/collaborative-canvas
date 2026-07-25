import type { CanvasObject } from "@infinite-canvas/shared";

export type Bounds = { x: number; y: number; width: number; height: number };

const DEFAULT_CELL = 512;

type Entry = {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cells: number[];
};

/**
 * Uniform-grid spatial index over object bounds.
 *
 * A quadtree is the textbook answer here, but canvas objects move constantly
 * (physics writes positions ~20x/sec) and a quadtree pays for that with node
 * splits and merges on every move. A hash grid updates a moved object in O(1)
 * amortised, needs no rebalancing, and canvas objects are close enough in size
 * that cell occupancy stays even. Both give the same asymptotic win over the
 * linear scans this replaces: viewport culling, point hit-testing and marquee
 * selection all become proportional to what is on screen, not to object count.
 */
export class SpatialGrid {
  private readonly cell: number;
  private cells = new Map<number, Set<string>>();
  private entries = new Map<string, Entry>();

  constructor(cellSize: number = DEFAULT_CELL) {
    this.cell = cellSize;
  }

  get size(): number {
    return this.entries.size;
  }

  private key(cx: number, cy: number): number {
    // Pack two 16-bit signed cell coords into one number for a cheap map key.
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  private cellsFor(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const c = this.cell;
    const x0 = Math.floor(minX / c);
    const y0 = Math.floor(minY / c);
    const x1 = Math.floor(maxX / c);
    const y1 = Math.floor(maxY / c);
    const out: number[] = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) out.push(this.key(cx, cy));
    }
    return out;
  }

  private static boundsOf(obj: CanvasObject) {
    // Objects can carry negative width/height after a mirrored resize.
    const minX = Math.min(obj.x, obj.x + obj.width);
    const minY = Math.min(obj.y, obj.y + obj.height);
    return {
      minX,
      minY,
      maxX: minX + Math.abs(obj.width),
      maxY: minY + Math.abs(obj.height),
    };
  }

  upsert(obj: CanvasObject): void {
    const { minX, minY, maxX, maxY } = SpatialGrid.boundsOf(obj);
    const existing = this.entries.get(obj.id);
    if (
      existing &&
      existing.minX === minX &&
      existing.minY === minY &&
      existing.maxX === maxX &&
      existing.maxY === maxY
    ) {
      return;
    }
    if (existing) this.detach(existing);
    const cells = this.cellsFor(minX, minY, maxX, maxY);
    const entry: Entry = { id: obj.id, minX, minY, maxX, maxY, cells };
    this.entries.set(obj.id, entry);
    for (const key of cells) {
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = new Set();
        this.cells.set(key, bucket);
      }
      bucket.add(obj.id);
    }
  }

  private detach(entry: Entry): void {
    for (const key of entry.cells) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      bucket.delete(entry.id);
      if (bucket.size === 0) this.cells.delete(key);
    }
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.detach(entry);
    this.entries.delete(id);
  }

  clear(): void {
    this.cells.clear();
    this.entries.clear();
  }

  /** Ids whose bounds intersect the rect. May include a few false positives. */
  query(rect: Bounds, into?: Set<string>): Set<string> {
    const out = into ?? new Set<string>();
    const minX = Math.min(rect.x, rect.x + rect.width);
    const minY = Math.min(rect.y, rect.y + rect.height);
    const maxX = minX + Math.abs(rect.width);
    const maxY = minY + Math.abs(rect.height);
    for (const key of this.cellsFor(minX, minY, maxX, maxY)) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      for (const id of bucket) {
        const entry = this.entries.get(id);
        if (!entry) continue;
        if (
          entry.maxX >= minX &&
          entry.minX <= maxX &&
          entry.maxY >= minY &&
          entry.minY <= maxY
        ) {
          out.add(id);
        }
      }
    }
    return out;
  }

  queryPoint(x: number, y: number): Set<string> {
    return this.query({ x, y, width: 0, height: 0 });
  }
}
