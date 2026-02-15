# Agent Onboarding Checklist (Cipher → Onboarding Lead)

This document is the **single source of truth** for bringing a new facility agent online. Atlas’ launch (fully wired everywhere) and Vera’s partial launch (data only → VACANT desk, no card, no quarters) are the reference failures/successes that shaped this checklist. Follow every step in order; skipping any section reproduces Vera’s gaps.

---

## 0. Prep & Naming
- ✅ **Confirm agent codename + role scope** with Flint before touching files.
- ✅ **Pick a unique color + desk item set** that conveys role at a glance (see existing combos in `index.html` L640‑677 and renderers L1139‑1145).
- ✅ **Decide seat & quarters plan first** (pods are finite; rooms/quarters arrays must have space before you wire UI).

---

## 1. Data Layer — `data/agents.json` (L2‑48)
This powers EXP math, rules, and history logging.

1. **Add entry under `"agents"` (L2)** using canonical name as the key:
   ```json
   "Nova": {
     "name": "Nova",
     "level": 1,
     "exp": 0,
     "nextLevel": 500,
     "rank": "Role Title",
     "color": "#HEX",
     "deskItems": ["itemA","itemB"],
     "companion": null | "Name"
   }
   ```
2. **Required fields** (per spec): `name`, `level`, `exp`, `nextLevel`, `rank`, `color`, `deskItems` (array, even if empty), `companion` (string or `null`). Missing any of these will crash frontend renders or leave blank UI stripes (Vera desk bug).
3. **Color discipline:** keep colors unique and WCAG-friendly. Re‑use Harsh orange/blue/cyan palette only when role hierarchy matches.
4. **Rank naming:** match Memory tiers (T1‑T7) so the tier badge logic (card tier map in `index.html` L2390‑2403) works without edits.
5. **Desk items list:** choose from existing draw functions (`drawRadio`, `drawRubberDuck`, etc. at `index.html` L1090‑1160) or spec new art before referencing new ids.
6. **Companion:**
   - If physical pet/bot exists, set to its name (string) and add visuals later (cards & pods read this value).
   - If none, set `null` (don’t omit the key).
7. **History + rules:** No change needed unless onboarding coincides with rule tweak. Keep new agent’s activity logging separate (history array starts L58).

> 🔁 **Double-check:** `nextLevel` should reflect `level * 500` unless custom rule approved. This keeps EXP bars aligned with `expPerLevel` rule (L51‑57).

---

## 2. Status Detection — `server.js`
We only show agents as "working" when the backend knows how to detect them.

### 2.1 Map key → agent (L200‑223)
- Add direct key mapping if the agent has a dedicated OpenClaw session key (e.g., `if (key === 'agent:nova:main') return 'Nova';`).
- Extend the substring checks so `k.includes('nova')` resolves to the new name. This covers ad-hoc subagent sessions and legacy logs.

### 2.2 `getActiveAgentStatus()` bootstrap (L351‑459)
1. **Status object:** add `Nova: false` (line block 352‑358). This is the authoritative list for the UI and `/api/employee-status` output. Forgetting this = VACANT forever.
2. **Session mapping merge:** no code change, but ensure `loadAgentSessionMap` can return your agent (once you add `data/agent-sessions.json`).
3. **Label detection:** in the label block (L410‑435), add `else if (label.includes('nova')) { status.Nova = true; ... }`.
4. **Key-pattern detection:** mirror the same inside the `keyLower` block (L436‑459).
5. **Recent activity map:** use the exact casing when calling `recentlyActive.set('Nova', Date.now())` so downstream timers (cooldowns, meeting lights) work.

### 2.3 Verification steps
- Run `npm run status` (if available) or hit `/api/employee-status` locally to confirm the JSON now includes `"Nova": false` (and flips to `true` when you manually mark the session active).
- Trigger a fake OpenClaw session entry (start + stop) to ensure `recentlyActive` timestamps get set and decay properly.
- Watch `server.log` for `[STATUS]` errors—missing map entries will throw warnings immediately.

---

