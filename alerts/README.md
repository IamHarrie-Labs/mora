# Guardian alerts (Telegram)

A delay only protects you if someone notices the request in time. `watch.js` messages everyone watching a
vault on Telegram within about 5 minutes of any withdrawal request, rule change, freeze or rescue, with a
button that opens the vault page where they can cancel or rescue.

## Built for everyone

- **One bot serves everybody.** Anyone can open it and watch any Mora vault: owners, guardians, family.
  Each vault can have any number of watchers, and each person can watch up to 20 vaults.
- **Subscribing:** tap **Get Telegram alerts** on a vault page (`t.me/<bot>?start=<vault>`), or send
  `/watch <vault address>`. `/list` shows what you watch and `/stop` unsubscribes.
- **Only real vaults:** the bot checks on-chain that an address is a Mora vault before accepting it.
- **No data leak:** vault events are public on-chain anyway, so letting anyone watch any vault reveals nothing.

## How it runs

`.github/workflows/guardian-alerts.yml` runs `watch.js` every 5 minutes on GitHub Actions. Each run:

1. Loads the subscriber list from the repo's `alerts-state` branch.
2. Reads **every** waiting bot message, 100 at a time, until none are left, and applies `/watch`, `/stop`, `/list`.
3. Scans Base Sepolia for events from all watched vaults since the last run, 200 blocks and 50 vaults per
   query (the public RPC's limits), retrying on errors.
4. Messages every watcher, paced under Telegram's rate limit and retrying when Telegram asks it to slow down.
   People who blocked the bot are removed automatically.
5. Commits the subscriber list back to `alerts-state`, but only if it changed.

**Where the data lives**

- **Subscribers:** `alerts-state` branch, file `subscribers.enc.json`, encrypted with AES-256-GCM using a
  key derived from the bot token. Nobody can read who watches what without the token, and it survives
  anything: cache resets, failed runs, months of inactivity.
- **Last scanned block:** Actions cache. If it's lost, the next run simply looks back 10 minutes.

Both copies carry a revision number, and the newer one wins on load, so neither a cache reset nor a
failed push can drop subscriptions.

## Setup (about 3 minutes)

1. On Telegram, message **@BotFather**, send `/newbot`, and copy the token it gives you.
2. Add it as a repository secret named `TELEGRAM_BOT_TOKEN`:
   ```bash
   gh secret set TELEGRAM_BOT_TOKEN --repo IamHarrie-Labs/mora
   ```
   (`gh` prompts for the value, so it never lands in your shell history.)
3. Optionally set the web app URL so alert buttons open your vault page instead of Basescan:
   ```bash
   gh variable set MORA_APP_URL --repo IamHarrie-Labs/mora --body https://moravault.vercel.app
   ```
4. In the web app's environment (Vercel), set `NEXT_PUBLIC_ALERT_BOT` to the bot's username (without `@`; defaults to the public bot, `usemora_bot`)
   so vault pages show the subscribe link.
5. Run it once by hand: `gh workflow run guardian-alerts.yml --repo IamHarrie-Labs/mora`.

**Changing the bot token later:** the subscriber list is encrypted with the old token. Before switching,
add the old token as a second secret, `ALERTS_STATE_KEY`, so the list stays readable. If the key is wrong,
the run reports an error and leaves the stored list untouched rather than overwriting it.

## Limits

- GitHub runs scheduled workflows on a best-effort basis: usually every 5 minutes, sometimes 10–15 minutes
  late at busy times. That's small next to a vault's delay (at least 1 hour, usually 12), but choose a
  delay with room to react.
- The reply to `/watch` arrives on the next run, not instantly. Instant replies need a webhook and a
  database; that's on the roadmap.
- If runs stop for more than about 4 hours, older events are not replayed.
- GitHub pauses scheduled workflows in repos with no commits for 60 days. Re-enable it from the Actions tab.

## Test locally without Telegram

```bash
DRY_RUN=1 STATE_FILE=/tmp/mora-alerts.json \
  SUBSCRIBE="0x49879021E8C90B25514F3ba03F15a82eb7C44580:1" START_BLOCK=56444272 \
  node alerts/watch.js
```

This prints the alerts the live demo vault's real transactions would have produced.
`DRY_MESSAGES="1:/list|2:/watch 0x…"` fakes incoming bot messages, `DRY_GONE=2` pretends chat 2 blocked
the bot, and `DURABLE_FILE=/tmp/subs.enc.json ALERTS_STATE_KEY=test` exercises the encrypted store.
