import { formatUnits, parseUnits } from "viem";
import { DECIMALS } from "./config";

export const usd = (v: bigint | number) => {
  const n = typeof v === "bigint" ? Number(formatUnits(v, DECIMALS)) : v;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
};
export const toUnits = (dollars: string) => parseUnits(dollars || "0", DECIMALS);
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Minutes after local midnight <-> minutes after UTC midnight, using today's offset. */
const tzOffset = () => new Date().getTimezoneOffset(); // UTC - local, in minutes
export const localToUtcMin = (m: number) => (((m + tzOffset()) % 1440) + 1440) % 1440;
export const utcToLocalMin = (m: number) => (((m - tzOffset()) % 1440) + 1440) % 1440;
export const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const duration = (secs: number) => {
  if (secs <= 0) return "now";
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
};

export const localTime = (unix: number) =>
  new Date(unix * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function curfewLabel(startUtc: number, endUtc: number) {
  if (startUtc === endUtc) return "No curfew";
  return `${minToHHMM(utcToLocalMin(startUtc))}–${minToHHMM(utcToLocalMin(endUtc))} your time`;
}
