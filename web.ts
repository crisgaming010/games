// ============================================================================
// web.ts — Full TypeScript Web Application for CPM (Car Parking Multiplayer)
// Converted from app.py: No features removed.
// Web UI + Backend API (Express + Node.js 18+)
// Distinct features: Clone Account vs Unlock All Cars
// ============================================================================
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

// ============================================================
// CONFIG & CONSTANTS
// ============================================================
export const PORT = Number(process.env.PORT) || 8080;
export const FK = "AIzaSyCQDz9rgjgmvmFkvVfmvr2-7fT4tfrzRRQ";
export const LOAD_URL = "https://europe-west1-cp-multiplayer.cloudfunctions.net/GetPlayerRecords3";
export const SAVE_URL = "https://europe-west1-cp-multiplayer.cloudfunctions.net/SavePlayerRecordsPartially8";
export const RANK_URL = "https://us-central1-cp-multiplayer.cloudfunctions.net/SetUserRating5";
export const _CPM1_FB_KEY = "AIzaSyBW1ZbMiUeDZHYUO2bY8Bfnf5rRgrQGPTM";
export const SOURCE_ACCOUNT: [string, string] = ["nar076987@gmail.com", "3232000"];
export const MAX_MONEY = 50_000_000;
export const MAX_COIN = 500_000;

export type AnyDict = { [k: string]: any };

// ============================================================
// JSON STORE (cpm_store.json)
// ============================================================
const STORE_PATH = path.join(process.cwd(), "cpm_store.json");

export interface Store {
  allowed_users: number[];
  vip_users: number[];
  admins: { [k: string]: string };
  pending: { [k: string]: any };
  banned: number[];
  expiry: { [k: string]: string };
  stats: { total_logins: number; total_actions: number; total_unlocks: number };
  admin_log: AnyDict[];
  users: { [k: string]: any };
  daily_stats: { [k: string]: any };
  maintenance: boolean;
  [k: string]: any;
}

const DEFAULT_STORE: Store = {
  allowed_users: [], vip_users: [], admins: {},
  pending: {}, banned: [], expiry: {},
  stats: { total_logins: 0, total_actions: 0, total_unlocks: 0 },
  admin_log: [], users: {}, daily_stats: {},
  maintenance: false,
};

export function loadStore(): Store {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data: Store = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      return { ...DEFAULT_STORE, ...data };
    }
  } catch (e) {
    console.error("Store load error:", e);
  }
  return { ...DEFAULT_STORE };
}

export function saveStore(data: Store): boolean {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Store save error:", e);
    return false;
  }
}

export const STORE: Store = loadStore();

export function adminLog(actor: string, action: string, target: string = ""): void {
  STORE.admin_log = STORE.admin_log || [];
  STORE.admin_log.push({
    time: new Date().toISOString(),
    actor,
    action,
    target,
  });
  saveStore(STORE);
}

export function updateStats(key: "total_logins" | "total_actions" | "total_unlocks"): void {
  STORE.stats = STORE.stats || { total_logins: 0, total_actions: 0, total_unlocks: 0 };
  STORE.stats[key] = (STORE.stats[key] || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  STORE.daily_stats = STORE.daily_stats || {};
  STORE.daily_stats[today] = STORE.daily_stats[today] || {};
  STORE.daily_stats[today][key] = (STORE.daily_stats[today][key] || 0) + 1;
  saveStore(STORE);
}

// ============================================================
// CRYPTO & CODEC (Reader/Writer, AES-128, Decompress)
// ============================================================
export function makeXorKey(uid: string): Buffer {
  const h = crypto.createHash("md5").update(uid, "utf-8").digest();
  const out = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) out[i] = h[i % 16];
  return out;
}

