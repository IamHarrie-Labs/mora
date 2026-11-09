// The /demo page runs web/src/lib/sim.ts, a TypeScript copy of MoraVault's rules, so judges can play
// without a wallet. This test drives the simulator and the real contract through the same random
// sequences of actions, at the same timestamps, and checks after every step that they agree.
const path = require("path");
const { pathToFileURL } = require("url");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const H = 3600;
const DAY = 86400;
const USD = (n) => BigInt(Math.round(n * 1e6));
const STATUS = ["none", "pending", "executed", "cancelled"];
const SEQUENCES = 30;
const STEPS = 30;

// Small deterministic PRNG so failures are reproducible from the printed seed.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Parity: demo simulator vs MoraVault", function () {
  this.timeout(10 * 60 * 1000);
  let S;

  before(async function () {
    S = await import(pathToFileURL(path.join(__dirname, "../web/src/lib/sim.ts")).href);
  });

  for (let seed = 1; seed <= SEQUENCES; seed++) {
    it(`random sequence #${seed} matches step by step`, async function () {
      const rand = rng(seed * 7919);
      const pick = (arr) => arr[Math.floor(rand() * arr.length)];
      const [owner, guardian, recovery, payeeA, payeeB, thief] = await ethers.getSigners();

      const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
      const factory = await (await ethers.getContractFactory("MoraFactory")).deploy(await usdc.getAddress());
      const rules = { dailyLimit: 200, delay: 12 * H, curfewStart: 22 * 60, curfewEnd: 7 * 60 };

      // Start on a future UTC midnight plus a random time of day.
      let now = (Math.floor((await time.latest()) / DAY) + 2) * DAY + Math.floor(rand() * DAY);
      await time.setNextBlockTimestamp(now);
      const rc = await (
        await factory.createVault(recovery.address, { ...rules, dailyLimit: USD(rules.dailyLimit) }, [guardian.address])
      ).wait();
      const ev = rc.logs.map((l) => factory.interface.parseLog(l)).find((e) => e && e.name === "VaultCreated");
      const vault = await ethers.getContractAt("MoraVault", ev.args.vault);
      const vaultAddr = await vault.getAddress();
      await time.setNextBlockTimestamp(now);
      await usdc.mint(vaultAddr, USD(10_000));

      let v = {
        ...S.demoVault(),
        now,
        balance: 10_000,
        usedAt: now,
        rules: { ...rules },
        recovery: recovery.address,
        log: [],
      };

      // Every contract call happens at the simulator's clock.
      const send = async (fn) => {
        await time.setNextBlockTimestamp(now);
        try {
          await (await fn()).wait();
          return true;
        } catch {
          return false;
        }
      };

      const trail = [];
      const check = async () => {
        const where = `seed ${seed}, after: ${trail.join(" → ")}`;
        expect(Number(await usdc.balanceOf(vaultAddr)) / 1e6, `balance (${where})`).to.be.closeTo(v.balance, 1e-6);
        expect(await vault.recovery(), `recovery (${where})`).to.equal(v.recovery);
        expect(Number((await vault.rules()).dailyLimit) / 1e6, `dailyLimit (${where})`).to.equal(v.rules.dailyLimit);
        expect(Number(await vault.withdrawalCount()), `withdrawal count (${where})`).to.equal(v.withdrawals.length);
        for (const w of v.withdrawals) {
          const c = await vault.getWithdrawal(w.id);
          expect(STATUS[Number(c.status)], `withdrawal ${w.id} status (${where})`).to.equal(w.status);
          expect(Number(c.unlockAt), `withdrawal ${w.id} unlockAt (${where})`).to.equal(w.unlockAt);
        }
        expect(Number(await vault.changeCount()), `change count (${where})`).to.equal(v.changes.length);
        for (const ch of v.changes) {
          const c = await vault.getChange(ch.id);
          expect(STATUS[Number(c.status)], `change ${ch.id} status (${where})`).to.equal(ch.status);
          expect(Number(c.readyAt), `change ${ch.id} readyAt (${where})`).to.equal(ch.readyAt);
        }
        // maxExtractableNow is a view evaluated at the next block; mine one at the sim's clock first.
        await time.setNextBlockTimestamp(now);
        await ethers.provider.send("evm_mine", []);
        expect(Number(await vault.maxExtractableNow()) / 1e6, `maxExtractableNow (${where})`).to.be.closeTo(S.maxExtractableNow(v), 0.01);
      };

      const actions = {
        async withdraw() {
          const to = pick([payeeA, payeeB, thief]).address;
          const amount = pick([1, 25, 50, 120, 199, 200, 201, 500, 3_000, 12_000]);
          trail.push(`withdraw ${amount}`);
          v = S.withdraw(v, to, amount, "owner");
          await send(() => vault.connect(owner).withdraw(to, USD(amount)));
        },
        async cancel() {
          if (!v.withdrawals.length) return;
          const id = pick(v.withdrawals).id;
          trail.push(`cancel w${id}`);
          v = S.cancel(v, id);
          await send(() => vault.connect(guardian).cancel(id));
        },
        async freeze() {
          const secs = pick([H, 6 * H, 3 * DAY]);
          trail.push(`freeze ${secs / H}h`);
          v = S.freeze(v, secs);
          await send(() => vault.connect(guardian).freeze(secs));
        },
        async rescue() {
          trail.push("rescue");
          v = S.rescue(v);
          await send(() => vault.connect(guardian).rescue(usdc.getAddress()));
        },
        async deposit() {
          const amount = pick([100, 1_000, 5_000]);
          trail.push(`deposit ${amount}`);
          v = { ...v, balance: v.balance + amount };
          await send(() => usdc.mint(vaultAddr, USD(amount)));
        },
        async loosen() {
          const next = pick([
            { dailyLimit: 1_000, delay: 2 * H, curfewStart: 0, curfewEnd: 0 },
            { dailyLimit: 500, delay: 6 * H, curfewStart: 23 * 60, curfewEnd: 6 * 60 },
            { dailyLimit: 300, delay: 12 * H, curfewStart: 1 * 60, curfewEnd: 5 * 60 + 30 },
          ]);
          trail.push(`propose rules ${next.dailyLimit}`);
          v = S.proposeChange(v, "rules", "change rules", (s) => void (s.rules = { ...next }), "owner");
          await send(() => vault.connect(owner).proposeRules({ ...next, dailyLimit: USD(next.dailyLimit) }));
        },
        async proposeRecovery() {
          const to = pick([thief, payeeA]).address;
          trail.push("propose recovery");
          v = S.proposeChange(v, "recovery", "change recovery", (s) => void (s.recovery = to), "owner");
          await send(() => vault.connect(owner).proposeRecovery(to));
        },
        async cancelChange() {
          if (!v.changes.length) return;
          const id = pick(v.changes).id;
          trail.push(`cancel c${id}`);
          v = S.cancelChange(v, id);
          await send(() => vault.connect(guardian).cancelChange(id));
        },
        async wait() {
          const secs = pick([60, 17 * 60, 2 * H, 5 * H + 13 * 60, 12 * H, 13 * H, DAY + 7]);
          trail.push(`wait ${Math.round(secs / 60)}m`);
          now += secs;
          // The simulator's advanceTo acts as a keeper: execute ready withdrawals, then apply ready changes.
          v = S.advanceTo(v, now);
          for (let id = 0; id < Number(await vault.withdrawalCount()); id++) await send(() => vault.execute(id));
          for (let id = 0; id < Number(await vault.changeCount()); id++) await send(() => vault.applyChange(id));
        },
      };
      const weights = [
        ["withdraw", 5], ["wait", 5], ["cancel", 2], ["cancelChange", 2], ["loosen", 2],
        ["proposeRecovery", 2], ["deposit", 1], ["freeze", 1], ["rescue", 1],
      ];
      const bag = weights.flatMap(([k, n]) => Array(n).fill(k));

      await check();
      for (let step = 0; step < STEPS; step++) {
        await actions[pick(bag)]();
        await check();
      }
    });
  }
});
