# Guardian alerts (Telegram)

A delay only protects you if someone notices the request in time. `watch.js` messages a vault's guardians
on Telegram within about 5 minutes of any withdrawal request, rule change, freeze or rescue, with a button
that opens the vault page where they can cancel or rescue.

## How it works

- A guardian taps the **Get Telegram alerts** link on the vault page (`t.me/<bot>?start=<vault>`), or sends
  `/watch <vault address>` to the bot. `/list` and `/stop` work too.
- `.github/workflows/guardian-alerts.yml` runs `watch.js` every 5 minutes. Each run reads new bot messages,
  checks that each watched address really is a Mora vault, scans Base Sepolia for that vault's events since
  the last run, and sends the alerts.
- Subscriptions and the last scanned block live in the GitHub Actions cache. No server, no database, and
  chat IDs never enter the repo.
- Anyone can watch any vault. Vault events are public on-chain anyway, so this leaks nothing.

## Setup (about 3 minutes)

1. On Telegram, message **@BotFather**, send `/newbot`, and copy the token it gives you.
2. Add it as a repository secret named `TELEGRAM_BOT_TOKEN`:
   ```bash
   gh secret set TELEGRAM_BOT_TOKEN --repo IamHarrie-Labs/mora
   ```
   (`gh` prompts for the value, so it never lands in your shell history.)
3. Optionally set the web app URL so alert buttons open your vault page instead of Basescan:
   ```bash
   gh variable set MORA_APP_URL --repo IamHarrie-Labs/mora --body https://your-app.vercel.app
   ```
4. In the web app's environment (Vercel), set `NEXT_PUBLIC_ALERT_BOT` to the bot's username (without `@`)
   so vault pages show the subscribe link.
5. Run it once by hand: `gh workflow run guardian-alerts.yml --repo IamHarrie-Labs/mora`.

## Limits

- GitHub runs scheduled workflows on a best-effort basis: usually every 5 minutes, sometimes 10–15 minutes
  late at busy times. That's small next to a vault's delay (at least 1 hour, usually 12), but choose a
  delay with room to react.
- A reply to `/watch` arrives on the next run, not instantly.
- If a run is skipped for more than about 4 hours, older events are not replayed.

## Test locally without Telegram

```bash
DRY_RUN=1 STATE_FILE=/tmp/mora-alerts.json \
  SUBSCRIBE="0x49879021E8C90B25514F3ba03F15a82eb7C44580:1" START_BLOCK=56444272 \
  node alerts/watch.js
```

This prints the alerts the live demo vault's real transactions would have produced. `DRY_MESSAGES="1:/list"`
fakes incoming bot messages.
