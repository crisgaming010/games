// ============================================================================
// app.ts — TypeScript conversion of app.py (1:1, nothing removed)
// Runtime: Node.js 18+, Telegram framework: grammY (equivalent of aiogram)
// Run: BOT_TOKEN=... npx tsx app.ts   (deps: grammy @types/node)
// ============================================================================
import { Bot } from "grammy";
import type { Context } from "grammy";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";

// ============================================================
// CONFIG
// ============================================================
export const BOT_TOKEN = process.env.BOT_TOKEN || "8963316186:AAEqfVmNJf8Bm7aVVmDrra-i6j8Yw1X4fbw";
export const OWNER_ID = 6784382795;
export const RATE_LIMIT_ACTIONS = 10;
export const RATE_LIMIT_SECONDS = 60;
export const FK = "AIzaSyCQDz9rgjgmvmFkvVfmvr2-7fT4tfrzRRQ";
export const LOAD_URL = "https://europe-west1-cp-multiplayer.cloudfunctions.net/GetPlayerRecords3";
export const SAVE_URL = "https://europe-west1-cp-multiplayer.cloudfunctions.net/SavePlayerRecordsPartially8";
export const RANK_URL = "https://us-central1-cp-multiplayer.cloudfunctions.net/SetUserRating4";
export const CAR_IDS = [59,133,132,13,53,99,100,102,37,21,48,77,74,2,23,51,163,186,158,55,
  60,61,62,63,64,65,66,67,68,69,70,71,72,73,75,76,78,79,80,81,82,83,
  84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,101,103,104,105,106,
  107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,
  124,125,126,127,128,129,130,131,134,135,136,137,138,139,140,141,142,
  143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,159,160,
  161,162,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,
  179,180,181,182,183,184,185,187,188,189,190,191,192,193,194,195,196,
  197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,
  214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230];
export const MAX_MONEY = 50_000_000;
export const MAX_COIN = 500_000;

// ============================================================
// TYPES
// ============================================================
export type AnyDict = { [k: string]: any };

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
  notes: { [k: string]: any };
  warnings: { [k: string]: any };
  maintenance: boolean;
  broadcast_history: AnyDict[];
  bot_photo: string;
  [k: string]: any; // dynamic keys: rl_<uid> etc.
}

export interface PlayerRecord {
  Name?: string; money?: number; coin?: number; localID?: string;
  boughtFsos?: number[]; FriendsID?: AnyDict[]; LevelsDoneTime?: number[];
  floats?: number[]; integers?: number[]; fcar?: number[];
  favouriteWheels?: number[]; favouriteVinyls?: number[]; favouriteEmojis?: number[];
  personEquipmentsMale?: AnyDict[]; personEquipmentsFemale?: AnyDict[];
  platesData?: AnyDict | null; carIDnStatus?: AnyDict | null;
  allData?: string; flags?: AnyDict; animations?: number[];
  emojiPacks?: number[]; wheels?: number[];
  boughtPoliceLights?: number[]; boughtPoliceSirens?: number[];
  [k: string]: any;
}

// ============================================================
// STORE
// ============================================================
const STORE_PATH = path.join(process.cwd(), "cpm_store.json");

function deepcopy<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

const DEFAULT_STORE: Store = {
  allowed_users: [], vip_users: [], admins: {},
  pending: {}, banned: [], expiry: {},
  stats: { total_logins: 0, total_actions: 0, total_unlocks: 0 },
  admin_log: [], users: {}, daily_stats: {},
  notes: {}, warnings: {},
  maintenance: false, broadcast_history: [],
  bot_photo: "",
};

export function loadStore(): Store {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data: Store = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
      for (const [k, v] of Object.entries(DEFAULT_STORE)) {
        if (!(k in data)) (data as any)[k] = deepcopy(v);
      }
      // Ensure types
      const admins: AnyDict = {};
      for (const [k, v] of Object.entries(data.admins || {})) admins[String(k)] = v;
      data.admins = admins;
      data.allowed_users = [...new Set<number>((data.allowed_users || []).map(Number))] as number[];
      data.vip_users = [...new Set<number>((data.vip_users || []).map(Number))] as number[];
      data.banned = [...new Set<number>((data.banned || []).map(Number))] as number[];
      const remap = (o: any): AnyDict => {
        const out: AnyDict = {};
        for (const [k, v] of Object.entries(o || {})) out[String(k)] = v;
        return out;
      };
      data.pending = remap(data.pending);
      data.expiry = remap(data.expiry);
      data.users = remap(data.users);
      data.notes = remap(data.notes);
      data.warnings = remap(data.warnings);
      return data;
    }
  } catch (e: any) {
    log.error(`Store load error: ${e}`);
  }
  return deepcopy(DEFAULT_STORE);
}

export function saveStore(data: Store): boolean {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e: any) {
    log.error(`Store save error: ${e}`);
    return false;
  }
}

export const STORE: Store = loadStore();
export const ALLOWED_USERS: number[] = STORE.allowed_users || [];
export const BANNED: number[] = STORE.banned || [];
export const VIP_USERS: number[] = STORE.vip_users || [];
export const PENDING: AnyDict = STORE.pending || {};
export const ADMINS: AnyDict = STORE.admins || {};
export const ADMIN_LEVELS: AnyDict = { moderator: 1, admin: 2, superadmin: 3 };

export const isAllowed = (uid: number): boolean => ALLOWED_USERS.includes(uid);
export const isBanned = (uid: number): boolean => BANNED.includes(uid);
export const isPending = (uid: number): boolean => String(uid) in PENDING;
export const isVip = (uid: number): boolean => VIP_USERS.includes(uid);
export const isMaintenance = (): boolean => STORE.maintenance || false;
export const adminLevel = (uid: number): number => ADMIN_LEVELS[ADMINS[String(uid)] || ""] || 0;
export const adminRole = (uid: number): string => ADMINS[String(uid)] || "";
export function hasAdmin(uid: number, required: string = "admin"): boolean {
  return adminLevel(uid) >= (ADMIN_LEVELS[required] ?? 2);
}

export function isExpired(uid: number): boolean {
  const exp = (STORE.expiry || {})[String(uid)];
  if (!exp) return false;
  try { return new Date(exp).getTime() < Date.now(); } catch { return false; }
}

export function checkRateLimit(uid: number): [boolean, number] {
  const now = Date.now() / 1000;
  const key = `rl_${uid}`;
  if (!(key in STORE)) (STORE as any)[key] = [];
  (STORE as any)[key] = ((STORE as any)[key] as number[]).filter((t: number) => now - t < RATE_LIMIT_SECONDS);
  const arr: number[] = (STORE as any)[key];
  if (arr.length >= RATE_LIMIT_ACTIONS) {
    return [false, Math.ceil(RATE_LIMIT_SECONDS - (now - arr[0]))];
  }
  arr.push(now);
  return [true, 0];
}

export function storeAllow(uid: number, name: string = "", save: boolean = true): void {
  if (!ALLOWED_USERS.includes(uid)) {
    ALLOWED_USERS.push(uid);
    STORE.allowed_users = ALLOWED_USERS;
  }
  if (String(uid) in PENDING) {
    delete PENDING[String(uid)];
    STORE.pending = PENDING;
  }
  const bIdx = BANNED.indexOf(uid);
  if (bIdx !== -1) {
    BANNED.splice(bIdx, 1);
    STORE.banned = BANNED;
  }
  STORE.users = STORE.users || {};
  STORE.users[String(uid)] = { name, added: new Date().toISOString() };
  if (save) saveStore(STORE);
}

export function storeBan(uid: number): void {
  const aIdx = ALLOWED_USERS.indexOf(uid);
  if (aIdx !== -1) { ALLOWED_USERS.splice(aIdx, 1); STORE.allowed_users = ALLOWED_USERS; }
  const vIdx = VIP_USERS.indexOf(uid);
  if (vIdx !== -1) { VIP_USERS.splice(vIdx, 1); STORE.vip_users = VIP_USERS; }
  if (!BANNED.includes(uid)) { BANNED.push(uid); STORE.banned = BANNED; }
  if (String(uid) in PENDING) { delete PENDING[String(uid)]; STORE.pending = PENDING; }
  saveStore(STORE);
}

