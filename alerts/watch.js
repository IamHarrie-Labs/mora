#!/usr/bin/env node
/**
 * Mora guardian alerts.
 *
 * One run = one pass:
 *   1. Read new messages sent to the Telegram bot (/start <vault>, /stop, /list) and update subscriptions.
 *   2. Scan Base Sepolia for events from subscribed vaults since the last run.
 *   3. Message every subscriber, with a link to the vault page where they can cancel or rescue.
 *
 * Built for any number of people: one bot, anyone can watch any vault, each vault can have many watchers.
 * GitHub Actions runs it every 5 minutes (.github/workflows/guardian-alerts.yml). No server or database:
 *   - The subscriber list is encrypted (AES-256-GCM, key derived from the bot token) and committed to the
 *     repo's `alerts-state` branch, so it survives anything and chat IDs stay private.
 *   - The last scanned block is a working file kept in the Actions cache.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN   bot token from @BotFather (required unless DRY_RUN=1)
 *   MORA_APP_URL         public web app URL, e.g. https://mora.vercel.app (links go to Basescan if unset)
 *   STATE_FILE           working state (default alerts/state.json)
 *   DURABLE_FILE         encrypted subscriber list (the workflow points this at the alerts-state branch)
 *   ALERTS_STATE_KEY     encryption secret; defaults to the bot token. If you ever change the token,
 *                        set this to the OLD token so the existing list can still be read.
 *   RPC_URL              Base Sepolia RPC (default https://sepolia.base.org)
 *   DRY_RUN=1            print messages instead of sending; skip Telegram entirely
 *   SUBSCRIBE            dry-run only: "vault:chatId,..." subscriptions to seed
 *   DRY_MESSAGES         dry-run only: "chatId:text|chatId:text" fake incoming bot messages
 *   START_BLOCK          scan from this block instead of the saved position
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");

const IMPLEMENTATION = process.env.MORA_IMPLEMENTATION || "0x9602447cAaC26C34E9ee0B41a6316032268724ED";
const USDC = (process.env.MORA_USDC || "0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636").toLowerCase();
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "state.json");
const APP_URL = (process.env.MORA_APP_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const DRY = process.env.DRY_RUN === "1";
const EXPLORER = "https://sepolia.basescan.org";

const DURABLE_FILE = process.env.DURABLE_FILE || "";
const STATE_SECRET = process.env.ALERTS_STATE_KEY || TOKEN;

const CHUNK = Number(process.env.LOG_CHUNK || 200); // sepolia.base.org caps eth_getLogs at 200 blocks
const ADDR_CHUNK = Number(process.env.LOG_ADDR_CHUNK || 50); // vault addresses per eth_getLogs call
const FIRST_LOOKBACK = 300; // ~10 minutes of Base blocks on the very first run
const MAX_LOOKBACK = 7_200; // ~4 hours (2s blocks); older gaps are skipped (e.g. if the cache was evicted)
const MAX_VAULTS_PER_CHAT = 20;
const MAX_UPDATE_PAGES = 50; // up to 5,000 bot messages per run
const SEND_GAP_MS = 40; // stay under Telegram's ~30 messages/second limit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const iface = new ethers.Interface([
  "event InstantWithdrawal(address indexed to, uint256 amount)",
  "event WithdrawalQueued(uint256 indexed id, address indexed to, uint256 amount, uint64 unlockAt)",
  "event WithdrawalExecuted(uint256 indexed id, address indexed to, uint256 amount)",
  "event WithdrawalCancelled(uint256 indexed id, address indexed by)",
  "event ChangeQueued(uint256 indexed id, uint8 kind, bytes data, uint64 readyAt)",
  "event ChangeApplied(uint256 indexed id, uint8 kind)",
  "event ChangeCancelled(uint256 indexed id, address indexed by)",
  "event GuardianAdded(address indexed guardian)",
  "event GuardianRemoved(address indexed guardian)",
  "event RecoveryUpdated(address indexed recovery)",
  "event OwnerUpdated(address indexed owner)",
  "event Frozen(address indexed by, uint64 until)",
  "event Rescued(address indexed by, address indexed token, address indexed to, uint256 amount)",
  "event QueueVoided(address indexed by, uint64 epoch)",
  "function token() view returns (address)",
  "function maxExtractableNow() view returns (uint256)",
  "function withdrawalCount() view returns (uint256)",
  "function changeCount() view returns (uint256)",
  "function getWithdrawal(uint256) view returns ((address to, uint128 amount, uint64 unlockAt, uint8 status, uint64 epoch))",
  "function getChange(uint256) view returns ((uint8 kind, uint64 readyAt, uint8 status, uint64 epoch, bytes data))",
]);
const TOPICS = iface.fragments.filter((f) => f.type === "event").map((f) => f.topicHash);
const ERC20 = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const PENDING = 1;

// ------------------------------------------------------------------ formatting

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usd = (raw) => `$${(Number(raw) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const amountOf = (token, raw) => (token.toLowerCase() === USDC ? usd(raw) : `${raw} units of token ${short(token)}`);
const when = (ts) => {
  const d = new Date(Number(ts) * 1000);
  const left = Number(ts) - Math.floor(Date.now() / 1000);
  const rel = left > 0 ? ` (in ${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m)` : "";
  return `${d.toUTCString().replace(/:\d\d GMT$/, " UTC")}${rel}`;
};
const vaultLink = (vault) => (APP_URL ? `${APP_URL}/vault/${vault}` : `${EXPLORER}/address/${vault}`);

function describeChange(kind, data) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  switch (Number(kind)) {
    case 0: {
      const [r] = coder.decode(["(uint128 dailyLimit,uint32 delay,uint16 curfewStart,uint16 curfewEnd)"], data);
      const hm = (m) => `${String(Math.floor(Number(m) / 60)).padStart(2, "0")}:${String(Number(m) % 60).padStart(2, "0")}`;
      const curfew = r.curfewStart === r.curfewEnd ? "no curfew" : `curfew ${hm(r.curfewStart)}–${hm(r.curfewEnd)} UTC`;
      return `change the rules to ${usd(r.dailyLimit)}/day instant, ${Number(r.delay) / 3600}h delay, ${curfew}`;
    }
    case 1:
      return `remove guardian ${coder.decode(["address"], data)[0]}`;
    case 2:
      return `change the recovery address to ${coder.decode(["address"], data)[0]}`;
    default:
      return `make ${coder.decode(["address"], data)[0]} the new owner`;
  }
}

/** Returns { text, urgent } for a decoded vault event. */
function describe(vault, ev) {
  const a = ev.args;
  const head = `Mora vault ${short(vault)}`;
  const act = "Not you? Open the vault to cancel or rescue before it unlocks:";
  switch (ev.name) {
    case "WithdrawalQueued":
      return { urgent: true, text: `⚠️ ${head}\nA withdrawal of ${usd(a.amount)} to ${a.to} was requested (#${a.id}).\nIt unlocks ${when(a.unlockAt)}.\n\n${act}` };
    case "ChangeQueued":
      return { urgent: true, text: `⚠️ ${head}\nSomeone asked to ${describeChange(a.kind, a.data)} (#${a.id}).\nIt applies ${when(a.readyAt)}.\n\n${act}` };
    case "InstantWithdrawal":
      return { urgent: false, text: `💸 ${head}\n${usd(a.amount)} left instantly to ${a.to}, inside the daily allowance.\nIf that wasn't the owner, rescue the rest now:` };
    case "Rescued":
      return { urgent: false, text: `🛟 ${head}\nRescue: ${amountOf(a.token, a.amount)} sent to the recovery address ${a.to}, by ${short(a.by)}.` };
    case "QueueVoided":
      return { urgent: false, text: `🧹 ${head}\nEverything that was waiting has been voided by the rescue. None of it can go through.` };
    case "Frozen":
      return { urgent: false, text: `🧊 ${head}\nFrozen until ${when(a.until)} by ${short(a.by)}. Nothing unlocks until then.` };
    case "WithdrawalCancelled":
      return { urgent: false, text: `✅ ${head}\nWithdrawal #${a.id} was cancelled by ${short(a.by)}.` };
    case "ChangeCancelled":
      return { urgent: false, text: `✅ ${head}\nRule change #${a.id} was cancelled by ${short(a.by)}.` };
    case "WithdrawalExecuted":
      return { urgent: false, text: `📤 ${head}\nWithdrawal #${a.id} went through: ${usd(a.amount)} to ${a.to}.` };
    case "ChangeApplied":
      return { urgent: false, text: `🔧 ${head}\nRule change #${a.id} has been applied.` };
    case "GuardianAdded":
      return { urgent: false, text: `👤 ${head}\nNew guardian added: ${a.guardian}.` };
    case "GuardianRemoved":
      return { urgent: false, text: `👤 ${head}\nGuardian removed: ${a.guardian}.` };
    case "RecoveryUpdated":
      return { urgent: false, text: `🏠 ${head}\nThe recovery address is now ${a.recovery}.` };
    case "OwnerUpdated":
      return { urgent: false, text: `🔑 ${head}\nThe owner is now ${a.owner}.` };
    default:
      return null;
  }
}

