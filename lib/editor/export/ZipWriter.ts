import { crc32 } from "@/lib/editor/util/crc32";

interface Entry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

const enc = new TextEncoder();

/** Minimal ZIP archive writer (method 0 = stored). .docx is a ZIP of XML
 *  parts, so this is all the container support the DOCX exporter needs. */
export class ZipWriter {
  private entries: Entry[] = [];
  private chunks: Uint8Array[] = [];
  private size = 0;

  add(path: string, content: string | Uint8Array): this {
    const data = typeof content === "string" ? enc.encode(content) : content;
    const name = enc.encode(path);
    const entry: Entry = { name, data, crc: crc32(data), offset: this.size };
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true); // 1980-01-01
    h.setUint32(14, entry.crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    this.push(new Uint8Array(h.buffer));
    this.push(name);
    this.push(data);
    this.entries.push(entry);
    return this;
  }

  private push(b: Uint8Array): void {
    this.chunks.push(b);
    this.size += b.length;
  }

  finish(): Uint8Array {
    const start = this.size;
    for (const e of this.entries) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 20, true);
      h.setUint16(8, 0x0800, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, 0, true);
      h.setUint16(14, 0x21, true);
      h.setUint32(16, e.crc, true);
      h.setUint32(20, e.data.length, true);
      h.setUint32(24, e.data.length, true);
      h.setUint16(28, e.name.length, true);
      h.setUint32(42, e.offset, true);
      this.push(new Uint8Array(h.buffer));
      this.push(e.name);
    }
    const cdSize = this.size - start;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.entries.length, true);
    end.setUint16(10, this.entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, start, true);
    this.push(new Uint8Array(end.buffer));
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}