export function storeUnban(uid: number): void {
  const idx = BANNED.indexOf(uid);
  if (idx !== -1) { BANNED.splice(idx, 1); STORE.banned = BANNED; saveStore(STORE); }
}

export function storeRemoveUser(uid: number): void {
  const aIdx = ALLOWED_USERS.indexOf(uid);
  if (aIdx !== -1) { ALLOWED_USERS.splice(aIdx, 1); STORE.allowed_users = ALLOWED_USERS; }
  const vIdx = VIP_USERS.indexOf(uid);
  if (vIdx !== -1) { VIP_USERS.splice(vIdx, 1); STORE.vip_users = VIP_USERS; }
  if (String(uid) in PENDING) { delete PENDING[String(uid)]; STORE.pending = PENDING; }
  saveStore(STORE);
}

export function storeAddAdmin(uid: number, role: string = "admin"): void {
  ADMINS[String(uid)] = role;
  STORE.admins = ADMINS;
  if (!ALLOWED_USERS.includes(uid)) storeAllow(uid, "", false);
  saveStore(STORE);
}

export function storeRemoveAdmin(uid: number): void {
  if (String(uid) in ADMINS) { delete ADMINS[String(uid)]; STORE.admins = ADMINS; saveStore(STORE); }
}

export function storeAddPending(uid: number, name: string, username: string = ""): void {
  PENDING[String(uid)] = { name, username, time: new Date().toISOString() };
  STORE.pending = PENDING;
  saveStore(STORE);
}

export function storeAddVip(uid: number): void {
  if (!VIP_USERS.includes(uid)) { VIP_USERS.push(uid); STORE.vip_users = VIP_USERS; saveStore(STORE); }
}

export function storeRemoveVip(uid: number): void {
  const idx = VIP_USERS.indexOf(uid);
  if (idx !== -1) { VIP_USERS.splice(idx, 1); STORE.vip_users = VIP_USERS; saveStore(STORE); }
}

export function storeSetExpiry(uid: number, days: number): void {
  const exp = new Date(Date.now() + days * 86400_000).toISOString();
  STORE.expiry = STORE.expiry || {};
  STORE.expiry[String(uid)] = exp;
  saveStore(STORE);
}

export function storeRemoveExpiry(uid: number): void {
  if (STORE.expiry && String(uid) in STORE.expiry) {
    delete STORE.expiry[String(uid)];
    saveStore(STORE);
  }
}

export function adminLog(actorId: number, action: string, target: string = ""): void {
  STORE.admin_log = STORE.admin_log || [];
  STORE.admin_log.push({
    time: new Date().toISOString(),
    actor: actorId,
    action,
    target,
  });
  saveStore(STORE);
}

export function updateDailyStats(key: string = "actions"): void {
  const today = new Date().toISOString().slice(0, 10);
  STORE.daily_stats = STORE.daily_stats || {};
  STORE.daily_stats[today] = STORE.daily_stats[today] || {};
  STORE.daily_stats[today][key] = (STORE.daily_stats[today][key] || 0) + 1;
  saveStore(STORE);
}

export function addBroadcastHistory(actorId: number, btype: string, content: string, sent: number, failed: number): void {
  STORE.broadcast_history = STORE.broadcast_history || [];
  STORE.broadcast_history.push({
    time: new Date().toISOString(),
    actor: actorId,
    type: btype,
    content,
    sent,
    failed,
  });
  saveStore(STORE);
}

// ============================================================
// LOGGING
// ============================================================
function ts(): string {
  const d = new Date();
  return d.toISOString().slice(11, 19);
}
export const log = {
  info: (m: string) => console.log(`${ts()} | INFO | ${m}`),
  error: (m: string) => console.log(`${ts()} | ERROR | ${m}`),
  warning: (m: string) => console.log(`${ts()} | WARNING | ${m}`),
};

// ============================================================
// CRYPTO / DECODE
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
  try { return zlib.inflateRawSync(data); } catch { /* fall through */ }
  try { return zlib.inflateSync(data); } catch { /* fall through */ }
  try { return zlib.brotliDecompressSync(data); } catch { /* fall through */ }
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

export function encryptAes(data: Buffer, key: Buffer): Buffer | null {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    return Buffer.concat([iv, cipher.update(data), cipher.final()]);
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

// ============================================================
// BINARY READER
// ============================================================
export class Reader {
  buf: Buffer;
  pos: number;
  constructor(data: Buffer) { this.buf = data; this.pos = 0; }
  hasBytes(n: number): boolean { return this.pos + n <= this.buf.length; }
  readByte(): number {
    if (!this.hasBytes(1)) return 0;
    return this.buf[this.pos++];
  }
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
    if (ln <= 0) return "";
    if (!this.hasBytes(ln)) return "";
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
      if (typ === 0) {
        out.push({ type: 0, id: this.readInt(), color: this.readInt() });
      } else if (typ === 1) {
        out.push({ type: 1, id: this.readInt() });
      } else if (typ === 2) {
        out.push({ type: 2, id: this.readInt(), color: this.readInt(), float: this.readFloat() });
      } else {
        out.push({ type: typ, id: this.readInt() });
      }
    }
    return out;
  }
}

export function parsePlayer(buf: Buffer): PlayerRecord | null {
  const r = new Reader(buf);
  if (r.readByte() === 0) return null;
  const p: PlayerRecord = {};
  p["Name"] = r.readString(); p["money"] = r.readInt();
  p["coin"] = r.readInt(); p["localID"] = r.readString();
  p["boughtFsos"] = r.readList<number>(() => r.readInt());
  const readFriend = (): AnyDict => {
    r.readByte();
    return { id: r.readString(), Name: r.readString(), accountID: r.readString() };
  };
  p["FriendsID"] = r.readList<AnyDict>(readFriend);
  p["LevelsDoneTime"] = r.readList<number>(() => r.readFloat());
  p["floats"] = r.readList<number>(() => r.readFloat());
  p["integers"] = r.readList<number>(() => r.readInt());
  p["fcar"] = r.readList<number>(() => r.readInt());
  p["favouriteWheels"] = r.readList<number>(() => r.readInt());
  p["favouriteVinyls"] = r.readList<number>(() => r.readInt());
  p["favouriteEmojis"] = r.readList<number>(() => r.readInt());
  p["personEquipmentsMale"] = r.readEquipment();
  p["personEquipmentsFemale"] = r.readEquipment();
  if (r.readByte() === 0) {
    p["platesData"] = null;
  } else {
    const readVinyl = (): AnyDict => {
      r.readByte();
      const rv = (): AnyDict => ({ x: r.readFloat(), y: r.readFloat(), z: r.readFloat() });
      return {
        vectors: r.readList<AnyDict>(rv),
        v: r.readList<string>(() => r.readString()),
        floats: r.readList<number>(() => r.readFloat()),
        text: r.readString(),
      };
    };
    const readPlate = (): AnyDict => {
      r.readByte();
      return {
        plateId: r.readInt(), frontCarId: r.readInt(),
        rearCarId: r.readInt(), vinyls: r.readList<AnyDict>(readVinyl),
      };
    };
    p["platesData"] = { allPlates: r.readList<AnyDict>(readPlate) };
  }
  if (r.readByte() === 0) {
    p["carIDnStatus"] = null;
  } else {
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

export function tryParse(buf: Buffer): PlayerRecord | AnyDict | null {
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
        if (p && p["Name"] !== undefined && p["Name"] !== null) return p;
      } catch { /* ignore */ }
    }
    try {
      const hasBom = c.length >= 3 && c[0] === 0xef && c[1] === 0xbb && c[2] === 0xbf;
      const clean = hasBom ? c.subarray(3) : c;
      if (clean && clean.length > 0 && clean[0] === 123) { // '{'
        return JSON.parse(clean.toString("utf-8"));
      }
    } catch { /* ignore */ }
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
  if (buf.length < 10) {
    return { success: false, message: "Record data too small" };
  }
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

// ============================================================
// BINARY WRITER
// ============================================================
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
      const t = item["type"] ?? 0;
      this.writeByte(t);
      if (t === 0) {
        this.writeInt(item["id"] ?? 0); this.writeInt(item["color"] ?? 0);
      } else if (t === 1) {
        this.writeInt(item["id"] ?? 0);
      } else if (t === 2) {
        this.writeInt(item["id"] ?? 0); this.writeInt(item["color"] ?? 0); this.writeFloat(item["float"] ?? 0.0);
      } else {
        this.writeInt(item["id"] ?? 0);
      }
    }
  }
  writePlates(data: AnyDict | null | undefined): void {
    if (data === null || data === undefined) { this.writeByte(0); return; }
    this.writeByte(1);
    const wv = (v: AnyDict): void => {
      this.writeByte(1);
      this.writeList<AnyDict>(v["vectors"] || [], (x) => {
        this.writeFloat(x["x"]); this.writeFloat(x["y"]); this.writeFloat(x["z"]);
      });
      this.writeList<string>(v["v"] || [], (s) => this.writeString(s));
      this.writeList<number>(v["floats"] || [], (f) => this.writeFloat(f));
      this.writeString(v["text"] ?? "");
    };
    const wp = (p: AnyDict): void => {
      this.writeByte(1);
      this.writeInt(p["plateId"] ?? 0); this.writeInt(p["frontCarId"] ?? 0); this.writeInt(p["rearCarId"] ?? 0);
      this.writeList<AnyDict>(p["vinyls"] || [], wv);
    };
    this.writeList<AnyDict>(data["allPlates"] || [], wp);
  }
  writeCarIdStatus(data: AnyDict | null | undefined): void {
    if (data === null || data === undefined) { this.writeByte(0); return; }
    this.writeByte(1);
    this.writeList<string>(data["carGeneratedIDs"] || [], (s) => this.writeString(s));
    this.writeList<number>(data["carStatus"] || [], (i) => this.writeInt(i));
  }
  toBytes(): Buffer { return Buffer.concat(this.parts); }
}

