# NEON DAEMON

A neon bar where you hang out with friends while your Claude Code agents work. Your agents show up as little drones: they sit at the desks while they work, fly over when they need you, and grab a drink at the bar when the job is done.

**Play:** https://gianco99.github.io/neon-daemon/

## Get in

1. Open the site and register with a handle, email and password.
2. Add your friends by handle in the **Friends** panel.
3. Walk into a public bar, or open your own. Private bars come with an invite link that contains the key; send it to friends privately.

## Bring your agents

You need Claude Code 2.1.308 or newer (the desktop app already is).

1. In Claude Code, install the plugin:

   ```
   /plugin install neon-daemon --marketplace Gianco99/neon-daemon
   ```

   If that doesn't work on your version, use `/plugin marketplace add Gianco99/neon-daemon` and then `/plugin install neon-daemon@neon-daemon`.

2. On the site, click 🔗 **Link Claude Code**, get a pairing code, and paste the `/neon link …` line it gives you into Claude Code.
3. Start a task. Your drone heads for a desk.

Handy commands: `/neon status`, `/neon label <text>` (a name over your drone), `/neon tools on` (show which tool is running), `/neon pause`, `/neon resume`.

Once linked, you can also sign in to the site from Claude Code: pick the **Claude Code** tab on the login screen and run the `/neon approve <code>` it shows. Only approve codes you see on your own screen.

## In the bar

- **Walk:** click the floor.
- **Darts:** click the dartboard. Hold to steady your aim, release to throw.
- **Jukebox:** click it, or use ▶ in the top bar to play or pause. Five original tracks, generated in your browser.
- **Bet booth:** bet chips on how long a friend's agent takes. Betting closes 60 seconds into a job. FLASH (under 1 min), GRIND (1 to 5 min) and MARATHON (over 5 min) pay 3×; ASKS YOU and CLEAN RUN (whether it needs a permission) pay 2×.
- **The bar:** click the counter to order a drink.
- **Emotes:** the buttons under the bar, or type `/wave`, `/dance`, `/cheer` in chat.

## Chips

| Way to earn | Chips |
| --- | --- |
| Your agent finishes a job (15 s or longer) | +10, up to 20 jobs a day |
| Hanging out in a bar | +5 every 10 minutes, up to 12 times a day |
| Daily streak | +50 on your first visit each day, +10 more per day in a row (up to +150) |
| Darts | +1 per 10 points, up to 50 a day |
| Bet booth | 3× or 2× your bet |

The **Top** tab ranks everyone in the bar by jobs shipped this week.

Everyone starts with a black daemon in a cap and leather jacket. Spend chips in the 🎨 **wardrobe** to unlock colors, eyes, hats, fits and accessories for yourself, and colors and styles for your drone. Tap anything to try it on before buying.

## Drinks

A drink gives you a glow everyone can see and a perk while it lasts. One at a time.

| Drink | Price | Effect | Lasts |
| --- | --- | --- | --- |
| 🥤 Synth Soda | 15 | Sugar Rush: rainbow aura, you can't stop dancing | 10 min |
| ☕ Espresso Tonic | 20 | Wired: walk 80% faster | 10 min |
| 🍍 Piña Colada | 25 | Island Time: hanging out pays double | 20 min |
| 🍸 Neon Martini | 30 | Steady Hand: darts aim wobbles 60% less | 10 min |
| 🍶 Hot Sake | 30 | Liquid Courage: your last dart scores double | 10 min |
| 🌿 Mojito | 35 | Fresh Start: finished jobs pay double | 30 min |
| 🍹 Blue Lagoon | 40 | Lucky Streak: winning bets pay 50% more | 15 min |

## Privacy

- The plugin only sends your agent's state (working, needs you, chilling), a random session id, and a label or tool name if you turn those on. Never prompts, code, file paths or tool inputs. It never calls the model, so it costs zero tokens.
- Private bar chat is end-to-end encrypted in your browser with a key derived from the invite. The server only stores ciphertext and never sees the key.
- Passwords are handled by Supabase Auth. Every table is locked down with row-level security.

## Run your own

The site is static (`docs/`), the backend is Supabase (`supabase/`), and the Claude Code plugin lives in `plugin/`.

**Locally (demo mode):** with no Supabase settings in `docs/config.js`, or with `?demo` in the URL, everything runs in your browser with NPC friends and simulated agents.

```bash
python3 -m http.server 8787 --directory docs
```

Then open http://localhost:8787/?demo.

**Your own deployment:**

1. Fork the repo and turn on GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/docs`.
2. Create a Supabase project. In the SQL Editor, run all of `supabase/schema.sql`.
3. In Supabase Authentication, turn off "Confirm email" (or add SMTP), set the Site URL to your Pages URL, and add it to Redirect URLs.
4. Put your project URL, publishable key and `owner/repo` in `docs/config.js`.
5. Optional, for signing in from Claude Code: deploy `supabase/functions/claude-login` as an Edge Function with JWT verification turned off (`supabase functions deploy claude-login --no-verify-jwt`).
