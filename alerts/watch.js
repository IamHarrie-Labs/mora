#!/usr/bin/env node
/**
 * Mora guardian alerts.
 *
 * One run = one pass:
 *   1. Read new messages sent to the Telegram bot (/start <vault>, /stop, /list) and update subscriptions.
 *   2. Scan Base Sepolia for events from subscribed vaults since the last run.
 *   3. Message every subscriber, with a link to the vault page where they can cancel or rescue.
 *
 * GitHub Actions runs it every 5 minutes (.github/workflows/guardian-alerts.yml) and keeps the state
 * file in the Actions cache, so no server or database is needed and chat IDs never enter the repo.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN   bot token from @BotFather (required unless DRY_RUN=1)
 *   MORA_APP_URL         public web app URL, e.g. https://mora.vercel.app (links go to Basescan if unset)
 *   STATE_FILE           where state is kept (default alerts/state.json)
 *   RPC_URL              Base Sepolia RPC (default https://sepolia.base.org)
 *   DRY_RUN=1            print messages instead of sending; skip Telegram entirely
 *   SUBSCRIBE            dry-run only: "vault:chatId,..." subscriptions to seed
 *   START_BLOCK          scan from this block instead of the saved position
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const IMPLEMENTATION = process.env.MORA_IMPLEMENTATION || "0x9602447cAaC26C34E9ee0B41a6316032268724ED";
const USDC = (process.env.MORA_USDC || "0x15675CcFBa9E7Ca64fFe64cDD4D8DBc75e219636").toLowerCase();
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "state.json");
const APP_URL = (process.env.MORA_APP_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const DRY = process.env.DRY_RUN === "1";
const EXPLORER = "https://sepolia.basescan.org";

const CHUNK = Number(process.env.LOG_CHUNK || 200); // sepolia.base.org caps eth_getLogs at 200 blocks
const FIRST_LOOKBACK = 300; // ~10 minutes of Base blocks on the very first run
const MAX_LOOKBACK = 7_200; // ~4 hours (2s blocks); older gaps are skipped (e.g. if the cache was evicted)
const MAX_VAULTS_PER_CHAT = 20;

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

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return { offset: s.offset || 0, lastBlock: s.lastBlock ?? null, subs: s.subs || {} };
  } catch {
    return { offset: 0, lastBlock: null, subs: {} };
  }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}
const vaultsOfChat = (s, chat) => Object.keys(s.subs).filter((v) => s.subs[v].includes(chat));

// ------------------------------------------------------------------ telegram

async function tg(method, body) {
  if (DRY) {
    // DRY_MESSAGES="chatId:text|chatId:text" fakes incoming bot messages for testing.
    const fake = method === "getUpdates" && process.env.DRY_MESSAGES ? process.env.DRY_MESSAGES.split("|") : [];
    return {
      ok: true,
      result: fake.map((m, i) => {
        const [chat, ...rest] = m.split(":");
        return { update_id: body.offset + i, message: { chat: { id: Number(chat), type: "private" }, text: rest.join(":") } };
      }),
    };
  }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!j.ok) console.warn(`telegram ${method} failed: ${j.description}`);
  return j;
}

async function send(chat, text, vault) {
  const button = vault ? { reply_markup: { inline_keyboard: [[{ text: APP_URL ? "Open vault: cancel or rescue" : "View vault on Basescan", url: vaultLink(vault) }]] } } : {};
  if (DRY) {
    console.log(`\n--- to chat ${chat} ---\n${text}${vault ? `\n[button → ${vaultLink(vault)}]` : ""}`);
    return;
  }
  await tg("sendMessage", { chat_id: chat, text, disable_web_page_preview: true, ...button });
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
    return send(chat, `👀 Watching Mora vault ${vault}.\nRight now: ${await summary(provider, vault)}\n\nYou'll get a message here within about 5 minutes of any withdrawal request or rule change, with a link to cancel it.`, vault);
  }
  if (cmd === "/stop") {
    const targets = arg && ethers.isAddress(arg) ? [ethers.getAddress(arg)] : vaultsOfChat(s, chat);
    for (const v of targets) {
      s.subs[v] = (s.subs[v] || []).filter((c) => c !== chat);
      if (!s.subs[v].length) delete s.subs[v];
    }
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
  }

  // 1. Commands
  const updates = await tg("getUpdates", { offset: s.offset, timeout: 0, allowed_updates: ["message"] });
  for (const u of updates.result || []) {
    s.offset = u.update_id + 1;
    const m = u.message;
    if (!m?.text || m.chat?.type !== "private") continue;
    try {
      await handleCommand(provider, s, m.chat.id, m.text);
    } catch (e) {
      console.warn(`command failed: ${e.message}`);
    }
  }
  saveState(s); // never re-handle commands, even if the chain scan below fails

  // 2. Events
  const latest = await provider.getBlockNumber();
  let from = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : s.lastBlock === null ? latest - FIRST_LOOKBACK : s.lastBlock + 1;
  if (latest - from > MAX_LOOKBACK) {
    console.warn(`gap of ${latest - from} blocks; skipping to the last ${MAX_LOOKBACK}`);
    from = latest - MAX_LOOKBACK;
  }
  const vaults = Object.keys(s.subs);
  let sent = 0;
  if (vaults.length && from <= latest) {
    for (let start = from; start <= latest; start += CHUNK) {
      const end = Math.min(latest, start + CHUNK - 1);
      const logs = await provider.getLogs({ address: vaults, topics: [TOPICS], fromBlock: start, toBlock: end });
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
  saveState(s);
  console.log(`scanned blocks ${from}..${latest} for ${vaults.length} vault(s); sent ${sent} alert(s); ${Object.values(s.subs).flat().length} subscription(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