export function xorBytes(data: Buffer, key: Buffer): Buffer {
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

export function decompress(data: Buffer | null): Buffer | null {
  if (!data) return null;
  try { return zlib.inflateRawSync(data); } catch {}
  try { return zlib.inflateSync(data); } catch {}
  try { return zlib.brotliDecompressSync(data); } catch {}
  return null;
}

export function compress(data: Buffer): Buffer {
  return zlib.deflateSync(data);
}

export function decryptAes(data: Buffer, key: Buffer): Buffer | null {
  try {
    const iv = data.subarray(0, 16);
    const ct = data.subarray(16);
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch { return null; }
}

export const md5 = (t: string | Buffer): Buffer => crypto.createHash("md5").update(t).digest();
export const sha1_16 = (t: string | Buffer): Buffer => crypto.createHash("sha1").update(t).digest().subarray(0, 16);

export function buildAesKeys(uid: string, password?: string, email?: string): Buffer[] {
  const target = uid || (email || "");
  const k1 = md5(target);
  const k2 = sha1_16(target);
  const k3 = md5(Buffer.concat([Buffer.from(k1.toString("hex")), Buffer.from(k2.toString("hex"))]));
  if (password) {
    const k4 = sha1_16(password);
    const k5 = md5(Buffer.concat([Buffer.from(k4.toString("hex")), Buffer.from(k3.toString("hex"))]));
    return [k1, k2, k3, k4, k5];
  }
  if (email) {
    const k4 = sha1_16(email);
    const k5 = md5(Buffer.concat([Buffer.from(k4.toString("hex")), Buffer.from(k3.toString("hex"))]));
    return [k1, k2, k3, k4, k5];
  }
  return [k1, k2, k3];
}

export class Reader {
  buf: Buffer;
  pos: number;
  constructor(data: Buffer) { this.buf = data; this.pos = 0; }
  hasBytes(n: number): boolean { return this.pos + n <= this.buf.length; }
  readByte(): number { return this.hasBytes(1) ? this.buf[this.pos++] : 0; }
  readInt(): number {
    if (!this.hasBytes(4)) return 0;
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  readFloat(): number {
    if (!this.hasBytes(4)) return 0.0;
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  readString(): string {
    if (!this.hasBytes(4)) return "";
    const ln = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    if (ln <= 0 || !this.hasBytes(ln)) return "";
    const v = this.buf.subarray(this.pos, this.pos + ln).toString("utf-8");
    this.pos += ln;
    return v;
  }
  readList<T>(itemFn: () => T): T[] {
    if (!this.hasBytes(4)) return [];
    const ln = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    const out: T[] = [];
    for (let i = 0; i < ln; i++) out.push(itemFn());
    return out;
  }
  readDict(): AnyDict {
    const d: AnyDict = {};
    if (!this.hasBytes(4)) return d;
    const ln = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    for (let i = 0; i < ln; i++) {
      const k = this.readString();
      const v = this.readString();
      d[k] = v;
    }
    return d;
  }
  readEquipment(): AnyDict[] {
    if (!this.hasBytes(4)) return [];
    const ln = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    const out: AnyDict[] = [];
    for (let i = 0; i < ln; i++) {
      if (!this.hasBytes(1)) break;
      const typ = this.readByte();
      if (typ === 0) out.push({ type: 0, id: this.readInt(), color: this.readInt() });
      else if (typ === 1) out.push({ type: 1, id: this.readInt() });
      else if (typ === 2) out.push({ type: 2, id: this.readInt(), color: this.readInt(), float: this.readFloat() });
      else out.push({ type: typ, id: this.readInt() });
    }
    return out;
  }
}

export function parsePlayer(buf: Buffer): AnyDict | null {
  const r = new Reader(buf);
  if (r.readByte() === 0) return null;
  const p: AnyDict = {};
  p["Name"] = r.readString(); p["money"] = r.readInt();
  p["coin"] = r.readInt(); p["localID"] = r.readString();
  p["boughtFsos"] = r.readList<number>(() => r.readInt());
  p["FriendsID"] = r.readList<AnyDict>(() => {
    r.readByte();
    return { id: r.readString(), Name: r.readString(), accountID: r.readString() };
  });
  p["LevelsDoneTime"] = r.readList<number>(() => r.readFloat());
  p["floats"] = r.readList<number>(() => r.readFloat());
  p["integers"] = r.readList<number>(() => r.readInt());
  p["fcar"] = r.readList<number>(() => r.readInt());
  p["favouriteWheels"] = r.readList<number>(() => r.readInt());
  p["favouriteVinyls"] = r.readList<number>(() => r.readInt());
  p["favouriteEmojis"] = r.readList<number>(() => r.readInt());
  p["personEquipmentsMale"] = r.readEquipment();
  p["personEquipmentsFemale"] = r.readEquipment();
  if (r.readByte() === 0) p["platesData"] = null;
  else {
    const readVinyl = () => {
      r.readByte();
      return {
        vectors: r.readList<AnyDict>(() => ({ x: r.readFloat(), y: r.readFloat(), z: r.readFloat() })),
        v: r.readList<string>(() => r.readString()),
        floats: r.readList<number>(() => r.readFloat()),
        text: r.readString(),
      };
    };
    p["platesData"] = {
      allPlates: r.readList<AnyDict>(() => {
        r.readByte();
        return { plateId: r.readInt(), frontCarId: r.readInt(), rearCarId: r.readInt(), vinyls: r.readList<AnyDict>(readVinyl) };
      }),
    };
  }
  if (r.readByte() === 0) p["carIDnStatus"] = null;
  else {
    p["carIDnStatus"] = {
      carGeneratedIDs: r.readList<string>(() => r.readString()),
      carStatus: r.readList<number>(() => r.readInt()),
    };
  }
  p["allData"] = r.readString();
  p["flags"] = r.readDict();
  p["animations"] = r.readList<number>(() => r.readInt());
  p["emojiPacks"] = r.readList<number>(() => r.readInt());
  p["wheels"] = r.readList<number>(() => r.readInt());
  p["boughtPoliceLights"] = r.readList<number>(() => r.readInt());
  p["boughtPoliceSirens"] = r.readList<number>(() => r.readInt());
  return p;
}

export function tryParse(buf: Buffer): AnyDict | null {
  const candidates: (Buffer | null)[] = [buf];
  const d1 = decompress(buf);
  if (d1) candidates.push(d1);
  const d2 = decompress(d1);
  if (d2) candidates.push(d2);
  for (const c of candidates) {
    if (!c) continue;
    if (c.length > 0 && [1, 17, 23, 24].includes(c[0])) {
      try {
        const p = parsePlayer(c);
        if (p && p.Name !== undefined && p.Name !== null) return p;
      } catch {}
    }
    try {
      const clean = (c.length >= 3 && c[0] === 0xef && c[1] === 0xbb && c[2] === 0xbf) ? c.subarray(3) : c;
      if (clean && clean.length > 0 && clean[0] === 123) return JSON.parse(clean.toString("utf-8"));
    } catch {}
  }
  return null;
}

export function decryptPlayerRecord(base64Text: string, uid: string, password?: string, email?: string): AnyDict {
  try {
    let b64 = base64Text.trim().replace(/-/g, "+").replace(/_/g, "/");
    const missingPadding = b64.length % 4;
    if (missingPadding) b64 += "=".repeat(4 - missingPadding);
    var buf = Buffer.from(b64, "base64");
  } catch (e: any) {
    return { success: false, message: `Bad base64 (${e})` };
  }
  if (buf.length < 10) return { success: false, message: "Record data too small" };
  for (const key of buildAesKeys(uid, password, email)) {
    const dec = decryptAes(buf, key);
    if (dec) {
      const parsed = tryParse(dec);
      if (parsed) return { success: true, record: parsed };
    }
  }
  const xk = makeXorKey(String(uid || email || ""));
  const xdec = xorBytes(buf, xk);
  const parsedX = tryParse(xdec);
  if (parsedX) return { success: true, record: parsedX };
  for (const d of [decompress(buf), decompress(xdec)]) {
    if (d) {
      const parsed = tryParse(d);
      if (parsed) return { success: true, record: parsed };
    }
  }
  return { success: false, message: "Decryption failed (Wrong credentials/key)" };
}

export class Writer {
  private parts: Buffer[] = [];
  writeByte(v: number): void { this.parts.push(Buffer.from([v & 0xFF])); }
  writeInt(v: number): void {
    const b = Buffer.alloc(4);
    b.writeInt32LE(Math.trunc(Number(v) || 0), 0);
    this.parts.push(b);
  }
  writeFloat(v: number): void {
    const b = Buffer.alloc(4);
    b.writeFloatLE(Number(v) || 0.0, 0);
    this.parts.push(b);
  }
  writeString(s: string | null | undefined): void {
    const t = s ? Buffer.from(s, "utf-8") : Buffer.alloc(0);
    this.writeInt(t.length);
    this.parts.push(t);
  }
  writeList<T>(lst: T[] | undefined | null, fn: (item: T) => void): void {
    const arr = lst || [];
    this.writeInt(arr.length);
    for (const item of arr) fn(item);
  }
  writeDict(d: AnyDict | undefined | null): void {
    const obj = d || {};
    const keys = Object.keys(obj);
    this.writeInt(keys.length);
    for (const k of keys) {
      this.writeString(k);
      this.writeString(obj[k]);
    }
  }
  writeEquipment(data: AnyDict[] | undefined | null): void {
    const arr = data || [];
    this.writeInt(arr.length);
    for (const item of arr) {
      const t = item.type ?? 0;
      this.writeByte(t);
      if (t === 0) { this.writeInt(item.id ?? 0); this.writeInt(item.color ?? 0); }
      else if (t === 1) { this.writeInt(item.id ?? 0); }
      else if (t === 2) { this.writeInt(item.id ?? 0); this.writeInt(item.color ?? 0); this.writeFloat(item.float ?? 0.0); }
      else { this.writeInt(item.id ?? 0); }
    }
  }
  writePlates(data: AnyDict | null | undefined): void {
    if (!data) { this.writeByte(0); return; }
    this.writeByte(1);
    const wv = (v: AnyDict) => {
      this.writeByte(1);
      this.writeList<AnyDict>(v.vectors || [], (x) => { this.writeFloat(x.x); this.writeFloat(x.y); this.writeFloat(x.z); });
      this.writeList<string>(v.v || [], (s) => this.writeString(s));
      this.writeList<number>(v.floats || [], (f) => this.writeFloat(f));
      this.writeString(v.text ?? "");
    };
    const wp = (p: AnyDict) => {
      this.writeByte(1);
      this.writeInt(p.plateId ?? 0); this.writeInt(p.frontCarId ?? 0); this.writeInt(p.rearCarId ?? 0);
      this.writeList<AnyDict>(p.vinyls || [], wv);
    };
    this.writeList<AnyDict>(data.allPlates || [], wp);
  }
  writeCarIdStatus(data: AnyDict | null | undefined): void {
    if (!data) { this.writeByte(0); return; }
    this.writeByte(1);
    this.writeList<string>(data.carGeneratedIDs || [], (s) => this.writeString(s));
    this.writeList<number>(data.carStatus || [], (i) => this.writeInt(i));
  }
  toBytes(): Buffer { return Buffer.concat(this.parts); }
}

export function serializePlayer(p: AnyDict): Buffer {
  const w = new Writer();
  w.writeByte(1);
  w.writeString(p.Name ?? "");
  w.writeInt(p.money ?? 0);
  w.writeInt(p.coin ?? 0);
  w.writeString(p.localID ?? "");
  w.writeList<number>(p.boughtFsos || [], (i) => w.writeInt(i));
  w.writeList<AnyDict>(p.FriendsID || [], (f: AnyDict) => {
    w.writeByte(1);
    w.writeString(f.id ?? "");
    w.writeString(f.Name ?? "");
    w.writeString(f.accountID ?? "");
  });
  w.writeList<number>(p.LevelsDoneTime || [], (f) => w.writeFloat(f));
  w.writeList<number>(p.floats || [], (f) => w.writeFloat(f));
  w.writeList<number>(p.integers || [], (i) => w.writeInt(i));
  w.writeList<number>(p.fcar || [], (i) => w.writeInt(i));
  w.writeList<number>(p.favouriteWheels || [], (i) => w.writeInt(i));
  w.writeList<number>(p.favouriteVinyls || [], (i) => w.writeInt(i));
  w.writeList<number>(p.favouriteEmojis || [], (i) => w.writeInt(i));
  w.writeEquipment(p.personEquipmentsMale || []);
  w.writeEquipment(p.personEquipmentsFemale || []);
  w.writePlates(p.platesData ?? null);
  w.writeCarIdStatus(p.carIDnStatus ?? null);
  w.writeString(p.allData ?? "");
  w.writeDict(p.flags || {});
  w.writeList<number>(p.animations || [], (i) => w.writeInt(i));
  w.writeList<number>(p.emojiPacks || [], (i) => w.writeInt(i));
  w.writeList<number>(p.wheels || [], (i) => w.writeInt(i));
  w.writeList<number>(p.boughtPoliceLights || [], (i) => w.writeInt(i));
  w.writeList<number>(p.boughtPoliceSirens || [], (i) => w.writeInt(i));
  return w.toBytes();
}

// ============================================================
// FIREBASE & CPM CLOUD APIS
// ============================================================
export async function firebaseLogin(email: string, password: string): Promise<[string | null, string]> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FK}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true, clientType: "CLIENT_TYPE_ANDROID" }),
    });
    const data: any = await resp.json();
    if (resp.status === 200 && data.idToken) return [data.idToken, data.localId || ""];
    return [null, data?.error?.message || "Login failed"];
  } catch (e: any) {
    return [null, e.message || String(e)];
  }
}