// ------------------------------------------------------------------ state

// Two copies of the subscriber list: the working file (Actions cache) and the encrypted durable file
// (alerts-state branch). Each carries a revision number; on load the newer one wins, so neither a lost
// cache nor a failed branch push can drop subscriptions.

const stateKey = () => crypto.createHash("sha256").update(`mora-alerts-state:v1:${STATE_SECRET}`).digest();

function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", stateKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return JSON.stringify({ v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") }, null, 2) + "\n";
}

function decrypt(text) {
  const e = JSON.parse(text);
  const d = crypto.createDecipheriv("aes-256-gcm", stateKey(), Buffer.from(e.iv, "base64"));
  d.setAuthTag(Buffer.from(e.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data, "base64")), d.final()]).toString("utf8"));
}

const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

let durableLocked = false; // true if the durable file exists but can't be decrypted: never overwrite it
let durableSaved = ""; // what's on disk now, to skip rewriting (and re-committing) unchanged state

function loadState() {
  const work = readJson(STATE_FILE) || {};
  let s = { rev: work.rev || 0, offset: work.offset || 0, lastBlock: work.lastBlock ?? null, subs: work.subs || {} };
  if (DURABLE_FILE && fs.existsSync(DURABLE_FILE)) {
    if (!STATE_SECRET) throw new Error("DURABLE_FILE is set but there is no TELEGRAM_BOT_TOKEN or ALERTS_STATE_KEY to decrypt it");
    try {
      const d = decrypt(fs.readFileSync(DURABLE_FILE, "utf8"));
      durableSaved = JSON.stringify({ rev: d.rev, offset: d.offset, subs: d.subs });
      if ((d.rev || 0) >= s.rev) s = { ...s, rev: d.rev || 0, subs: d.subs || {} };
      s.offset = Math.max(s.offset, d.offset || 0);
    } catch (e) {
      durableLocked = true;
      console.error(
        `::error::Can't decrypt ${DURABLE_FILE} (${e.message}). If the bot token changed, add the OLD token as the ALERTS_STATE_KEY secret. The file is left untouched.`
      );
    }
  }
  return s;
}