export function serializePlayer(p: PlayerRecord): Buffer {
  const w = new Writer();
  w.writeByte(1);
  w.writeString(p["Name"] ?? "");
  w.writeInt(p["money"] ?? 0);
  w.writeInt(p["coin"] ?? 0);
  w.writeString(p["localID"] ?? "");
  w.writeList<number>(p["boughtFsos"] || [], (i) => w.writeInt(i));
  const wf = (f: AnyDict): void => {
    w.writeByte(1);
    w.writeString(f["id"] ?? "");
    w.writeString(f["Name"] ?? "");
    w.writeString(f["accountID"] ?? "");
  };
  w.writeList<AnyDict>(p["FriendsID"] || [], wf);
  w.writeList<number>(p["LevelsDoneTime"] || [], (f) => w.writeFloat(f));
  w.writeList<number>(p["floats"] || [], (f) => w.writeFloat(f));
  w.writeList<number>(p["integers"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["fcar"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["favouriteWheels"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["favouriteVinyls"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["favouriteEmojis"] || [], (i) => w.writeInt(i));
  w.writeEquipment(p["personEquipmentsMale"] || []);
  w.writeEquipment(p["personEquipmentsFemale"] || []);
  w.writePlates(p["platesData"] ?? null);
  w.writeCarIdStatus(p["carIDnStatus"] ?? null);
  w.writeString(p["allData"] ?? "");
  w.writeDict(p["flags"] || {});
  w.writeList<number>(p["animations"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["emojiPacks"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["wheels"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["boughtPoliceLights"] || [], (i) => w.writeInt(i));
  w.writeList<number>(p["boughtPoliceSirens"] || [], (i) => w.writeInt(i));
  return w.toBytes();
}
// ============================================================
// API (Game Record Load/Save)
// ============================================================
export const FIREBASE_LOGIN_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FK;

export async function firebaseLogin(email: string, password: string): Promise<[string | null, string]> {
  const payload = {
    email,
    password,
    returnSecureToken: true,
    clientType: "CLIENT_TYPE_ANDROID",
  };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(FIREBASE_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data: any = await resp.json().catch(() => ({}));
    if (resp.status === 200 && data.idToken) {
      return [data.idToken, data.localId || ""];
    }
    const err = data?.error?.message || "";
    if (err.includes("EMAIL_NOT_FOUND") || err.includes("INVALID_EMAIL")) {
      return [null, "Email not found. Check your email."];
    }
    if (err.includes("INVALID_PASSWORD") || err.includes("INVALID_LOGIN_CREDENTIALS")) {
      return [null, "Wrong password. Please try again."];
    }
    if (err.includes("USER_DISABLED")) {
      return [null, "Account is disabled."];
    }
    if (err.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
      return [null, "Too many failed attempts. Try again later."];
    }
    return [null, err || `Firebase error (HTTP ${resp.status})`];
  } catch (e: any) {
    return [null, `Network error: ${e.message || String(e)}`];
  }
}

export async function apiLoadRecord(email: string = "", password: string = ""): Promise<AnyDict> {
  const [idToken, firebaseUid] = await firebaseLogin(email, password);
  if (!idToken) {
    return { success: false, message: firebaseUid };
  }

  const payload = {
    email,
    password,
    uid: firebaseUid,
    fk: FK,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(LOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await resp.text();
    if (resp.status !== 200) {
      let errMsg = "";
      try {
        const errData = JSON.parse(text);
        errMsg = errData.error || errData.message || errData.detail || text.slice(0, 300);
      } catch {
        errMsg = text ? text.slice(0, 300) : `HTTP ${resp.status}`;
      }
      return { success: false, message: errMsg };
    }

    let b64 = "";
    let extractedUid = "";
    try {
      const data = JSON.parse(text);
      if (typeof data === "object" && data !== null) {
        if ("error" in data) {
          return { success: false, message: data.error };
        }
        b64 = data.base64 || data.record || "";
        extractedUid = data.uid || "";
      }
    } catch {
      b64 = text;
    }

    b64 = b64.trim().replace(/\r/g, "").replace(/\n/g, "").replace(/ /g, "").replace(/\t/g, "");
    if (!b64) {
      return { success: false, message: "Empty response from server" };
    }

    const uidToUse = extractedUid || firebaseUid;
    const res = decryptPlayerRecord(b64, uidToUse, password, email);
    if (res.success) {
      res.uid = uidToUse;
    }
    return res;
  } catch (e: any) {
    return { success: false, message: `Network error: ${e.message || String(e)}` };
  }
}

export async function apiSaveRecord(
  uid: string,
  record: PlayerRecord,
  password: string = "",
  email: string = ""
): Promise<AnyDict> {
  const raw = serializePlayer(record);
  if (!raw || raw.length === 0) {
    return { success: false, message: "Serialize failed" };
  }
  const comp = compress(raw);
  const b64 = comp.toString("base64");
  const payload = {
    uid,
    password,
    email,
    fk: FK,
    base64: b64,
  };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await resp.text();
    return { success: true, response: text };
  } catch (e: any) {
    return { success: false, message: e.message || String(e) };
  }
}

export async function apiSetRank(uid: string, rank: any): Promise<AnyDict> {
  const payload = { uid, rank, fk: FK };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(RANK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return { success: resp.status === 200, response: await resp.text() };
  } catch (e: any) {
    return { success: false, message: e.message || String(e) };
  }
}

// ============================================================
// CLONE & UNLOCK CARS FEATURES (From main-1)
// ============================================================
export const _CPM1_FB_KEY = "AIzaSyBW1ZbMiUeDZHYUO2bY8Bfnf5rRgrQGPTM";
export const SOURCE_ACCOUNT: [string, string] = ["primocloneacc1@gmail.com", "123456"];

export async function verifyUser(email: string, password: string): Promise<[string | null, string | null]> {
  const payload = {
    email,
    password,
    returnSecureToken: true,
    clientType: "CLIENT_TYPE_ANDROID",
  };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + _CPM1_FB_KEY;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
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
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const resp = await fetch(
      `https://europe-west1-cp-multiplayer.cloudfunctions.net/${endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ data }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    const text = await resp.text();
    return [resp.status, text];
  } catch {
    return [500, JSON.stringify({ result: "error" })];
  }
}

export async function cpm1GetCars(token: string): Promise<AnyDict[] | null> {
  const [status, text] = await cpm1Api(token, "GetAllCars2", null);
  if (status !== 200) return null;
  try {
    const outer = JSON.parse(text);
    const result = JSON.parse(outer.result);
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function cpm1GetGarageSlot(token: string): Promise<AnyDict | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [status, text] = await cpm1Api(token, "WSGetCarListV3", 20);
      if (status === 200) {
        try {
          const data = JSON.parse(text);
          const result = JSON.parse(data.result);
          if (Array.isArray(result) && result.length > 0) {
            for (const slot of result) {
              if ((slot?.carID ?? 0) === 0) return slot;
            }
            return result[0];
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    await delay(500);
  }
  try {
    const [status, text] = await cpm1Api(token, "WSGetCarListV3", 20);
    if (status === 200) {
      try {
        const data = JSON.parse(text);
        const result = JSON.parse(data.result);
        if (Array.isArray(result) && result.length > 0) {
          return result[0];
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return null;
}

export async function cpm1GetFullCar(token: string, carData: AnyDict): Promise<AnyDict | null> {
  const cid = carData.CarID || carData.carID || 0;
  const gen = carData.carGeneratedID || carData.CarGeneratedID || "";
  const endpoints: [string, any][] = [
    ["WSGetFullCarV3", JSON.stringify({ CarID: cid, carGeneratedID: gen })],
    ["WSGetFullCarV3", JSON.stringify(carData)],
    ["WSGetFullCarV3", JSON.stringify({ CarID: cid })],
    ["TestGetAllCars", null],
  ];
  for (const [endpoint, data] of endpoints) {
    try {
      const [status, text] = await cpm1Api(token, endpoint, data);
      if (status !== 200) continue;
      const raw = JSON.parse(text);
      let result = raw?.result ?? raw;
      if (typeof result === "string") {
        try { result = JSON.parse(result); } catch { /* ignore */ }
      }
      if (typeof result === "object" && result !== null && !Array.isArray(result)) {
        if (result.CarID || result.carID) return result;
      }
      if (Array.isArray(result) && result.length > 0) {
        for (const item of result) {
          if (typeof item !== "object" || item === null) continue;
          if (item.CarID === cid || item.carID === cid) return item;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function cpm1FixCarAppearance(carInput: AnyDict): AnyDict {
  if (typeof carInput !== "object" || carInput === null) return carInput;
  const car: AnyDict = JSON.parse(JSON.stringify(carInput));
  let vyn = car.Vynils;
  if (typeof vyn !== "object" || vyn === null || Array.isArray(vyn)) {
    vyn = {};
  }
  if (!("CarID" in vyn) && car.CarID !== undefined && car.CarID !== null) {
    vyn["CarID"] = car.CarID;
  }
  car.Vynils = vyn;

  const ensureColorList = (key: string, length: number, defVal: number = 1.0) => {
    const val = car[key];
    if (!Array.isArray(val) || val.length === 0) {
      car[key] = Array(length).fill(Number(defVal));
    } else {
      const fixed: number[] = [];
      for (const x of val) {
        let fx = Number(x);
        if (isNaN(fx)) fx = defVal;
        if (fx === 0.0) fx = 0.15;
        fixed.push(fx);
      }
      car[key] = fixed;
    }
  };

  for (const key of ["colors", "Colors", "bodyColor", "paint"]) {
    if (key in car || key === "colors" || key === "Colors") {
      ensureColorList(key, 4, 0.85);
    }
  }

  if (typeof car.color === "number" && Number(car.color || 0) === 0) {
    car.color = 1;
  }
  car.police = car.police === undefined || car.police === null ? true : car.police;
  car.isLocked = false;
  if (car.engineID === undefined || car.engineID === null || car.engineID === 0) {
    car.engineID = 5;
  }
  car.cdi = true;
  car.torque = car.torque || 3000.0;
  car.brake = car.brake || 3000.0;
  car.mass = car.mass || 1100.0;
  return car;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ------------------------------------------------------------
// FEATURE 1: CLONE CAR / ACCOUNT (SOURCE -> TARGET)
// ------------------------------------------------------------
export async function cpm1CloneCar(
  tokenTarget: string,
  carData: AnyDict,
  targetUid: string,
  tokenSource?: string | null
): Promise<boolean> {
  const cid = carData.CarID || carData.carID || 0;
  let full: AnyDict | null = null;
  if (tokenSource) {
    try {
      full = await cpm1GetFullCar(tokenSource, carData);
    } catch {
      full = null;
    }
  }

  const base = (typeof full === "object" && full !== null) ? full : carData;
  const car = cpm1FixCarAppearance(base);
  car["CarID"] = cid;

  try {
    if ("texts" in car && Array.isArray(car.texts) && car.texts.length > 2) {
      car.texts[2] = `${String(targetUid).slice(0, 8).toUpperCase()}_${cid} HZ`;
    } else if ("texts" in car && typeof car.texts === "string") {
      car.texts = ["", "", `${String(targetUid).slice(0, 8).toUpperCase()} ${cid}_HZ`];
    }
  } catch { /* ignore */ }

  try {
    if (typeof car.Vynils === "object" && car.Vynils !== null && !Array.isArray(car.Vynils)) {
      car.Vynils["CarID"] = cid;
    }
  } catch { /* ignore */ }

  const slot = await cpm1GetGarageSlot(tokenTarget);
  if (!slot) return false;

  let vynil = (typeof car.Vynils === "object" && car.Vynils !== null && !Array.isArray(car.Vynils))
    ? car.Vynils
    : {};
  if (!vynil || Object.keys(vynil).length === 0) {
    vynil = { CarID: cid };
  }

  const payload = {
    ownerID: slot.ownerID || "",
    ownerName: slot.ownerName || "",
    description: slot.description || "",
    CarID: slot.carID || 0,
    carGeneratedID: slot.carGeneratedID || "",
    ownerAccountID: slot.ownerAccountID || "",
    oneCar: car,
    vynilOneCar: vynil,
    loadedLocalCar: { instanceID: randInt(-999999, -100000) },
    price: slot.price ?? 100,
    SellingCar: {},
    willReject: false,
    dislike: 1,
    like: 0,
    liked: false,
    disliked: false,
    mode: 1,
  };

  const [status, text] = await cpm1Api(tokenTarget, "WSPurchaseCarV3", JSON.stringify(payload));
  try {
    if (status === 200) {
      const parsed = JSON.parse(text);
      const resVal = String(parsed?.result);
      if (resVal === "1" || resVal === "true" || parsed?.result === 1) {
        return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

// ------------------------------------------------------------
// FEATURE 2: UNLOCK CARS (INJECT CARS USING TEMPLATE FROM SOURCE ACCOUNT)
// ------------------------------------------------------------
export async function cpm1InjectCar(
  email: string,
  password: string,
  carId: number
): Promise<boolean> {
  try {
    const [tok, uid] = await verifyUser(email, password);
    if (!tok || !uid) return false;

    const [stok] = await verifyUser(SOURCE_ACCOUNT[0], SOURCE_ACCOUNT[1]);
    if (!stok) return false;

    const [status, text] = await cpm1Api(stok, "GetAllCars2", null);
    if (status !== 200) return false;

    let cars: AnyDict[];
    try {
      cars = JSON.parse(JSON.parse(text).result);
    } catch {
      return false;
    }
    if (!Array.isArray(cars) || cars.length === 0) return false;

    let tpl = cars[0];
    for (const c of cars) {
      if ((c?.CarID || 0) > (tpl?.CarID || 0)) tpl = c;
    }

    let car: AnyDict = JSON.parse(JSON.stringify(tpl));
    car["CarID"] = carId;
    car = cpm1FixCarAppearance(car);
    car["CarID"] = carId;

    try {
      if ("texts" in car && Array.isArray(car.texts) && car.texts.length > 2) {
        car.texts[2] = `${uid.slice(0, 8).toUpperCase()}_${carId}_HZ`;
      }
    } catch { /* ignore */ }

    try {
      if (typeof car.Vynils === "object" && car.Vynils !== null && !Array.isArray(car.Vynils)) {
        car.Vynils["CarID"] = carId;
      }
    } catch { /* ignore */ }

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
      loadedLocalCar: { instanceID: randInt(-999999, -100000) },
      price: slot.price ?? 100,
      SellingCar: {},
      willReject: false,
      dislike: 1,
      like: 0,
      liked: false,
      disliked: false,
      mode: 1,
    };

    const [pStatus, pText] = await cpm1Api(tok, "WSPurchaseCarV3", JSON.stringify(payload));
    try {
      const result = JSON.parse(pText);
      const resVal = String(result?.result);
      return pStatus === 200 && (resVal === "1" || resVal === "true" || resVal === "True");
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

export async function cpm1UnlockCarsOnAccount(
  email: string,
  password: string,
  carIds?: number[] | null,
  progressCb?: ((current: number, total: number, ok: number, fail: number) => void) | null
): Promise<[boolean, { success: number; fail: number; total: number; error?: string }]> {
  const [token, uid] = await verifyUser(email, password);
  if (!token || !uid) {
    return [false, { error: "Login failed", success: 0, fail: 0, total: 0 }];
  }

  const ids = carIds && carIds.length > 0 ? carIds : Array.from({ length: 270 }, (_, i) => i + 1);
  const existing = (await cpm1GetCars(token)) || [];
  const template = existing.length > 0 ? existing[0] : { CarID: 1, Vynils: { CarID: 1 }, engineID: 5 };

  let ok = 0;
  let fail = 0;
  const total = ids.length;

  for (let i = 0; i < total; i++) {
    const cid = ids[i];
    let car: AnyDict = JSON.parse(JSON.stringify(template));
    car["CarID"] = cid;
    if (typeof car.Vynils === "object" && car.Vynils !== null && !Array.isArray(car.Vynils)) {
      car.Vynils["CarID"] = cid;
    } else {
      car.Vynils = { CarID: cid };
    }
    car = cpm1FixCarAppearance(car);

    if (await cpm1CloneCar(token, car, uid, token)) {
      ok++;
    } else {
      try {
        if (await cpm1InjectCar(email, password, cid)) {
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }

    if (progressCb) {
      try { progressCb(i + 1, total, ok, fail); } catch { /* ignore */ }
    }
    await delay(550);
  }

  return [ok > 0, { success: ok, fail, total }];
}
// ============================================================
// KEYBOARDS
// ============================================================
export function kbMain(isAdmin: boolean = false) {
  const buttons: { text: string; callback_data: string }[][] = [
    [{ text: "Login", callback_data: "do_login" }],
    [{ text: "Save Account", callback_data: "do_save" }],
    [{ text: "Account", callback_data: "menu_account" }],
    [{ text: "Stats & Money", callback_data: "menu_stats" }],
    [{ text: "Cars & Garage", callback_data: "menu_cars" }],
    [{ text: "Unlocks & Extras", callback_data: "menu_unlocks" }],
  ];
  if (isAdmin) {
    buttons.push([{ text: "Admin Panel", callback_data: "menu_admin" }]);
  }
  return { inline_keyboard: buttons };
}

export function kbAccount() {
  return {
    inline_keyboard: [
      [
        { text: "Info", callback_data: "acc_info" },
        { text: "Set Name", callback_data: "acc_set_name" },
      ],
      [
        { text: "Set ID", callback_data: "acc_set_id" },
        { text: "Change Email", callback_data: "acc_change_email" },
      ],
      [
        { text: "Change Password", callback_data: "acc_change_password" },
        { text: "Clone Account", callback_data: "acc_clone" },
      ],
      [{ text: "Copy Plates", callback_data: "acc_copy_plates" }],
      [{ text: "Back", callback_data: "menu_main" }],
    ],
  };
}

export function kbStats() {
  return {
    inline_keyboard: [
      [
        { text: "Money 50M", callback_data: "stat_money_max" },
        { text: "Coins 500K", callback_data: "stat_coins_max" },
      ],
      [
        { text: "Custom Money", callback_data: "stat_money_custom" },
        { text: "Custom Coins", callback_data: "stat_coins_custom" },
      ],
      [
        { text: "Race Wins", callback_data: "stat_race_wins" },
        { text: "Race Loses", callback_data: "stat_race_loses" },
      ],
      [{ text: "King Rank", callback_data: "stat_king_rank" }],
      [{ text: "Back", callback_data: "menu_main" }],
    ],
  };
}

export function kbCars() {
  return {
    inline_keyboard: [
      [
        { text: "Unlock All Cars", callback_data: "car_unlock_all" },
        { text: "Buy Car (ID)", callback_data: "car_buy_id" },
      ],
      [
        { text: "Bumpers All", callback_data: "car_bumpers_all" },
        { text: "Bumpers Single", callback_data: "car_bumpers_single" },
      ],
      [
        { text: "Chrome All", callback_data: "car_chrome_all" },
        { text: "Chrome Single", callback_data: "car_chrome_single" },
      ],
      [
        { text: "Preset All", callback_data: "car_preset_all" },
        { text: "Preset Single", callback_data: "car_preset_single" },
      ],
      [
        { text: "Police All", callback_data: "car_police_all" },
        { text: "Police Single", callback_data: "car_police_single" },
      ],
      [
        { text: "Clone All", callback_data: "car_clone_all" },
        { text: "Clone Single", callback_data: "car_clone_single" },
      ],
      [
        { text: "Vinyls All", callback_data: "car_vinyls_all" },
        { text: "Vinyls Single", callback_data: "car_vinyls_single" },
      ],
      [{ text: "Back", callback_data: "menu_main" }],
    ],
  };
}

export function kbUnlocks() {
  return {
    inline_keyboard: [
      [
        { text: "W16", callback_data: "unl_w16" },
        { text: "Smoke", callback_data: "unl_smoke" },
      ],
      [
        { text: "Fuel", callback_data: "unl_fuel" },
        { text: "No Damage", callback_data: "unl_nodamage" },
      ],
      [
        { text: "Horns", callback_data: "unl_horns" },
        { text: "Animations", callback_data: "unl_animations" },
      ],
      [
        { text: "Perks", callback_data: "unl_perks" },
        { text: "Headlights", callback_data: "unl_headlights" },
      ],
      [
        { text: "Paid House", callback_data: "unl_paidhouse" },
        { text: "All Houses", callback_data: "unl_allhouses" },
      ],
      [
        { text: "Sirens", callback_data: "unl_sirens" },
        { text: "All Levels", callback_data: "unl_alllevels" },
      ],
      [{ text: "All Clothes", callback_data: "unl_allclothes" }],
      [{ text: "Back", callback_data: "menu_main" }],
    ],
  };
}

export function kbAdmin() {
  return {
    inline_keyboard: [
      [
        { text: "Add User", callback_data: "adm_add_user" },
        { text: "Remove User", callback_data: "adm_remove_user" },
      ],
      [
        { text: "Ban", callback_data: "adm_ban" },
        { text: "Unban", callback_data: "adm_unban" },
      ],
      [
        { text: "Add VIP", callback_data: "adm_add_vip" },
        { text: "Remove VIP", callback_data: "adm_remove_vip" },
      ],
      [
        { text: "Add Admin", callback_data: "adm_add_admin" },
        { text: "Remove Admin", callback_data: "adm_remove_admin" },
      ],
      [
        { text: "Broadcast", callback_data: "adm_broadcast" },
        { text: "Stats", callback_data: "adm_stats" },
      ],
      [
        { text: "Maintenance", callback_data: "adm_maintenance" },
        { text: "Logs", callback_data: "adm_logs" },
      ],
      [{ text: "Back", callback_data: "menu_main" }],
    ],
  };
}

export function kbCancel() {
  return {
    inline_keyboard: [[{ text: "Cancel", callback_data: "cancel" }]],
  };
}

// ============================================================
// FSM / USER SESSION STATE
// ============================================================
export interface UserSession {
  state: string;
  data: AnyDict;
}

const userSessions = new Map<number, UserSession>();

export function getSession(userId: number): UserSession {
  let s = userSessions.get(userId);
  if (!s) {
    s = { state: "main", data: {} };
    userSessions.set(userId, s);
  }
  return s;
}

export function clearSession(userId: number): void {
  const s = getSession(userId);
  s.state = "main";
  s.data = {};
}

export function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// CHECKS
// ============================================================
export async function checkUser(ctx: any): Promise<boolean> {
  const uid = ctx.from?.id;
  if (!uid) return false;
  if (isBanned(uid)) {
    await ctx.reply("You are banned from using this bot.");
    return false;
  }
  if (isMaintenance() && uid !== OWNER_ID && !hasAdmin(uid, "admin")) {
    await ctx.reply("Bot is under maintenance. Please try again later.");
    return false;
  }
  if (!isAllowed(uid) && uid !== OWNER_ID) {
    await ctx.reply("You are not authorized. Request access with /start");
    return false;
  }
  if (isExpired(uid)) {
    await ctx.reply("Your access has expired. Contact admin.");
    return false;
  }
  const [ok, wait] = checkRateLimit(uid);
  if (!ok) {
    await ctx.reply(`Rate limit! Wait ${wait}s.`);
    return false;
  }
  return true;
}

export async function checkCallback(ctx: any): Promise<boolean> {
  const uid = ctx.from?.id;
  if (!uid) return false;
  if (isBanned(uid)) {
    await ctx.answerCallbackQuery({ text: "Banned", show_alert: true });
    return false;
  }
  if (isMaintenance() && uid !== OWNER_ID && !hasAdmin(uid, "admin")) {
    await ctx.answerCallbackQuery({ text: "Maintenance", show_alert: true });
    return false;
  }
  if (!isAllowed(uid) && uid !== OWNER_ID) {
    await ctx.answerCallbackQuery({ text: "Not authorized", show_alert: true });
    return false;
  }
  return true;
}

// ============================================================
// BOT & HANDLERS
// ============================================================
export const bot = new Bot(BOT_TOKEN);

// /start
bot.command("start", async (ctx) => {
  const uid = ctx.from.id;
  const name = `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || ctx.from.username || "User";
  if (isBanned(uid)) {
    await ctx.reply("You are banned.");
    return;
  }
  if (uid === OWNER_ID) {
    storeAllow(uid, name);
    storeAddAdmin(uid, "superadmin");
  }
  if (uid === OWNER_ID || isAllowed(uid)) {
    await ctx.reply(`Welcome <b>${escapeHtml(name)}</b>! Choose a menu:`, {
      parse_mode: "HTML",
      reply_markup: kbMain(hasAdmin(uid)),
    });
    return;
  }
  if (isPending(uid)) {
    await ctx.reply("Your request is pending approval.");
    return;
  }
  storeAddPending(uid, name, ctx.from.username || "");
  await ctx.reply("Access request sent to admins. Please wait.");
  for (const aid of Object.keys(ADMINS)) {
    try {
      await bot.api.sendMessage(
        Number(aid),
        `New request from ${escapeHtml(name)} (<code>${uid}</code>)`,
        { parse_mode: "HTML" }
      );
    } catch { /* ignore */ }
  }
});

// /help
bot.command("help", async (ctx) => {
  if (!(await checkUser(ctx))) return;
  const text = "<b>Help</b>\n/start - Main menu\n/help - This message\nLogin first, then use menus to modify your account.";
  await ctx.reply(text, { parse_mode: "HTML" });
});

// Callback: menu_main
bot.callbackQuery("menu_main", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const uid = ctx.from.id;
  const s = getSession(uid);
  s.state = "main";
  try {
    await ctx.editMessageText("<b>Main Menu</b>\nLogin to load your account first.", {
      parse_mode: "HTML",
      reply_markup: kbMain(hasAdmin(uid)),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: menu_account
bot.callbackQuery("menu_account", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "account";
  try {
    await ctx.editMessageText("<b>Account Menu</b>\nLogin first to use features.", {
      parse_mode: "HTML",
      reply_markup: kbAccount(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: menu_stats
bot.callbackQuery("menu_stats", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "stats";
  try {
    await ctx.editMessageText("<b>Stats & Money</b>", {
      parse_mode: "HTML",
      reply_markup: kbStats(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: menu_cars
bot.callbackQuery("menu_cars", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "cars";
  try {
    await ctx.editMessageText("<b>Cars & Garage</b>", {
      parse_mode: "HTML",
      reply_markup: kbCars(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: menu_unlocks
bot.callbackQuery("menu_unlocks", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "unlocks";
  try {
    await ctx.editMessageText("<b>Unlocks & Extras</b>", {
      parse_mode: "HTML",
      reply_markup: kbUnlocks(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: menu_admin
bot.callbackQuery("menu_admin", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "admin";
  try {
    await ctx.editMessageText("<b>Admin Panel</b>", {
      parse_mode: "HTML",
      reply_markup: kbAdmin(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: do_login
bot.callbackQuery("do_login", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "login_email";
  try {
    await ctx.editMessageText("Send your Game Email:", {
      reply_markup: kbCancel(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: do_save
bot.callbackQuery("do_save", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  const uid = s.data.uid || "";
  const pw = s.data.password || "";
  const em = s.data.email || "";
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  try { await ctx.editMessageText("Saving account..."); } catch { /* ignore */ }
  const res = await apiSaveRecord(uid, rec, pw, em);
  const userId = ctx.from.id;
  if (res.success) {
    try {
      await ctx.editMessageText("Account saved successfully!", {
        reply_markup: kbMain(hasAdmin(userId)),
      });
    } catch { /* ignore */ }
  } else {
    try {
      await ctx.editMessageText(`Save failed: ${escapeHtml(res.message || "")}`, {
        parse_mode: "HTML",
        reply_markup: kbMain(hasAdmin(userId)),
      });
    } catch { /* ignore */ }
  }
  await ctx.answerCallbackQuery();
});

// Callback: acc_info
bot.callbackQuery("acc_info", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  const text = `<b>Account Info</b>\nName: <code>${escapeHtml(rec.Name || "")}</code>\nMoney: <code>${(rec.money || 0).toLocaleString()}</code>\nCoins: <code>${(rec.coin || 0).toLocaleString()}</code>\nID: <code>${escapeHtml(rec.localID || "")}</code>\nCars: <code>${(rec.boughtFsos || []).length}</code>\nFriends: <code>${(rec.FriendsID || []).length}</code>\nAnimations: <code>${(rec.animations || []).length}</code>\nWheels: <code>${(rec.wheels || []).length}</code>`;
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: kbAccount(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: acc_set_name
bot.callbackQuery("acc_set_name", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "set_name";
  try {
    await ctx.editMessageText("Send new name:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: acc_set_id
bot.callbackQuery("acc_set_id", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "set_id";
  try {
    await ctx.editMessageText("Send new Local ID:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: acc_change_email
bot.callbackQuery("acc_change_email", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "change_email";
  try {
    await ctx.editMessageText("Send new email:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Callback: acc_change_password
bot.callbackQuery("acc_change_password", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "change_password";
  try {
    await ctx.editMessageText("Send new password:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// ============================================================
// FLOW A: CLONE ACCOUNT (DISTINCT FROM UNLOCK CARS)
// Copies all cars from a SOURCE account to a TARGET account
// ============================================================
bot.callbackQuery("acc_clone", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "clone_source_email";
  try {
    await ctx.editMessageText("<b>Clone Account</b>\n\nSend SOURCE account email:", {
      parse_mode: "HTML",
      reply_markup: kbCancel(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// ============================================================
// FLOW B: UNLOCK ALL CARS (DISTINCT FROM CLONE ACCOUNT)
// Injects cars 1-50 into the account
// ============================================================
bot.callbackQuery("car_unlock_all", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  s.state = "unlock_cars_email";
  try {
    await ctx.editMessageText("<b>Unlock All Cars</b>\n\nSend account email:", {
      parse_mode: "HTML",
      reply_markup: kbCancel(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// Unlock extras
bot.callbackQuery("unl_allhouses", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  const flags = rec.flags || {};
  flags.allhouses = "1";
  rec.flags = flags;
  s.data.record = rec;
  await ctx.answerCallbackQuery({ text: "All Houses unlocked", show_alert: true });
});

bot.callbackQuery("unl_sirens", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  rec.boughtPoliceLights = Array.from({ length: 49 }, (_, i) => i + 1);
  rec.boughtPoliceSirens = Array.from({ length: 49 }, (_, i) => i + 1);
  s.data.record = rec;
  await ctx.answerCallbackQuery({ text: "Sirens unlocked", show_alert: true });
});

bot.callbackQuery("unl_alllevels", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  rec.LevelsDoneTime = Array(50).fill(1.0);
  s.data.record = rec;
  await ctx.answerCallbackQuery({ text: "All Levels unlocked", show_alert: true });
});

bot.callbackQuery("unl_allclothes", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const s = getSession(ctx.from.id);
  const rec = s.data.record;
  if (!rec) {
    await ctx.answerCallbackQuery({ text: "Login first!", show_alert: true });
    return;
  }
  const male: AnyDict[] = [];
  const female: AnyDict[] = [];
  for (let i = 1; i < 200; i++) {
    male.push({ type: 0, id: i, color: 0 });
    female.push({ type: 0, id: i, color: 0 });
  }
  rec.personEquipmentsMale = male;
  rec.personEquipmentsFemale = female;
  s.data.record = rec;
  await ctx.answerCallbackQuery({ text: "All Clothes unlocked", show_alert: true });
});

// Admin callbacks
bot.callbackQuery("adm_add_user", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_add_user";
  try {
    await ctx.editMessageText("Send User ID to add:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_remove_user", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_remove_user";
  try {
    await ctx.editMessageText("Send User ID to remove:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_ban", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_ban_user";
  try {
    await ctx.editMessageText("Send User ID to ban:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_unban", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_unban_user";
  try {
    await ctx.editMessageText("Send User ID to unban:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_add_vip", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_add_vip";
  try {
    await ctx.editMessageText("Send User ID to add VIP:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_remove_vip", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_remove_vip";
  try {
    await ctx.editMessageText("Send User ID to remove VIP:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_add_admin", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "superadmin")) {
    await ctx.answerCallbackQuery({ text: "Superadmin only", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_add_admin";
  try {
    await ctx.editMessageText("Send User ID to add as admin:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_remove_admin", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "superadmin")) {
    await ctx.answerCallbackQuery({ text: "Superadmin only", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_remove_admin";
  try {
    await ctx.editMessageText("Send User ID to remove admin:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_broadcast", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const s = getSession(ctx.from.id);
  s.state = "adm_broadcast";
  try {
    await ctx.editMessageText("Send broadcast message:", { reply_markup: kbCancel() });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_stats", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const stats = STORE.stats || { total_logins: 0, total_actions: 0, total_unlocks: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const daily = (STORE.daily_stats || {})[today] || {};
  const text = `<b>Bot Stats</b>\nTotal Logins: ${stats.total_logins || 0}\nTotal Actions: ${stats.total_actions || 0}\nTotal Unlocks: ${stats.total_unlocks || 0}\nAllowed Users: ${ALLOWED_USERS.length}\nVIP Users: ${VIP_USERS.length}\nBanned: ${BANNED.length}\nPending: ${Object.keys(PENDING).length}\nAdmins: ${Object.keys(ADMINS).length}\nToday Actions: ${daily.actions || 0}\nToday Unlocks: ${daily.unlocks || 0}`;
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: kbAdmin(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("adm_maintenance", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "superadmin")) {
    await ctx.answerCallbackQuery({ text: "Superadmin only", show_alert: true });
    return;
  }
  STORE.maintenance = !STORE.maintenance;
  saveStore(STORE);
  const status = STORE.maintenance ? "ON" : "OFF";
  await ctx.answerCallbackQuery({ text: `Maintenance ${status}`, show_alert: true });
  try {
    await ctx.editMessageText(`<b>Admin Panel</b>\nMaintenance: ${status}`, {
      parse_mode: "HTML",
      reply_markup: kbAdmin(),
    });
  } catch { /* ignore */ }
});

bot.callbackQuery("adm_logs", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  if (!hasAdmin(ctx.from.id, "admin")) {
    await ctx.answerCallbackQuery({ text: "No access", show_alert: true });
    return;
  }
  const logs = (STORE.admin_log || []).slice(-20);
  let text = "<b>Recent Admin Logs</b>\n";
  for (const logEntry of logs) {
    text += `\n${escapeHtml(logEntry.action || "")} by ${logEntry.actor || ""} -&gt; ${escapeHtml(logEntry.target || "")}`;
  }
  if (text.length > 4000) text = text.slice(0, 4000);
  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: kbAdmin(),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("cancel", async (ctx) => {
  if (!(await checkCallback(ctx))) return;
  const uid = ctx.from.id;
  clearSession(uid);
  try {
    await ctx.editMessageText("<b>Main Menu</b>", {
      parse_mode: "HTML",
      reply_markup: kbMain(hasAdmin(uid)),
    });
  } catch { /* ignore */ }
  await ctx.answerCallbackQuery();
});

// ============================================================
// MESSAGE / TEXT INPUT HANDLER (FSM)
// ============================================================
bot.on("message:text", async (ctx) => {
  const uid = ctx.from.id;
  if (!(await checkUser(ctx))) return;
  const s = getSession(uid);
  const text = ctx.message.text.trim();

  // Login email
  if (s.state === "login_email") {
    if (!text || !text.includes("@")) {
      await ctx.reply("⚠️ That doesn't look like a valid email. Please send your Game Email:", {
        reply_markup: kbCancel(),
      });
      return;
    }
    s.data.login_email = text;
    s.state = "login_pass";
    await ctx.reply("Send your Password:", { reply_markup: kbCancel() });
    return;
  }

  // Login password
  if (s.state === "login_pass") {
    const pw = text;
    const em = s.data.login_email || "";
    if (!em) {
      await ctx.reply("Session expired. Please press Login again.", {
        reply_markup: kbMain(hasAdmin(uid)),
      });
      s.state = "main";
      return;
    }
    const loadingMsg = await ctx.reply("⏳ Loading account, please wait...");
    try {
      const res = await apiLoadRecord(em, pw);
      if (!res.success) {
        const err = escapeHtml(res.message || "Unknown error");
        await ctx.api.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          `❌ Login failed: ${err}\n\nPress Login to try again.`,
          { parse_mode: "HTML", reply_markup: kbMain(hasAdmin(uid)) }
        );
        s.state = "main";
        return;
      }
      const rec = res.record;
      if (!rec) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          "❌ Failed to parse account data. Check your credentials.",
          { reply_markup: kbMain(hasAdmin(uid)) }
        );
        s.state = "main";
        return;
      }
      const recordUid = res.uid || "";
      s.data.record = rec;
      s.data.uid = recordUid;
      s.data.password = pw;
      s.data.email = em;
      await ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `✅ Logged in as <b>${escapeHtml(rec.Name || "")}</b>\nMoney: ${(rec.money || 0).toLocaleString()}\nCoins: ${(rec.coin || 0).toLocaleString()}`,
        { parse_mode: "HTML", reply_markup: kbMain(hasAdmin(uid)) }
      );
      s.state = "main";
      STORE.stats = STORE.stats || { total_logins: 0, total_actions: 0, total_unlocks: 0 };
      STORE.stats.total_logins = (STORE.stats.total_logins || 0) + 1;
      saveStore(STORE);
      updateDailyStats("actions");
    } catch (e: any) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        `❌ Connection error: ${escapeHtml(e.message || String(e))}`,
        { reply_markup: kbMain(hasAdmin(uid)) }
      );
      s.state = "main";
    }
    return;
  }

  // Set name
  if (s.state === "set_name") {
    const rec = s.data.record;
    if (!rec) {
      await ctx.reply("Login first!");
      clearSession(uid);
      return;
    }
    rec.Name = text.slice(0, 32);
    s.data.record = rec;
    await ctx.reply(`Name set to: <b>${escapeHtml(rec.Name)}</b>`, {
      parse_mode: "HTML",
      reply_markup: kbAccount(),
    });
    s.state = "account";
    return;
  }

  // Set ID
  if (s.state === "set_id") {
    const rec = s.data.record;
    if (!rec) {
      await ctx.reply("Login first!");
      clearSession(uid);
      return;
    }
    rec.localID = text.slice(0, 64);
    s.data.record = rec;
    await ctx.reply(`ID set to: <code>${escapeHtml(rec.localID)}</code>`, {
      parse_mode: "HTML",
      reply_markup: kbAccount(),
    });
    s.state = "account";
    return;
  }

  // Change email
  if (s.state === "change_email") {
    s.data.email = text.slice(0, 128);
    await ctx.reply("Email updated for next save.", { reply_markup: kbAccount() });
    s.state = "account";
    return;
  }

  // Change password
  if (s.state === "change_password") {
    s.data.password = text.slice(0, 64);
    await ctx.reply("Password updated for next save.", { reply_markup: kbAccount() });
    s.state = "account";
    return;
  }

  // ------------------------------------------------------------
  // FLOW A INPUTS: CLONE ACCOUNT (SOURCE -> TARGET)
  // ------------------------------------------------------------
  if (s.state === "clone_source_email") {
    s.data.clone_source_email = text;
    s.state = "clone_source_pass";
    await ctx.reply("Send SOURCE password:", { reply_markup: kbCancel() });
    return;
  }

  if (s.state === "clone_source_pass") {
    s.data.clone_source_pass = text;
    s.state = "clone_target_email";
    await ctx.reply("Send TARGET account email:", { reply_markup: kbCancel() });
    return;
  }

  if (s.state === "clone_target_email") {
    s.data.clone_target_email = text;
    s.state = "clone_target_pass";
    await ctx.reply("Send TARGET password:", { reply_markup: kbCancel() });
    return;
  }

  if (s.state === "clone_target_pass") {
    const se = s.data.clone_source_email;
    const sp = s.data.clone_source_pass;
    const te = s.data.clone_target_email;
    const tp = text;
    clearSession(uid);

    const m = await ctx.reply("<b>Cloning...</b>\nLogging into source...", { parse_mode: "HTML" });

    const [sourceToken] = await verifyUser(se, sp);
    if (!sourceToken) {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "❌ Source login failed.", {
        reply_markup: kbMain(hasAdmin(uid)),
      });
      return;
    }

    try {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "<b>Cloning...</b>\nFetching source cars...", {
        parse_mode: "HTML",
      });
    } catch { /* ignore */ }

    const cars = await cpm1GetCars(sourceToken);
    if (!cars || cars.length === 0) {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "❌ Source has no cars.", {
        reply_markup: kbMain(hasAdmin(uid)),
      });
      return;
    }

    const total = cars.length;
    try {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "<b>Cloning...</b>\nLogging into target...", {
        parse_mode: "HTML",
      });
    } catch { /* ignore */ }

    const [targetToken, targetUid] = await verifyUser(te, tp);
    if (!targetToken || !targetUid) {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "❌ Target login failed.", {
        reply_markup: kbMain(hasAdmin(uid)),
      });
      return;
    }

    let done = 0;
    let ok = 0;
    let fail = 0;

    for (let idx = 0; idx < cars.length; idx++) {
      const car = cars[idx];
      if (typeof car !== "object" || car === null) continue;
      const res = await cpm1CloneCar(targetToken, car, targetUid, sourceToken);
      if (res) ok++;
      else fail++;
      done++;
      const pct = Math.floor((done / total) * 100);
      const barFilled = Math.floor(pct / 7);
      const bar = "▰".repeat(barFilled) + "▱".repeat(Math.max(0, 15 - barFilled));
      if (idx % 2 === 0 || done === total) {
        try {
          const carId = car.CarID || car.carID || "?";
          await ctx.api.editMessageText(
            ctx.chat.id,
            m.message_id,
            `<b>Cloning...</b>\n\n[${bar}] ${pct}%\n✔ ${ok} ✗ ${fail} ▸ ${done}/${total}\n\n⏳ Car ${carId}`,
            { parse_mode: "HTML" }
          );
        } catch { /* ignore */ }
      }
      await delay(600);
    }

    let txt = "";
    if (ok === total) txt = `✅ Cloned ${ok}/${total} cars`;
    else if (ok > 0) txt = `⚠️ Partial ${ok}/${total} (fail ${fail})`;
    else txt = `❌ All ${total} cars failed`;

    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        m.message_id,
        `<b>Clone Complete</b>\n\n${txt}`,
        { parse_mode: "HTML", reply_markup: kbMain(hasAdmin(uid)) }
      );
    } catch { /* ignore */ }
    return;
  }

  // ------------------------------------------------------------
  // FLOW B INPUTS: UNLOCK ALL CARS (INJECT CARS 1-50)
  // ------------------------------------------------------------
  if (s.state === "unlock_cars_email") {
    s.data.unlock_cars_email = text;
    s.state = "unlock_cars_pass";
    await ctx.reply("Send password:", { reply_markup: kbCancel() });
    return;
  }

  if (s.state === "unlock_cars_pass") {
    const email = s.data.unlock_cars_email;
    const password = text;
    clearSession(uid);

    const m = await ctx.reply("<b>Unlocking Cars...</b>\nLogging in...", { parse_mode: "HTML" });

    const [token, accUid] = await verifyUser(email, password);
    if (!token || !accUid) {
      await ctx.api.editMessageText(ctx.chat.id, m.message_id, "❌ Login failed.", {
        reply_markup: kbMain(hasAdmin(uid)),
      });
      return;
    }

    const carIds = Array.from({ length: 50 }, (_, i) => i + 1);
    const total = carIds.length;
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < total; i++) {
      const cid = carIds[i];
      const res = await cpm1InjectCar(email, password, cid);
      if (res) ok++;
      else fail++;

      const pct = Math.floor(((i + 1) / total) * 100);
      const barFilled = Math.floor(pct / 7);
      const bar = "▰".repeat(barFilled) + "▱".repeat(Math.max(0, 15 - barFilled));
      if (i % 3 === 0 || i === total - 1) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            m.message_id,
            `<b>Unlocking Cars...</b>\n\n[${bar}] ${pct}%\n✔ ${ok} ✗ ${fail} ▸ ${i + 1}/${total}\n\n⏳ Car ID: ${cid}`,
            { parse_mode: "HTML" }
          );
        } catch { /* ignore */ }
      }
      await delay(550);
    }

    const txt = `${ok > 0 ? "✅" : "❌"} ${ok}/${total} unlocked (fail ${fail})`;
    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        m.message_id,
        `<b>Unlock Complete</b>\n\n${txt}`,
        { parse_mode: "HTML", reply_markup: kbMain(hasAdmin(uid)) }
      );
    } catch { /* ignore */ }
    return;
  }

  // Admin inputs
  if (s.state === "adm_add_user") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeAllow(targetUid);
    adminLog(uid, "add_user", String(targetUid));
    await ctx.reply(`User ${targetUid} added.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_remove_user") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeRemoveUser(targetUid);
    adminLog(uid, "remove_user", String(targetUid));
    await ctx.reply(`User ${targetUid} removed.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_ban_user") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeBan(targetUid);
    adminLog(uid, "ban", String(targetUid));
    await ctx.reply(`User ${targetUid} banned.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_unban_user") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeUnban(targetUid);
    adminLog(uid, "unban", String(targetUid));
    await ctx.reply(`User ${targetUid} unbanned.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_add_vip") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeAddVip(targetUid);
    adminLog(uid, "add_vip", String(targetUid));
    await ctx.reply(`User ${targetUid} is now VIP.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_remove_vip") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeRemoveVip(targetUid);
    adminLog(uid, "remove_vip", String(targetUid));
    await ctx.reply(`User ${targetUid} VIP removed.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_add_admin") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeAddAdmin(targetUid, "admin");
    adminLog(uid, "add_admin", String(targetUid));
    await ctx.reply(`User ${targetUid} is now admin.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_remove_admin") {
    const targetUid = Number(text);
    if (isNaN(targetUid)) {
      await ctx.reply("Invalid ID!");
      return;
    }
    storeRemoveAdmin(targetUid);
    adminLog(uid, "remove_admin", String(targetUid));
    await ctx.reply(`User ${targetUid} admin removed.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }

  if (s.state === "adm_broadcast") {
    let sent = 0;
    let failed = 0;
    for (const auid of ALLOWED_USERS) {
      try {
        await bot.api.sendMessage(auid, `<b>Broadcast</b>\n${escapeHtml(text)}`, { parse_mode: "HTML" });
        sent++;
      } catch {
        failed++;
      }
    }
    addBroadcastHistory(uid, "text", text, sent, failed);
    await ctx.reply(`Broadcast sent: ${sent} ok, ${failed} failed.`, { reply_markup: kbAdmin() });
    s.state = "admin";
    return;
  }
});

// ============================================================
// HEALTH CHECK SERVER (keeps service alive on Render / Cloud)
// ============================================================
export function startHealthCheckServer(): http.Server {
  const port = Number(process.env.PORT) || 8080;
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  server.listen(port, "0.0.0.0", () => {
    log.info(`Health check server running on port ${port}`);
  });
  return server;
}

// ============================================================
// MAIN
// ============================================================
export async function main(): Promise<void> {
  startHealthCheckServer();
  log.info("Starting Telegram bot polling...");
  await bot.start();
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});