export async function apiLoadRecord(email: string, password: string): Promise<AnyDict> {
  const [idToken, firebaseUid] = await firebaseLogin(email, password);
  if (!idToken) return { success: false, message: firebaseUid };
  try {
    const resp = await fetch(LOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, uid: firebaseUid, fk: FK }),
    });
    const text = await resp.text();
    let b64 = "";
    let extractedUid = "";
    try {
      const data = JSON.parse(text);
      if (data.error) return { success: false, message: data.error };
      b64 = data.base64 || data.record || "";
      extractedUid = data.uid || "";
    } catch {
      b64 = text;
    }
    b64 = b64.trim().replace(/\r/g, "").replace(/\n/g, "").replace(/ /g, "");
    if (!b64) return { success: false, message: "Empty record from game server" };
    const uidToUse = extractedUid || firebaseUid;
    const res = decryptPlayerRecord(b64, uidToUse, password, email);
    if (res.success) res.uid = uidToUse;
    return res;
  } catch (e: any) {
    return { success: false, message: `Load error: ${e.message || String(e)}` };
  }
}

export async function apiSaveRecord(uid: string, record: AnyDict, password: string = "", email: string = ""): Promise<AnyDict> {
  const raw = serializePlayer(record);
  if (!raw || raw.length === 0) return { success: false, message: "Serialize failed" };
  const b64 = compress(raw).toString("base64");
  try {
    const resp = await fetch(SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, password, email, fk: FK, base64: b64 }),
    });
    const text = await resp.text();
    return { success: true, response: text };
  } catch (e: any) {
    return { success: false, message: e.message || String(e) };
  }
}