function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  if (!DURABLE_FILE || durableLocked) return;
  const durable = JSON.stringify({ rev: s.rev, offset: s.offset, subs: s.subs });
  if (durable === durableSaved) return;
  fs.mkdirSync(path.dirname(DURABLE_FILE), { recursive: true });
  fs.writeFileSync(DURABLE_FILE, encrypt({ rev: s.rev, offset: s.offset, subs: s.subs }));
  durableSaved = durable;
}

/** Remove a chat from every vault (used for /stop and for people who blocked the bot). */
function unsubscribe(s, chat, vaults = Object.keys(s.subs)) {
  for (const v of vaults) {
    if (!s.subs[v]) continue;
    s.subs[v] = s.subs[v].filter((c) => c !== chat);
    if (!s.subs[v].length) delete s.subs[v];
  }
  s.rev++;
}
const vaultsOfChat = (s, chat) => Object.keys(s.subs).filter((v) => s.subs[v].includes(chat));

// ------------------------------------------------------------------ telegram

// Dry-run fake inbox: DRY_MESSAGES are served in pages of DRY_PAGE (default 100), like Telegram does.
const dryInbox = (process.env.DRY_MESSAGES || "").split("|").filter(Boolean);
let dryBase = null;

async function tg(method, body) {
  if (DRY) {
    if (method !== "getUpdates") return { ok: true, result: true };
    dryBase ??= body.offset;
    const page = Number(process.env.DRY_PAGE || 100);
    const start = body.offset - dryBase;
    return {
      ok: true,
      result: dryInbox.slice(start, start + Math.min(page, body.limit || 100)).map((m, i) => {
        const [chat, ...rest] = m.split(":");
        return { update_id: body.offset + i, message: { chat: { id: Number(chat), type: "private" }, text: rest.join(":") } };
      }),
    };
  }
  for (let attempt = 1; ; attempt++) {
    let j;
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      j = await r.json().catch(() => ({ ok: false, error_code: r.status, description: `HTTP ${r.status}` }));
    } catch (e) {
      j = { ok: false, error_code: 0, description: e.message };
    }
    if (j.ok) return j;
    const retryable = j.error_code === 429 || j.error_code >= 500 || j.error_code === 0;
    if (!retryable || attempt >= 4) {
      console.warn(`telegram ${method} failed: ${j.error_code} ${j.description}`);
      return j;
    }
    await sleep(((j.parameters && j.parameters.retry_after) || attempt * 2) * 1000);
  }
}

