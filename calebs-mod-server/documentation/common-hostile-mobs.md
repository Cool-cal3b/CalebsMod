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

### Scorpion

| HP | Armor | Melee | Speed | Knockback resistance |
| --- | --- | --- | --- | --- |
| 24 (12♥) | 4 | 5 (2.5♥) | 0.3 | 1.0 |

- **Spawn:** desert biome tag only; weight 100; groups of 1-3.
- **Drops:** a player kill can yield 0-1 Scorpion Tail.
- **Attack:** its melee hits apply Blindness and Invisibility for 6 seconds.
- **Defence:** when hurt, it receives Regeneration and the Sandstorm effect for
  6 seconds.
- **Combat note:** keep it at range if possible. Its full knockback resistance
  makes it difficult to control in close quarters.


## Mo' Creatures: Nostalgia Edition (`mocreatures` 1.0.0)

### Plain Manticore

The flying lion, bat-winged, scorpion-tailed creature is a Plain Manticore.
It is the normal-coloured Manticore variant.

| HP | Armor | Melee | Speed |
| --- | --- | --- | --- |
| 40 (20♥) | 0 | 7 (3.5♥) | 0.4 |

- **Spawn:** weight 2; groups of 1-3; natural monster spawns, so normally at
  night. The active configuration allows it in sandy, mountain, and plains
  biome tags. It can therefore spawn in deserts, but is not limited to them.
- **Flight:** can fly up to 10 blocks above the ground.
- **Tail attack:** each successful hit has a 20% chance to trigger its
  poisoning attack. For the Plain Manticore, the active code applies Blindness
  II for 15 seconds.
- **Drops:** 0-1 Dirt Chitin, 0-2 Hide, and 0-2 Big Cat Claws. A player kill
  has a 7.5% chance to add a Dirt Scorpion Sting, and a 4% chance to add a
  Manticore Egg. Looting can increase the variable-count drops and each rare
  drop chance.
- **Combat note:** avoid fighting directly below it. Keep cover nearby and
  expect the tail attack to disrupt vision.

### Other Manticore Variants

All active variants fly. Their configured locations and core combat stats are:

| Variant | Spawn biome tags | HP | Melee | Speed |
| --- | --- | --- | --- | --- |
| Plain | Sandy, mountain, plains | 40 (20♥) | 7 (3.5♥) | 0.4 |
| Dark | Sandy, mountain, plains | 35 (17.5♥) | 6.5 (3.25♥) | 0.4 |
| Toxic | Dead, spooky | 45 (22.5♥) | 6.5 (3.25♥) | 0.4 |
| Frost | Snowy | 50 (25♥) | 6.5 (3.25♥) | 0.4 |
| Fire | Nether | 50 (25♥) | 7.5 (3.75♥) | 0.4 |

- **Spawn weights:** each listed variant has weight 2 and appears in groups of
  1-3 in its configured biome tags.
- **Variant drops:** each uses the same Hide and Big Cat Claw pools as the
  Plain Manticore, with its own chitin, sting, and egg type. Dark, Toxic,
  Frost, and Fire Manticores also have a 7.5% player-kill chance to drop their
  corresponding heart.

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

| HP | Armor | Melee | Speed | Knockback resistance | Size | XP |
| --- | --- | --- | --- | --- | --- | --- |
| 75 (37.5♥) | 0 | 5–14 (2.5–7♥) | 0.25 | 1.0 | 0.6 × 1.95 blocks | 120 |

- **Where to find it:** at the base of a generated Wither Tree in the
  Overworld. The tree has dark, dead-looking Witherwood logs, roots, branches,
  and fog.
- **Spawn:** a Great Wither Tree can create one during world generation.
- **Targets:** players by default. It also retaliates when hurt and will target
  Iron Golems and zombies.
- **Attack:** normal melee at speed 1.0. Each hit rolls 5–14 damage, then adds
  upward knockback. The target's knockback resistance reduces that launch.
- **Movement:** avoids water and stays within 24 blocks of its tree's home
  position.
- **Drops:** no item loot table is present in the active mod cache, so no item
  drops are configured. Killing one awards 120 XP.
- **Combat note:** do not trade hits. Keep distance, use cover, and expect its
  full knockback resistance to make crowd control ineffective.

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