export async function apiSetRank(uid: string, rank: number): Promise<AnyDict> {
  try {
    const resp = await fetch(RANK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, rank, fk: FK }),
    });
    return { success: resp.status === 200, response: await resp.text() };
  } catch (e: any) {
    return { success: false, message: e.message || String(e) };
  }
}

// ============================================================
// CLONE & UNLOCK CARS APIS (CPM1)
// ============================================================
export async function verifyUser(email: string, password: string): Promise<[string | null, string | null]> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${_CPM1_FB_KEY}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true, clientType: "CLIENT_TYPE_ANDROID" }),
    });
    if (resp.status === 200) {
      const d: any = await resp.json();
      return [d.idToken || null, d.localId || null];
    }
    return [null, null];
  } catch {
    return [null, null];
  }
}

export async function cpm1Api(token: string, endpoint: string, data: any = null): Promise<[number, string]> {
  try {
    const resp = await fetch(`https://europe-west1-cp-multiplayer.cloudfunctions.net/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }),
    });
    return [resp.status, await resp.text()];
  } catch {
    return [500, JSON.stringify({ result: "error" })];
  }
}

export async function cpm1GetCars(token: string): Promise<AnyDict[] | null> {
  const [status, text] = await cpm1Api(token, "GetAllCars2", null);
  if (status !== 200) return null;
  try {
    const outer = JSON.parse(text);
    return JSON.parse(outer.result);
  } catch { return null; }
}

export async function cpm1GetGarageSlot(token: string): Promise<AnyDict | null> {
  for (let i = 0; i < 5; i++) {
    try {
      const [status, text] = await cpm1Api(token, "WSGetCarListV3", 20);
      if (status === 200) {
        const result = JSON.parse(JSON.parse(text).result);
        if (Array.isArray(result) && result.length > 0) {
          for (const s of result) if ((s?.carID ?? 0) === 0) return s;
          return result[0];
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

export function cpm1FixCarAppearance(carInput: AnyDict): AnyDict {
  const car = JSON.parse(JSON.stringify(carInput));
  car.Vynils = (typeof car.Vynils === "object" && car.Vynils !== null) ? car.Vynils : {};
  if (!("CarID" in car.Vynils) && car.CarID) car.Vynils.CarID = car.CarID;
  for (const k of ["colors", "Colors", "bodyColor", "paint"]) {
    if (k in car) car[k] = Array(4).fill(0.85);
  }
  car.police = true;
  car.isLocked = false;
  car.engineID = car.engineID || 5;
  car.cdi = true;
  car.torque = car.torque || 3000.0;
  car.brake = car.brake || 3000.0;
  car.mass = car.mass || 1100.0;
  return car;
}

// ------------------------------------------------------------
// FEATURE 1: CLONE ACCOUNT (SOURCE ACCOUNT -> TARGET ACCOUNT)
// ------------------------------------------------------------
export async function cpm1CloneCar(tokenTarget: string, carData: AnyDict, targetUid: string): Promise<boolean> {
  const cid = carData.CarID || carData.carID || 0;
  const car = cpm1FixCarAppearance(carData);
  car.CarID = cid;
  const slot = await cpm1GetGarageSlot(tokenTarget);
  if (!slot) return false;
  const vynil = car.Vynils || { CarID: cid };
  const payload = {
    ownerID: slot.ownerID || "",
    ownerName: slot.ownerName || "",
    description: slot.description || "",
    CarID: slot.carID || 0,
    carGeneratedID: slot.carGeneratedID || "",
    ownerAccountID: slot.ownerAccountID || "",
    oneCar: car,
    vynilOneCar: vynil,
    loadedLocalCar: { instanceID: -Math.floor(Math.random() * 800000 + 100000) },
    price: slot.price ?? 100,
    SellingCar: {},
    willReject: false,
    dislike: 1, like: 0, liked: false, disliked: false, mode: 1,
  };
  const [status, text] = await cpm1Api(tokenTarget, "WSPurchaseCarV3", JSON.stringify(payload));
  try {
    const resVal = String(JSON.parse(text)?.result);
    return status === 200 && (resVal === "1" || resVal === "true");
  } catch { return false; }
}

// ------------------------------------------------------------
// FEATURE 2: UNLOCK CARS (INJECT CARS 1-50 USING TEMPLATE)
// ------------------------------------------------------------
export async function cpm1InjectCar(email: string, password: string, carId: number): Promise<boolean> {
  try {
    const [tok] = await verifyUser(email, password);
    const [stok] = await verifyUser(SOURCE_ACCOUNT[0], SOURCE_ACCOUNT[1]);
    if (!tok || !stok) return false;
    const cars = await cpm1GetCars(stok);
    if (!cars || cars.length === 0) return false;
    let tpl = cars.reduce((max, c) => ((c.CarID || 0) > (max.CarID || 0) ? c : max), cars[0]);
    const car = cpm1FixCarAppearance(tpl);
    car.CarID = carId;
    const slot = await cpm1GetGarageSlot(tok);
    if (!slot) return false;
    const payload = {
      ownerID: slot.ownerID || "",
      ownerName: slot.ownerName || "",
      description: slot.description || "",
      CarID: slot.carID || 0,
      carGeneratedID: slot.carGeneratedID || "",
      ownerAccountID: slot.ownerAccountID || "",
      oneCar: car,
      vynilOneCar: car.Vynils || {},
      loadedLocalCar: { instanceID: -Math.floor(Math.random() * 800000 + 100000) },
      price: slot.price ?? 100,
      SellingCar: {},
      willReject: false,
      dislike: 1, like: 0, liked: false, disliked: false, mode: 1,
    };
    const [status, text] = await cpm1Api(tok, "WSPurchaseCarV3", JSON.stringify(payload));
    const resVal = String(JSON.parse(text)?.result);
    return status === 200 && (resVal === "1" || resVal === "true");
  } catch { return false; }
}

// ============================================================
// HTTP API & WEB DASHBOARD SERVER
// ============================================================
function readBody(req: http.IncomingMessage): Promise<AnyDict> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: AnyDict): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

// HTML Dashboard UI
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CPM Web Control Panel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; }
    .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .btn-glow { box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); }
  </style>
</head>
<body class="min-h-screen p-4 md:p-8">
  <div class="max-w-5xl mx-auto space-y-6">
    <!-- Header -->
    <header class="flex justify-between items-center border-b border-slate-700 pb-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
          CPM Web Manager
        </h1>
        <p class="text-xs text-slate-400 mt-1">Car Parking Multiplayer TypeScript Web Suite</p>
      </div>
      <div id="statusBadge" class="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-semibold">
        Logged Out
      </div>
    </header>

    <!-- Nav Tabs -->
    <div class="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
      <button onclick="switchTab('tab-login')" id="btn-tab-login" class="px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 text-white">1. Account & Login</button>
      <button onclick="switchTab('tab-stats')" id="btn-tab-stats" class="px-4 py-2 rounded-lg font-medium text-sm text-slate-400 hover:text-white">2. Stats & Money</button>
      <button onclick="switchTab('tab-garage')" id="btn-tab-garage" class="px-4 py-2 rounded-lg font-medium text-sm text-slate-400 hover:text-white">3. Garage & Cars</button>
      <button onclick="switchTab('tab-unlocks')" id="btn-tab-unlocks" class="px-4 py-2 rounded-lg font-medium text-sm text-slate-400 hover:text-white">4. Unlocks & Extras</button>
      <button onclick="switchTab('tab-admin')" id="btn-tab-admin" class="px-4 py-2 rounded-lg font-medium text-sm text-slate-400 hover:text-white">5. Admin Panel</button>
    </div>

    <!-- Alert / Toast -->
    <div id="toast" class="hidden p-4 rounded-lg text-sm font-medium border"></div>

    <!-- TAB 1: LOGIN & ACCOUNT -->
    <section id="tab-login" class="space-y-6">
      <div class="card p-6 rounded-2xl grid md:grid-cols-2 gap-6">
        <div>
          <h2 class="text-lg font-bold text-white mb-4">Login to Game Account</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Game Email</label>
              <input id="email" type="email" placeholder="player@gmail.com" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:border-blue-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input id="password" type="password" placeholder="••••••••" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:border-blue-500 outline-none">
            </div>
            <button onclick="login()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg text-sm transition btn-glow">
              Load Account Record
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-lg font-bold text-white mb-4">Loaded Account Info</h2>
          <div id="accountInfo" class="space-y-2 text-sm text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <p>Player Name: <span id="infoName" class="text-white font-semibold">-</span></p>
            <p>Player Money: <span id="infoMoney" class="text-green-400 font-bold">-</span></p>
            <p>Coins: <span id="infoCoin" class="text-amber-400 font-bold">-</span></p>
            <p>Local ID: <span id="infoLocalId" class="text-white font-mono text-xs">-</span></p>
            <p>Total Cars: <span id="infoCars" class="text-blue-400 font-semibold">-</span></p>
          </div>

          <div class="mt-4 flex space-x-2">
            <button onclick="saveCurrentAccount()" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-sm transition">
              💾 Save Account Changes
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: STATS & MONEY -->
    <section id="tab-stats" class="hidden space-y-6">
      <div class="card p-6 rounded-2xl space-y-4">
        <h2 class="text-lg font-bold text-white">Modify Game Money & Currency</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onclick="setMoney(50000000)" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700">
            <div class="text-xs text-slate-400">Max Money</div>
            <div class="text-lg font-bold text-green-400">50,000,000</div>
          </button>
          <button onclick="setCoins(500000)" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700">
            <div class="text-xs text-slate-400">Max Coins</div>
            <div class="text-lg font-bold text-amber-400">500,000</div>
          </button>
          <button onclick="setCustomMoney()" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700">
            <div class="text-xs text-slate-400">Custom Money</div>
            <div class="text-sm font-semibold text-white">Enter Value</div>
          </button>
          <button onclick="setKingRank()" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700">
            <div class="text-xs text-slate-400">King Rank</div>
            <div class="text-sm font-semibold text-purple-400">Set Rank 1</div>
          </button>
        </div>
      </div>
    </section>

    <!-- TAB 3: GARAGE & CARS (DISTINCT CLONE ACCOUNT VS UNLOCK CARS) -->
    <section id="tab-garage" class="hidden space-y-6">
      <div class="grid md:grid-cols-2 gap-6">
        <!-- FEATURE A: CLONE ACCOUNT -->
        <div class="card p-6 rounded-2xl border-blue-500/30">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-2xl">🧬</span>
            <h2 class="text-lg font-bold text-white">Clone Account (Full Transfer)</h2>
          </div>
          <p class="text-xs text-slate-400 mb-4">Kukopyahin lahat ng mga kotse mula sa Source Account papunta sa Target Account.</p>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Source Email</label>
              <input id="cloneSourceEmail" type="email" placeholder="source@gmail.com" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Source Password</label>
              <input id="cloneSourcePass" type="password" placeholder="••••••••" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Target Email</label>
              <input id="cloneTargetEmail" type="email" placeholder="target@gmail.com" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Target Password</label>
              <input id="cloneTargetPass" type="password" placeholder="••••••••" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <button onclick="startAccountClone()" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg text-sm transition">
              Start Account Clone
            </button>
            <div id="cloneStatus" class="text-xs text-slate-400 pt-2 font-mono"></div>
          </div>
        </div>

        <!-- FEATURE B: UNLOCK ALL CARS -->
        <div class="card p-6 rounded-2xl border-purple-500/30">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-2xl">🚗</span>
            <h2 class="text-lg font-bold text-white">Unlock All Cars (IDs 1-50)</h2>
          </div>
          <p class="text-xs text-slate-400 mb-4">Mag-i-inject ng cars 1 hanggang 50 sa account gamit ang verified template injection.</p>
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-400 mb-1">Account Email</label>
              <input id="unlockEmail" type="email" placeholder="target@gmail.com" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Account Password</label>
              <input id="unlockPass" type="password" placeholder="••••••••" class="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm">
            </div>
            <div class="pt-6">
              <button onclick="startUnlockCars()" class="w-full py-2.5 bg-purple-600 hover:bg-purple-500 font-semibold rounded-lg text-sm transition">
                Start Unlock 50 Cars
              </button>
            </div>
            <div id="unlockStatus" class="text-xs text-slate-400 pt-2 font-mono"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: UNLOCKS & EXTRAS -->
    <section id="tab-unlocks" class="hidden space-y-6">
      <div class="card p-6 rounded-2xl space-y-4">
        <h2 class="text-lg font-bold text-white">Quick Extras & Game Modifiers</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button onclick="unlockExtra('allhouses')" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 font-medium text-sm">
            🏡 Unlock All Houses
          </button>
          <button onclick="unlockExtra('sirens')" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 font-medium text-sm text-cyan-400">
            🚨 Police Sirens & Lights
          </button>
          <button onclick="unlockExtra('alllevels')" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 font-medium text-sm text-amber-400">
            🏆 Complete All Levels
          </button>
          <button onclick="unlockExtra('allclothes')" class="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-center border border-slate-700 font-medium text-sm text-pink-400">
            👔 Unlock All Clothes
          </button>
        </div>
      </div>
    </section>

    <!-- TAB 5: ADMIN PANEL -->
    <section id="tab-admin" class="hidden space-y-6">
      <div class="card p-6 rounded-2xl space-y-4">
        <h2 class="text-lg font-bold text-white">System Administration & Logs</h2>
        <div id="adminStats" class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 bg-slate-900 rounded-lg"><div class="text-xs text-slate-400">Total Logins</div><div id="statLogins" class="text-lg font-bold text-blue-400">0</div></div>
          <div class="p-3 bg-slate-900 rounded-lg"><div class="text-xs text-slate-400">Total Actions</div><div id="statActions" class="text-lg font-bold text-emerald-400">0</div></div>
          <div class="p-3 bg-slate-900 rounded-lg"><div class="text-xs text-slate-400">Maintenance</div><div id="statMaint" class="text-lg font-bold text-rose-400">OFF</div></div>
        </div>
      </div>
    </section>
  </div>

  <script>
    let currentAccount = null;

    function showToast(msg, isErr = false) {
      const t = document.getElementById('toast');
      t.className = isErr ? 'p-4 rounded-lg text-sm font-medium border bg-red-900/40 text-red-200 border-red-700' : 'p-4 rounded-lg text-sm font-medium border bg-emerald-900/40 text-emerald-200 border-emerald-700';
      t.innerText = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 5000);
    }

    function switchTab(id) {
      ['tab-login', 'tab-stats', 'tab-garage', 'tab-unlocks', 'tab-admin'].forEach(t => {
        document.getElementById(t).classList.add('hidden');
        document.getElementById('btn-' + t).className = 'px-4 py-2 rounded-lg font-medium text-sm text-slate-400 hover:text-white';
      });
      document.getElementById(id).classList.remove('hidden');
      document.getElementById('btn-' + id).className = 'px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 text-white';
    }

    async function login() {
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      if (!email || !password) return showToast('Please enter both email and password', true);

      showToast('Loading account from game servers...');
      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email, password })
        });
        const data = await resp.json();
        if (data.success && data.record) {
          currentAccount = { email, password, uid: data.uid, record: data.record };
          document.getElementById('infoName').innerText = data.record.Name || 'Unknown';
          document.getElementById('infoMoney').innerText = Number(data.record.money || 0).toLocaleString();
          document.getElementById('infoCoin').innerText = Number(data.record.coin || 0).toLocaleString();
          document.getElementById('infoLocalId').innerText = data.record.localID || '-';
          document.getElementById('infoCars').innerText = (data.record.boughtFsos || []).length;
          document.getElementById('statusBadge').innerText = 'Logged In: ' + (data.record.Name || 'User');
          document.getElementById('statusBadge').className = 'px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-semibold';
          showToast('Account loaded successfully!');
        } else {
          showToast(data.message || 'Login failed', true);
        }
      } catch (e) {
        showToast('Network error: ' + e.message, true);
      }
    }

    async function saveCurrentAccount() {
      if (!currentAccount) return showToast('Login first before saving!', true);
      showToast('Saving account changes to cloud...');
      try {
        const resp = await fetch('/api/save', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(currentAccount)
        });
        const data = await resp.json();
        if (data.success) showToast('Account saved successfully!');
        else showToast('Save failed: ' + data.message, true);
      } catch (e) {
        showToast('Network error: ' + e.message, true);
      }
    }

    function setMoney(val) {
      if (!currentAccount) return showToast('Login first!', true);
      currentAccount.record.money = val;
      document.getElementById('infoMoney').innerText = Number(val).toLocaleString();
      showToast('Money updated to ' + val.toLocaleString() + '. Click Save Account to apply!');
    }

    function setCoins(val) {
      if (!currentAccount) return showToast('Login first!', true);
      currentAccount.record.coin = val;
      document.getElementById('infoCoin').innerText = Number(val).toLocaleString();
      showToast('Coins updated to ' + val.toLocaleString() + '. Click Save Account to apply!');
    }

    function setCustomMoney() {
      if (!currentAccount) return showToast('Login first!', true);
      const val = prompt('Enter custom money amount:', '50000000');
      if (val) setMoney(parseInt(val, 10));
    }

    async function setKingRank() {
      if (!currentAccount) return showToast('Login first!', true);
      const resp = await fetch('/api/rank', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ uid: currentAccount.uid, rank: 1 })
      });
      const data = await resp.json();
      showToast(data.success ? 'King Rank set to 1!' : 'Failed: ' + data.message, !data.success);
    }

    async function startAccountClone() {
      const se = document.getElementById('cloneSourceEmail').value.trim();
      const sp = document.getElementById('cloneSourcePass').value.trim();
      const te = document.getElementById('cloneTargetEmail').value.trim();
      const tp = document.getElementById('cloneTargetPass').value.trim();
      if (!se || !sp || !te || !tp) return showToast('Fill in all 4 source and target fields!', true);

      const st = document.getElementById('cloneStatus');
      st.innerText = 'Cloning started in background... Please wait.';
      const resp = await fetch('/api/clone-account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ source_email: se, source_pass: sp, target_email: te, target_pass: tp })
      });
      const d = await resp.json();
      st.innerText = d.message || JSON.stringify(d);
      showToast(d.message);
    }

    async function startUnlockCars() {
      const email = document.getElementById('unlockEmail').value.trim();
      const password = document.getElementById('unlockPass').value.trim();
      if (!email || !password) return showToast('Enter email and password!', true);

      const st = document.getElementById('unlockStatus');
      st.innerText = 'Unlocking 50 cars started...';
      const resp = await fetch('/api/unlock-cars', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      });
      const d = await resp.json();
      st.innerText = d.message || JSON.stringify(d);
      showToast(d.message);
    }

    function unlockExtra(type) {
      if (!currentAccount) return showToast('Login first!', true);
      if (type === 'allhouses') {
        currentAccount.record.flags = currentAccount.record.flags || {};
        currentAccount.record.flags.allhouses = '1';
        showToast('All Houses unlocked! Click Save Account to apply.');
      } else if (type === 'sirens') {
        currentAccount.record.boughtPoliceLights = Array.from({length: 49}, (_, i) => i + 1);
        currentAccount.record.boughtPoliceSirens = Array.from({length: 49}, (_, i) => i + 1);
        showToast('Police Sirens & Lights unlocked! Click Save Account to apply.');
      } else if (type === 'alllevels') {
        currentAccount.record.LevelsDoneTime = Array(50).fill(1.0);
        showToast('All Levels marked complete! Click Save Account to apply.');
      } else if (type === 'allclothes') {
        const male = [], female = [];
        for (let i = 1; i < 200; i++) {
          male.push({ type: 0, id: i, color: 0 });
          female.push({ type: 0, id: i, color: 0 });
        }
        currentAccount.record.personEquipmentsMale = male;
        currentAccount.record.personEquipmentsFemale = female;
        showToast('All Clothes unlocked! Click Save Account to apply.');
      }
    }
  </script>
</body>
</html>`;

// Server Router
const server = http.createServer(async (req, res) => {
  const url = req.url || "/";

  // Root Web Dashboard
  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML_PAGE);
    return;
  }

  // Health check
  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // API Endpoints
  if (req.method === "POST") {
    const body = await readBody(req);

    // /api/login
    if (url === "/api/login") {
      updateStats("total_logins");
      const result = await apiLoadRecord(body.email, body.password);
      sendJson(res, 200, result);
      return;
    }

    // /api/save
    if (url === "/api/save") {
      updateStats("total_actions");
      const result = await apiSaveRecord(body.uid, body.record, body.password, body.email);
      sendJson(res, 200, result);
      return;
    }

    // /api/rank
    if (url === "/api/rank") {
      updateStats("total_actions");
      const result = await apiSetRank(body.uid, body.rank || 1);
      sendJson(res, 200, result);
      return;
    }

    // /api/clone-account (FEATURE A: SOURCE -> TARGET)
    if (url === "/api/clone-account") {
      updateStats("total_actions");
      const { source_email, source_pass, target_email, target_pass } = body;
      const [sToken] = await verifyUser(source_email, source_pass);
      const [tToken, tUid] = await verifyUser(target_email, target_pass);
      if (!sToken || !tToken || !tUid) {
        sendJson(res, 400, { success: false, message: "Login failed for source or target account" });
        return;
      }
      const cars = await cpm1GetCars(sToken);
      if (!cars || cars.length === 0) {
        sendJson(res, 400, { success: false, message: "Source account has no cars" });
        return;
      }

      // Run clone asynchronously
      (async () => {
        let ok = 0;
        for (const car of cars) {
          if (await cpm1CloneCar(tToken, car, tUid)) ok++;
          await new Promise((r) => setTimeout(r, 500));
        }
        adminLog("web", "clone_account", `Cloned ${ok}/${cars.length} from ${source_email} to ${target_email}`);
      })();

      sendJson(res, 200, { success: true, message: `Cloning started for ${cars.length} cars into target account!` });
      return;
    }

    // /api/unlock-cars (FEATURE B: INJECT CARS 1-50)
    if (url === "/api/unlock-cars") {
      updateStats("total_unlocks");
      const { email, password } = body;
      (async () => {
        let ok = 0;
        for (let cid = 1; cid <= 50; cid++) {
          if (await cpm1InjectCar(email, password, cid)) ok++;
          await new Promise((r) => setTimeout(r, 550));
        }
        adminLog("web", "unlock_cars", `Unlocked ${ok}/50 cars for ${email}`);
      })();
      sendJson(res, 200, { success: true, message: "Car unlock injection started for cars 1-50!" });
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CPM Web App running at http://0.0.0.0:${PORT}`);
});