/** Chats that can no longer receive messages (blocked the bot, deleted their account). */
const gone = new Set();

async function send(chat, text, vault) {
  if (gone.has(chat)) return;
  const button = vault ? { reply_markup: { inline_keyboard: [[{ text: APP_URL ? "Open vault: cancel or rescue" : "View vault on Basescan", url: vaultLink(vault) }]] } } : {};
  if (DRY) {
    console.log(`\n--- to chat ${chat} ---\n${text}${vault ? `\n[button → ${vaultLink(vault)}]` : ""}`);
    if (String(process.env.DRY_GONE || "").split(",").includes(String(chat))) gone.add(chat);
    return;
  }
  const j = await tg("sendMessage", { chat_id: chat, text, disable_web_page_preview: true, ...button });
  if (!j.ok && (j.error_code === 403 || /chat not found|user is deactivated/i.test(j.description || ""))) gone.add(chat);
  await sleep(SEND_GAP_MS);
}

// ------------------------------------------------------------------ chain

const CLONE_CODE = `0x363d3d373d3d3d363d73${IMPLEMENTATION.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`;
async function isMoraVault(provider, addr) {
  return (await provider.getCode(addr)).toLowerCase() === CLONE_CODE;
}

async function summary(provider, vault) {
  const c = new ethers.Contract(vault, iface, provider);
  const [bal, max, wc, cc] = await Promise.all([
    provider.call({ to: USDC, data: ERC20.encodeFunctionData("balanceOf", [vault]) }).then((d) => ERC20.decodeFunctionResult("balanceOf", d)[0]),
    c.maxExtractableNow(),
    c.withdrawalCount(),
    c.changeCount(),
  ]);
  let waiting = 0;
  for (let i = 0n; i < wc; i++) if (Number((await c.getWithdrawal(i)).status) === PENDING) waiting++;
  for (let i = 0n; i < cc; i++) if (Number((await c.getChange(i)).status) === PENDING) waiting++;
  return `${usd(bal)} inside, at most ${usd(max)} can leave right now, ${waiting} request${waiting === 1 ? "" : "s"} waiting.`;
}

// ------------------------------------------------------------------ commands

const HELP =
  "Mora guardian alerts.\n\n" +
  "/watch <vault address> — get a message whenever this vault queues a withdrawal or a rule change\n" +
  "/stop <vault address> — stop alerts for one vault (/stop alone stops all)\n" +
  "/list — vaults you're watching\n\n" +
  "Tip: the vault page has a link that subscribes you in one tap.";

async function handleCommand(provider, s, chat, text) {
  const [cmdRaw, arg = ""] = text.trim().split(/\s+/, 2);
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, "");
  if ((cmd === "/start" || cmd === "/watch") && arg) {
    if (!ethers.isAddress(arg)) return send(chat, `That doesn't look like an address: ${arg}`);
    const vault = ethers.getAddress(arg);
    if (!(await isMoraVault(provider, vault))) return send(chat, `${vault} isn't a Mora vault on Base Sepolia.`);
    if (vaultsOfChat(s, chat).length >= MAX_VAULTS_PER_CHAT && !s.subs[vault]?.includes(chat)) return send(chat, `You can watch up to ${MAX_VAULTS_PER_CHAT} vaults.`);
    s.subs[vault] = [...new Set([...(s.subs[vault] || []), chat])];
    s.rev++;
    return send(chat, `👀 Watching Mora vault ${vault}.\nRight now: ${await summary(provider, vault)}\n\nYou'll get a message here within about 5 minutes of any withdrawal request or rule change, with a link to cancel it.`, vault);
  }
  if (cmd === "/stop") {
    const targets = arg && ethers.isAddress(arg) ? [ethers.getAddress(arg)] : vaultsOfChat(s, chat);
    if (targets.length) unsubscribe(s, chat, targets);
    return send(chat, targets.length ? `Stopped alerts for ${targets.map(short).join(", ")}.` : "You weren't watching any vaults.");
  }
  if (cmd === "/list") {
    const mine = vaultsOfChat(s, chat);
    return send(chat, mine.length ? `You're watching:\n${mine.join("\n")}` : "You aren't watching any vaults yet. Send /watch <vault address>.");
  }
  return send(chat, HELP);
}

