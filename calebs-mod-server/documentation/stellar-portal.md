# Stellar Portal (Aerial Hell)

How to build and light a portal to the **Aerial Hell** dimension. All values
read straight out of `aerialhell-0.7.0.1_forge1.20.1.jar` (class files + data).

The portal is a Nether-style frame: a flat vertical rectangle of one specific
block, lit from the inside with one specific item. Vanilla flint & steel does
**not** work — only the **Stellar Lighter** can ignite it.

## The two things you need

| Thing | What it is | Where it comes from |
| --- | --- | --- |
| **Stellar Portal Frame** blocks | `aerialhell:stellar_portal_frame_block` — "Stellar Portal Frame" | Smelt **Stellar Debris**, then craft (below). Or harvest a ruined frame from an Abandoned Portal. |
| **Stellar Lighter** | `aerialhell:stellar_lighter` — one-hand item, 4 uses, rarity "Corrupted" | Guaranteed in the chest of an **Abandoned Portal** structure. Craftable, but only from Aerial Hell materials (chicken-and-egg — see below). |

### First trip: find an Abandoned Portal

`aerialhell:overworld_abandonned_portal` — a small ruined portal on a floating
cloud island.

- **Where:** most overworld biome categories (badlands, beach, deep ocean,
  forest, hill, jungle, mountain, ocean, river, taiga) **and the Nether**.
- **Height:** Y 160–250, floating in the sky. Look up.
- **Spread:** `random_spread`, spacing 50 chunks / separation 25 chunks
  (salt 166754456). Roughly one per ~800×800 blocks.
- **Contents:** a stone-and-cobble ruin with an **incomplete** Stellar Portal
  Frame (9–10 frame blocks placed out of the 10 a minimum portal needs — you
  always have to patch it), a Fluorite Lantern, and one chest.
- **Chest loot:** exactly **1 Stellar Lighter** (guaranteed), plus 2 rolls of
  {3–6 iron ingots | 2–4 gold ingots | 4–6 White Solid Ether Fragment}.

So the intended path is: find one of these, grab the free lighter, top up the
ruined frame with a few of your own frame blocks, and light it. After that you
can farm Stellar Debris at home and build portals wherever you want.

## Getting frame blocks the normal way

### 1. Mine Stellar Debris

`aerialhell:stellar_portal_frame_ore` / `aerialhell:deepslate_stellar_portal_frame_ore`
— both are named **"Stellar Debris"** in-game.

- **Dimension:** the **Overworld** (feature is added to every
  `#minecraft:is_overworld` biome, step `underground_ores`).
- **Height:** Y **−64 to −55** only — a thin band right above bedrock,
  trapezoid distribution (most common around Y −59/−60).
- **Amount:** 4 vein attempts per chunk, vein size 5, no air-exposure discard.
- **Tool:** any **pickaxe** (tagged `mineable/pickaxe` + `needs_aerial_wood_tool`,
  which is mining level 0 — a wooden pick is enough). Drops the ore block
  itself, no Fortune/Silk interaction, so 1 ore block per ore mined.
- Collecting one pops the hidden advancement **"What is that?"**.

### 2. Smelt and craft

| Step | Recipe | Notes |
| --- | --- | --- |
| Stellar Debris → **Stellar Portal Bricks** (`stellar_portal_frame_brick`) | Furnace smelt (400 t / 20 s) or blast furnace (200 t) | 2.5 XP. 1 ore → 1 brick. |
| 4 × Stellar Portal Bricks → **1 Stellar Portal Frame** block | Shaped 2×2 | — |

**Minimum portal cost:** 10 frame blocks = 40 bricks = **40 Stellar Debris**.

## Frame shape

Identical rules to a Nether portal. The **interior** (the air the portal
blocks fill) must be:

- **width** 2–21 blocks
- **height** 3–21 blocks

So the smallest portal is a **4×5 outer rectangle** (2×3 interior); the largest
is **23×23 outer** (21×21 interior).

```
      ▓ ▓            ▓ = Stellar Portal Frame block  (10 for the minimum size)
    ▓ · · ▓          · = interior (must be air when you light it)
    ▓ · · ▓          space = corner: NOT checked, leave it air or anything
    ▓ · · ▓
      ▓ ▓
```

