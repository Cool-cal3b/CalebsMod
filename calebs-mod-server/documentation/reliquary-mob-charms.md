# Reliquary Mob Charms

`Charm Fragment` in JEI is Reliquary's **`mob_charm_fragment`** ("Zombie Charm
Fragment", "Creeper Charm Fragment", …). Each fragment is stamped with one mob
type and is a crafting stepping-stone toward that mob's **Mob Charm**. Values
below were read from the mod jar and this server's config.

## What a Mob Charm does

While a Mob Charm is **anywhere in your main inventory** (or inside a Charm Belt
that's in your inventory), that mob type **will not target you — even if you hit
it first**. It's permanent aggro immunity to a whole mob species.

| Stat | Value (this server) |
| --- | --- |
| Durability | 80 |
| Durability lost per kill of the charmed mob | 1 |
| Durability restored per repair item | 20 |
| Charms shown in HUD | up to 6 (right side) |
| Pedestal protection range | 21 blocks |
| Blocked mobs (no charm possible) | Ender Dragon, Wither |

So a fresh charm lasts ~80 kills of that mob, or **forever if you avoid killing
them** (walking past does no damage). Repair a worn charm on a crafting grid with
that mob's special drop (Rib Bone, Zombie Heart, Chelicerae, …), +20 each.

## Getting fragments

Two paths:

1. **Direct drop** — mobs *without* a craftable fragment recipe drop the fragment
   themselves at **~1.67%**, +0.83% per Looting level.
2. **Craft it** — 14 mob types have a shaped recipe built around that mob's
   Reliquary special drop plus vanilla bits:

| Mob | Key ingredient (Reliquary special drop) |
| --- | --- |
| Blaze | Molten Core (+ blaze powder) |
| Cave Spider | Chelicerae (+ potion) |
| Creeper | Catalyzing Gland (+ bone) |
| Enderman | Nebulous Heart |
| Ghast | Catalyzing Gland (+ ghast tear) |
| Guardian | Guardian Spike (+ cod) |
| Magma Cube | Molten Core (+ magma cream) |
| Skeleton | Rib Bone (+ bone, flint) |
| Slime | Slime Pearl |
| Spider | Chelicerae (+ spider eye) |
| Witch | Witch Hat (+ glass bottle, spider eye) |
| Wither Skeleton | Withered Rib (+ bone, skull) |
| Zombie | Zombie Heart (+ bone, rotten flesh) |
| Zombified Piglin | Zombie Heart (+ golden sword, rotten flesh) |

## Fragments → Charm → Belt

- **Mob Charm:** 6 fragments **of the same mob** + 1 leather + 1 string.
  Pattern `FLF / FSF / F F`. All six must match; the charm is stamped with that mob.
- **Mob Charm Belt:** 5 fragments + 3 leather (`LLL / F F / FFF`). Holds every mob
  charm; they work the same from inside it. One belt in your inventory = carry
  your whole collection.

## Which charms are worth it

| Priority | Charm | Why |
| --- | --- | --- |
| High | Creeper | walk through creeper-infested areas with zero risk of a blast |
| High | Blaze / Ghast | trivializes Nether fortress and basalt-delta travel |
| Medium | Enderman | mine/look around freely without provoking endermen |
| Medium | Skeleton / Zombie | cheap to craft, big quality-of-life on the surface at night |
| Low | Slime / Cave Spider / Witch | niche; only if that mob is a specific nuisance to you |

**Verdict: genuinely strong.** Low upkeep for permanent immunity. The Creeper and
Nether charms alone justify farming the fragments. Build the Charm Belt early so
you're not juggling charms in your hotbar.