## 3. Visual – Desk / Pod (Front-end `index.html`)
Goal: the agent must physically appear at a workstation and show their desk items.

1. **Seat availability check**
   - `ROOM_LAYOUT` (L522‑538) defines R&D Lab, Command, Galley, Briefing. Only four pod slots are instantiated (`PODS` builders at L548‑555). Pods indices: 0‑3, left → right.
   - If all pods are spoken for, assign a **custom desk** inside a room with slack:
     - Use `CUSTOM_DESK_POSITIONS` (L632‑635). Add `{ '<Name>': { x, y } }` coordinates relative to the room plan.
     - For galley/briefing lounge overflow, ensure there’s physical clearance from doorways.

2. **Agent config entry** (`const AGENTS = [...]` at L640‑677)
   - Copy existing objects and insert a new block with: `name`, `role`, `color`, `podIndex` (or `null` + custom desk), `deskItems`, `companion`, `status`, `level`, `exp`, `nextLevel`, `expProgress`.
   - Keep `expProgress` in [0,1]; derive from `(exp / nextLevel)` to avoid mismatched bars on first render.
   - Set `status: 'idle'` by default; backend overwrites live.

3. **Desk items rendering**
   - The draw switch lives at L1139‑1145. Only ids listed here will render.
   - If the desk item is new (e.g., `"oscilloscope"`), add a `drawOscilloscope` helper and extend this block **before** referencing it in `deskItems`.

4. **Pod assignment logic**
   - `AgentEntity` constructor (L1750‑1782) uses `podIndex` to pick a pod and auto-place the sprite.
   - Agents without `podIndex` fall back to `CUSTOM_DESK_POSITIONS` (L632‑635), then pod 0. Avoid relying on that fallback—explicitly set either a pod or a custom position so we don’t steal Flint’s seat again.

5. **Meeting locations**
   - If the new agent needs a named seat in meetings, add them to `GALLEY_POSITIONS` (legacy) or rely on `MEETING_LOCATIONS` arrays (L560‑625). Missing entries push them to overlapping coords during all-hands.

> ⚠️ **Vera post-mortem:** She lived in `AGENTS`, but never got a pod/custom position, so `AgentEntity` defaulted her into Flint’s pod visually while the map still showed VACANT. Always define seating.

---

## 4. Visual – Agent Card (`index.html` Status Bar, L2230‑2445)
Each agent occupies one card in the desktop status bar.

1. **Data source:** `entities` is built from `AGENTS` at load (L3609‑3611). If the new agent isn’t in `AGENTS`, cards will never render.
2. **Card layout constants:**
   - `CARD_W = 210`, `CARD_H = 115`, padding/gap defined at L2321‑2335.
   - Cards expect exactly three agents today (see `const AGENT_COUNT = 3`). If onboarding increases count >3, adjust layout spec first (future work: make responsive).
3. **Displayed info:** name, level badge, role, status dot/text, EXP bar, EXP text, tier chip. Provide every field to `AgentEntity` so these populate automatically:
   - `role` feeds the line at L2364 and the tier map at L2390.
   - `level`, `exp`, `nextLevel`, `expProgress` feed L2352‑2386.
   - `status` is updated live from `/api/employee-status`.
4. **Status bar bottom row:** counts of agents/pods (L2487‑2491) pull from `entities.length`, so ensure your addition increments both `AGENTS` and `/api` data to keep numbers aligned.
5. **Companion panel:** if the agent’s `companion` isn’t already in the panel list, add it where companions are composed (`const companions = []` at L3618). Missing companions = blank states.

> 🧮 **Atlas baseline:** Atlas wired `role`, `level`, and `tier` correctly, so his card rendered day one. Mirror that completeness.

---

## 5. Visual – Quarters Level (`index.html` L570‑610 & L1339‑1385)
Agents need living quarters to avoid VACANT callouts on facility tours.

1. **Add room entry** in `const QUARTERS = [...]` (L582‑589):
   - Define `{ agent: 'Nova', label: "NOVA'S QUARTERS", x, y, w: QUARTER_W, h: QUARTER_H, spritePos: { x, y } }`.
   - Use `QUARTERS_ROW2_Y` for overflow. Maintain `QUARTER_GAP` spacing to avoid overlaps.