Rules the game actually enforces (`AerialHellPortalBlock$Size`):

- Every block of the frame's four sides must be **`stellar_portal_frame_block`**
  exactly. Bricks, Stellar Stone, etc. do **not** count.
- The **four corners are ignored** — fill them or don't.
- The interior must be **completely empty** (air) before lighting. Any block in
  it — even a single one — makes the frame invalid. An already-lit portal
  block also counts as "occupied", so you can't re-light a running portal.
- The frame must be a single flat plane on the **X or Z axis** (vertical,
  like a doorway). If a spot is ambiguous the game picks the **X axis**
  (east–west) first.
- Search limits: it looks up to 21 blocks up, 21 across, and 21 down from the
  spot you light, so oversized or malformed frames just read as invalid.

## Lighting it

Hold the **Stellar Lighter** and **right-click the top face of a bottom-row
frame block** (i.e. click into the inside-bottom of the frame). The lighter
checks the air block directly above and below the block you clicked and tries
to form a portal there.

- On success: portal blocks fill the interior, the lighter takes **1 durability**
  (4 lights per lighter), and you get a **50-tick (2.5 s) item cooldown**.
- Wrong shape / blocked interior / not a frame block: nothing happens, no
  durability lost.
- A Forge `PortalSpawnEvent` fires and can be cancelled by other mods; nothing
  in this pack does.

## Travelling through

Standing in the portal blocks:

1. You get the **"Portal"** effect (`aerial_hell_portal`), 120 ticks / 6 s.
2. Once you've been in continuously long enough that the effect has **< 20 ticks
   left** (~5 s of exposure), you're teleported.
3. After arrival you get **"Portal Cooldown"** (`aerial_hell_portal_cooldown`),
   110 ticks / 5.5 s — re-entering a portal during this window just refreshes
   the cooldown instead of sending you back.
4. Creative-mode players teleport instantly with no effect. Non-living entities
   (dropped items, etc.) teleport instantly.

**Destinations:**

- From **Aerial Hell** → the **Overworld**.
- From **anywhere else** (Overworld, Nether, …) → **Aerial Hell**
  (`aerialhell:aerial_hell`).
- The teleporter looks for an existing portal within **64 blocks** of the
  scaled destination and reuses it; otherwise it builds a fresh minimum-size
  Stellar Portal frame for you (vanilla-style).

**Coordinate scale:** Aerial Hell's `coordinate_scale` is **0.125**. Entering
Aerial Hell **multiplies** your X/Z by 8 (returning divides by 8) — the
opposite of the Nether. Aerial Hell is *not* a fast-travel shortcut: covering
Overworld distance means walking 8× as far up there.

Dimension facts: has skylight, no ceiling, natural, beds and respawn anchors
work, no raids, build range Y 0–271 (`logical_height` 272).

## Quick reference

| Property | Value |
| --- | --- |
| Frame block | `aerialhell:stellar_portal_frame_block` |
| Igniter | `aerialhell:stellar_lighter` (4 uses) |
| Igniter recipe | shapeless: `aerialhell:fluorite` + `aerialhell:ruby` |
| Interior size | 2–21 wide × 3–21 tall |
| Min frame blocks | 10 (corners optional) |
| Ore | "Stellar Debris", Overworld, Y −64…−55, any pickaxe |
| Ore → brick | smelt (20 s) or blast (10 s), 2.5 XP |
| Bricks → frame block | 4 bricks (2×2) → 1 |
| Exposure to teleport | ~5 s standing in portal |
| Post-teleport cooldown | 5.5 s |
| Found structure | `aerialhell:overworld_abandonned_portal`, sky Y 160–250, chest has a free lighter |

### Note on crafting your own lighter

`fluorite` and `ruby` only come from **Fluorite Ore** and **Ruby Ore**, which
generate **only inside Aerial Hell**. Worse, Ruby Ore in a normal furnace gives
useless **Overheated Ruby** — the `ruby` gem needs an **Oscillator**
(`aerialhell:oscillator`, crafted from 8 Stellar Stone + 1 Fluorite). So you
cannot craft a Stellar Lighter before your first visit. Use a found Abandoned
Portal's chest lighter (or creative) to get in the first time.
