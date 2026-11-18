# Last Stand Arena

A round-based minigame mode. Everyone gets a huge walled-off area, builds in creative for a few minutes, then the walls drop, the game switches to survival, and the last player alive wins.

## How a round works

1. **Start.** An operator stands where the arena should be centred and runs `/arena start`. Every online player is assigned a cell in a grid around that spot and teleported into it.
2. **Build phase (5 minutes by default).** Everyone is in creative. You cannot cross the edge of your cell on the X or Z axis, but height is unlimited, so towers and tunnels are fine. You cannot place or break blocks outside your own cell. Portals to other dimensions are blocked. A boss bar counts down.
3. **Borders fall.** Everything you built stays. Your inventory and ender chest are checked: banned items are removed and a few strong items are capped (see below). You switch to survival at full health and hunger.
4. **Survival.** Fight. When you die your items drop, and you become a spectator and can fly around watching.
5. **End.** When one player is left, they are announced as the winner. After 15 seconds everyone is returned to survival at world spawn.

## Disconnecting

If you drop mid-round, your slot is held for 60 seconds. Rejoin in time and you pick up where you were. Miss the window and you are eliminated. The win check counts a disconnected player as still alive until their time runs out, so nobody wins by someone's lag.

## Item rules

Items you make in creative are yours to keep, with limits applied once when the build phase ends:

- **Removed:** command blocks, structure blocks, barriers, bedrock, spawners, spawn eggs, enchanted golden apples, dragon eggs, and a few other creative-only items.
- **Capped:** for example 16 TNT, 8 ender pearls, 2 lava buckets, 1 totem, 1 of each netherite armor piece, 1 netherite sword, 1 elytra.
- Shulker boxes and bundles are checked inside. Chests are checked for banned items the first time they are opened in survival.

The full lists live in the server's `config/laststand-common.toml`. Entries can be an item (`modid:item`), an item tag (`#modid:tag`), or a whole mod (`@modid`).

## Commands (operators only)

| Command | What it does |
|---|---|
| `/arena start [seconds]` | Start a round centred on you. Needs at least 2 players online. |
| `/arena forcestart [seconds]` | Same, but works with one player. Useful for testing. |
| `/arena skipbuild` | Jump straight to the survival phase. |
| `/arena stop` | End the round and return everyone to survival at spawn. |
| `/arena status` | Show phase, time left and who is in or out. |

## Settings

All in `config/laststand-common.toml`: `buildSeconds` (300), `cellSize` (200 blocks), `cellGap` (32 blocks of neutral ground between cells), `reconnectSeconds` (60), `minPlayers` (2), `bannedItems`, `itemCaps`.

## Where it lives

The mod is `my-mods/last-stand/` (Forge 1.20.1). It is server-side only, so friends do not need to install anything.

It is meant for the **"Test new world"** world only. The active world is left alone.

## Not built yet

- **Fresh world per round.** For now the arena is whatever terrain is around the host. Plan: pre-generate a set of arenas or create a new dimension each round.
- **Powerups and tracking.** Tracker compass, glowing, radar and loot crates.
- **Pre-generation.** Cells are big, so flying around in creative generates chunks and can lag. Pre-generating the arena area would fix that.

## Known gaps in the prototype

- A round lives in memory. If the server restarts mid-round, the round is gone and players keep whatever gamemode they had.
- A player who times out while offline keeps their items; they do not drop.
- Liquids, sand and TNT from the build phase are not blocked at the cell edge. The gap between cells is what protects neighbours.
- Hoppers and other automation can move items without a chest being opened, so those items skip the chest check.
- Not yet run in-game with real players. It builds and loads, and the config generates, but the round flow itself is untested.