// ------------------------------------------------------------------ main

async function main() {
  if (!DRY && !TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set (or run with DRY_RUN=1)");
  const provider = new ethers.JsonRpcProvider(RPC_URL, 84532, { staticNetwork: true });
  const s = loadState();

  if (DRY && process.env.SUBSCRIBE) {
    for (const pair of process.env.SUBSCRIBE.split(",")) {
      const [vault, chat] = pair.split(":");
      s.subs[ethers.getAddress(vault)] = [...new Set([...(s.subs[ethers.getAddress(vault)] || []), Number(chat)])];
    }
    s.rev++;
  }

  // 1. Commands: drain every waiting message, 100 per page, saving after each page.
  let handled = 0;
  for (let page = 0; page < MAX_UPDATE_PAGES; page++) {
    const updates = await tg("getUpdates", { offset: s.offset, limit: 100, timeout: 0, allowed_updates: ["message"] });
    const batch = (updates.ok && updates.result) || [];
    for (const u of batch) {
      s.offset = u.update_id + 1;
      const m = u.message;
      if (!m?.text || m.chat?.type !== "private") continue;
      handled++;
      try {
        await handleCommand(provider, s, m.chat.id, m.text);
      } catch (e) {
        console.warn(`command failed: ${e.message}`);
      }
    }
    if (batch.length) s.rev++;
    saveState(s); // never re-handle commands, even if a later step fails
    if (!batch.length) break; // keep reading until Telegram has nothing left
  }

  // 2. Events
  const latest = await provider.getBlockNumber();
  let from = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : s.lastBlock === null ? latest - FIRST_LOOKBACK : s.lastBlock + 1;
  if (!process.env.START_BLOCK && latest - from > MAX_LOOKBACK) {
    console.warn(`gap of ${latest - from} blocks; skipping to the last ${MAX_LOOKBACK}`);
    from = latest - MAX_LOOKBACK;
  }
  const vaults = Object.keys(s.subs);
  const getLogs = async (filter) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await provider.getLogs(filter);
      } catch (e) {
        if (attempt >= 4) throw e;
        await sleep(attempt * 1500);
      }
    }
  };
  let sent = 0;
  if (vaults.length && from <= latest) {
    for (let start = from; start <= latest; start += CHUNK) {
      const end = Math.min(latest, start + CHUNK - 1);
      const logs = [];
      for (let i = 0; i < vaults.length; i += ADDR_CHUNK) {
        logs.push(...(await getLogs({ address: vaults.slice(i, i + ADDR_CHUNK), topics: [TOPICS], fromBlock: start, toBlock: end })));
      }
      // Chain order, except a rescue reads better before the "queue voided" note it emits first.
      const voided = iface.getEvent("QueueVoided").topicHash;
      const rank = (l) => l.blockNumber * 1e6 + l.transactionIndex * 1e3 + (l.topics[0] === voided ? 999 : l.index);
      logs.sort((x, y) => rank(x) - rank(y));
      for (const log of logs) {
        const ev = iface.parseLog(log);
        const vault = ethers.getAddress(log.address);
        const msg = ev && describe(vault, ev);
        if (!msg) continue;
        for (const chat of s.subs[vault] || []) {
          await send(chat, msg.text, vault);
          sent++;
        }
      }
      s.lastBlock = end;
      saveState(s);
    }
  }
  s.lastBlock = latest;
  for (const chat of gone) unsubscribe(s, chat);
  saveState(s);
  const people = new Set(Object.values(s.subs).flat()).size;
  console.log(
    `handled ${handled} message(s); scanned blocks ${from}..${latest} for ${vaults.length} vault(s); sent ${sent} alert(s); ` +
      `${Object.values(s.subs).flat().length} subscription(s) from ${people} people; removed ${gone.size} unreachable chat(s)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