2. **Furniture + personality** via `drawQuarter` switch (L1348‑1378):
   - Add a new `case 'Nova':` block and compose furniture calls (options already exist: `drawBed`, `drawBookshelf`, `drawServerRack`, `drawMiniFridge`, `drawPlant`, `drawDogBed`, etc.).
   - Personal touches should reflect role (e.g., Atlas = blueprints, Cipher = server rack). No empty rooms.
3. **Sprite placement:** ensure `spritePos` x/y keeps the sprite within room bounds and leaves vertical space for status text (see `drawQuartersOverlay`, L1379‑1407).
4. **Lucky / companions:** if the agent’s companion should appear in quarters, mirror Flint’s Lucky logic in the overlay function.

> 🛏️ **Vera gap:** No quarters entry meant tours still showed only 3 rooms. Add the room + case at the same time as desk wiring.

---

## 6. Session Mapping — `data/agent-sessions.json` (L1‑18)
This file gives the backend a deterministic way to map spawned sessions.

1. **Add object keyed by agent name:**
   ```json
   "Nova": {
     "sessionId": "<uuid-from-session-status>",
     "sessionKey": "agent:nova:main",
     "task": "Short description",
     "startedAt": "2026-02-14T22:04:00.000Z",
     "label": "nova-implementation" // optional but recommended
   }
   ```
   - `sessionId`: copy from `sessions.json` or the OpenClaw relay when you spawn the agent.
   - `sessionKey`: follow `agent:<name>:main` convention so `mapKeyToAgent` can short-circuit (Section 2.1).
   - `label`: even though only Vera currently uses label-only entries (L14‑18), populate it—`getActiveAgentStatus` checks `label.includes('<name>')` first (L410‑435).
2. **Legacy compatibility:** keep existing agents untouched; new entries should not break JSON ordering.
3. **Spawn detection SOAP notes:** Document the label you picked in the spec or MEMORY so future relays reuse identical text (consistency is what the substring check relies on).

---

## 7. Memory Integration — Root `MEMORY.md`
If it’s not in Memory, Flint forgets it next boot. Update two areas.

1. **Team Structure (L52‑108):**
   - Identify the correct tier (1‑7) and append a subsection mirroring existing formatting (`**Name** — Role (Model) — *Status*`).
   - Include desk items, color, and responsibilities bullet list so future specs know how to use the agent.
2. **EXP Table (L140‑159):**
   - Add the row under `| Agent | Level | EXP | Status |` with up-to-date stats from `data/agents.json`.
   - If EXP differs from default (e.g., onboarding a senior hire), explain in a short bullet right below the table.
3. **Additional notes:** if onboarding implies new rules or playbook elements, add them to `Lessons Learned` or `Rules` sections with the date. This keeps Atlas + Forge aware of the change without rereading Git history.

> 🧠 **Reminder:** Memory is only loaded in the main session. Document now so the next reboot doesn’t erase who this agent is.

---

## 8. Final QA Pass
1. **Run `npm run dev` / `npm start`** and load http://localhost:8080. Confirm:
   - Desk sprite is seated (or custom location) with correct items.
   - Status card renders with the right color/role, EXP bar fills.
   - Quarters tile exists with personalized furniture.
2. **Trigger activity:** start a dummy OpenClaw session with the agent label and send one command so `/api/employee-status` flips to `true` and the status dot pulses.
3. **Meeting mode:** toggle `meetingActive = true` (temporary hack in console) to ensure the agent teleports to a valid meeting coordinate.
4. **Companion & counts:** verify the companion panel, agent count, and pod occupancy numbers updated.
5. **Documentation:** link this checklist in the PR/ticket plus jot a one-line summary in `specs/vera-setup-summary.md` if you learned something new.

Following this checklist is the difference between Atlas’ flawless debut and Vera’s VACANT sign. Run it end-to-end every time.
