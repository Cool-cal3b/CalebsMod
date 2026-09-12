# Common Hostile Mobs

Field guide for the hostile mobs most likely to appear on the server. Stats,
spawns, and drops reflect the current modpack configuration. Hearts = HP ÷ 2.

## Enemy Expansion (`enemyexpansion` 2.3.1)

### Goblin Thief

| HP | Armor | Melee | Speed |
| --- | --- | --- | --- |
| 20 (10♥) | 5 | 5 (2.5♥) | 0.25 |

- **Spawn:** forest biome tag; weight 20; groups of 1–4.
- **Drops:** player kills can yield 0–1 Bottle o' Enchanting before Looting;
  Looting can add one more.
- **Behavior:** may steal XP and flee after attacking.
- **Combat note:** corner it before committing to a prolonged melee fight.

### Vampire

| HP | Armor | Melee | Speed |
| --- | --- | --- | --- |
| 30 (15♥) | 0 | 6 (3♥) | 0.34 |

- **Spawn:** the general Forge biome tag; weight 20; single spawns.
- **Drops:** 0–2 gunpowder before Looting. A skeleton kill can also trigger the
  standard creeper music-disc table.
- **Configured behavior:** the pack enables vampires exploding from burning and
  gives them a 20% chance to start flying when hurt.
- **Difficulty:** medium—fast and tougher than most common zombies.

### Troll

| Form | HP | Armor | Melee | Speed | Knockback resistance |
| --- | --- | --- | --- | --- | --- |
| Troll | 50 (25♥) | 20 | 10 (5♥) | 0.18 | 1.0 |
| Enraged Troll | 50 (25♥) | 0 | 20 (10♥) | 0.4 | 1.0 |

- **Spawn:** Enemy Expansion's general biome tag; weight 10; single spawns. It
  can therefore appear in caves even though it is not restricted to a cave biome.
- **Enrage:** a hurt Troll has a **20% chance** to turn enraged. The enraged
  form trades its 20 armor for double melee damage and more than twice the
  movement speed.
- **Defence:** the normal form has 20 armor and full knockback resistance, while
  dealing five hearts per hit.
- **Drops:** rotten flesh, bones, spider eyes, and chances at Troll Molars or
  basic tools; some rolls improve with Looting.
- **Combat note:** do not trade hits. Use reach, cover, or ranged damage, and
  create distance immediately if it becomes enraged.

## Cave Stuff (`cave_stuff` 1.06.06)

### Impaled

| HP | Armor | Melee | Speed | Knockback resistance |
| --- | --- | --- | --- | --- |
| 32 (16♥) | 8 | 5 (2.5♥) | 0.25 | 0.5 |

- **Spawn:** Dripstone Caves only; weight 56; groups of 1–2.
- **Drops:** selected across 1–3 rolls, with up to 2 bonus rolls: dripstone
  blocks, pointed dripstone, and rotten flesh.
- **Combat note:** its high armour and knockback resistance make it harder to
  control than an ordinary zombie.

### Kanpotamon

| HP | Armor | Melee | Land / swim speed | Knockback resistance |
| --- | --- | --- | --- | --- |
| 45 (22.5♥) | 8.3 | 5 (2.5♥) | 1.84 / 1.84 | 0.7 |

- **Spawn:** jungle, bamboo jungle, and sparse jungle; weight 86; groups of
  1–3.
- **Drops:** Kanpotamon Claws and Raw Kanpotamon, selected across 1–2 rolls
  with up to 1 bonus roll.
- **Combat note:** do not start a close-range fight without a retreat path.

### Zombie Angler

| HP | Armor | Melee | Speed | Knockback resistance |
| --- | --- | --- | --- | --- |
| 20 (10♥) | 0 | 4 (2♥) | 0.25 | 0.5 |

- **Spawn:** Glowworm Caves only; weight 85; single spawns.
- **Appearance:** blue and glowing, with a burrowing-style animation.
- **Attack:** with its target within 5.5 blocks, it has a 1.8% per-tick chance
  to begin a shooting sequence. After an 11-tick wind-up, it repeatedly fires
  projectiles every 2 ticks.
- **Defence:** ignores arrow damage.
- **Drops:** rotten flesh and glow ink sacs.
- **Combat note:** stay beyond 5.5 blocks or use cover during the wind-up; use
  melee or a non-arrow ranged attack.

## Special Mobs (`specialmobs` 4.1.15)

### Fire Zombie

- **Spawn configuration:** zombies have a 20% base chance to become a special
  variant. Fire Zombies have weight 60 in that variant pool; their weight rises
  in hot, ultrawarm, and warm-ocean conditions.
- **Attributes:** no Fire Zombie-specific overrides are configured, so it uses
  its parent zombie's attributes.
- **Configured defenses:** immune to fire and drowning; continuously damaged
  while wet; immune to poison and regeneration.
- **Equipment:** 5% chance to spawn with a bow, 2% chance to spawn with a shield
  if it did not receive a bow. The bow's configured range is 12 blocks.
- **Combat note:** water is a reliable countermeasure in this pack. A bow or
  shield is possible, not guaranteed.

## Treasure2 (`treasure2` 3.12.1)

### Witherwood Golem

- **Where to find it:** at the base of a generated Wither Tree in the
  Overworld. The tree has dark, dead-looking Witherwood logs, roots, branches,
  and fog.
- **Spawn:** a Great Wither Tree can create a Witherwood Golem as part of its
  world generation.
- **Combat note:** treat the tree as a hostile encounter. Do not linger under
  it, and use range or cover if a golem appears.

## Deadly World (`deadlyworld` 1.20.1-1.1.1)

Each mimic receives the following configured modifiers to its own base
attributes.

| Mimic type | Configured HP change | Speed multiplier | Attack change | Loot table |
| --- | --- | --- | --- | --- |
| Chest | +15 | ×1.0 | +2 | 0–1 Mimic Core |
| Jukebox | +15 | ×1.0 | +2 | one Jukebox |
| Spawner | +15 | ×1.0 | +2 | none |
| Mini Spawner | +10 | ×1.25 | +1.5 | none |

### Chest Mimic and Mimic Cores

- **Trigger:** a chest containing `deadlyworld:mimic_core` becomes a Chest
  Mimic when opened, whether the core was generated as loot or placed by a
  player.
- **Natural core chances:** 10–50% depending on the configured loot table:
  bonus chest 50%; simple dungeon and stronghold corridor 30%; mineshaft,
  ancient city, bastion bridge/treasure, desert pyramid, end city, jungle temple,
  and nether bridge 20%; igloo, ruined portal, and woodland mansion 10%.
- **Practical check:** opening a core chest triggers the mimic. Cores are added
  alongside the chest's normal loot.

### Spawner and Mini Spawner Mimics

- **Trigger:** each configured Deadly World spawner type has a 5% mimic chance;
  a mimic is revealed when that spawner block is broken.
- **Mini-spawner pool:** Mini Zombie (weight 200), Mini Skeleton (100), Mini
  Spider (100), and Mini Creeper (50).
