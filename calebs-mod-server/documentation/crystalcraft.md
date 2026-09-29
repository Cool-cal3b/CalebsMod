# Crystalcraft: ore, tool & armor reference

Every material added by **Rebalanced Crystalcraft Unlimited 1.20.1** (`...princess fix.jar`), with vanilla tools and armor listed alongside for comparison. Values were read straight out of the mod's compiled classes.

## How to read the tables

**Pick lvl** — the pickaxe's mining/harvest level. Vanilla: wood & gold = 0, stone = 1, iron = 2, diamond = 3, netherite = 4. This mod does **not** register its tiers with Forge's tier-sorting system, so only this raw number decides what a pickaxe may break, compared the vanilla way. Numbers above 3 (10, 20, 70, 1000…) behave identically to diamond/netherite — no vanilla block asks for more.

**Can mine** — shorthand for what the pickaxe is allowed to break:


| Code      | Meaning                                                                                  | Needs (vanilla)   |
| --------- | ---------------------------------------------------------------------------------------- | ----------------- |
| `All`     | every vanilla block, including obsidian, crying obsidian, respawn anchor, ancient debris | diamond level (3) |
| `Diamond` | up to diamond / gold / redstone / emerald ore — **not** obsidian or ancient debris       | iron level (2)    |
| `Iron`    | up to iron / copper / lapis ore — **not** diamond ore                                    | stone level (1)   |
| `Stone`   | stone, coal — **not** iron ore                                                           | wood level (0)    |


**Pick speed** — mining speed. Vanilla: wood 2, stone 4, iron 6, diamond 8, netherite 9, gold 12. Higher is faster.

**Dur.** — durability / number of uses. Vanilla: gold 32, wood 59, stone 131, iron 250, diamond 1561, netherite 2031. In this mod each tool type of a material can have its own durability, so pickaxe / sword / axe are listed separately.

**Sword dmg / Axe dmg** — total melee attack damage, including the 1.0 base every hit starts with (so a vanilla diamond sword reads 7, a netherite axe 10). Swords swing at the vanilla rate; axes are slower.

**†** = this material's "sword" is really a *Blade* class (different balance / effect). **—** = the mod has no such tool for that material.

## Vanilla reference


| Material      | Pick lvl | Can mine  | Pick speed | Dur. | Sword dmg | Axe dmg |
| ------------- | -------- | --------- | ---------- | ---- | --------- | ------- |
| **Wood**      | 0        | `Stone`   | 2          | 59   | 4         | 7       |
| **Gold**      | 0        | `Stone`   | 12         | 32   | 4         | 7       |
| **Stone**     | 1        | `Iron`    | 4          | 131  | 5         | 9       |
| **Iron**      | 2        | `Diamond` | 6          | 250  | 6         | 9       |
| **Diamond**   | 3        | `All`     | 8          | 1561 | 7         | 9       |
| **Netherite** | 4        | `All`     | 9          | 2031 | 8         | 10      |




## All Crystalcraft materials (228)

Alphabetical. `—` means the mod doesn't add that tool for the material.


| Material               | Pick lvl | Can mine  | Pick speed | Pick dur. | Sword dmg | Sword dur. | Axe dmg | Axe dur. |
| ---------------------- | -------- | --------- | ---------- | --------- | --------- | ---------- | ------- | -------- |
| Adamantite             | 10       | `All`     | 100        | 4207      | 19        | 4207       | 19      | 4207     |
| Adamantite + Mythril   | 10       | `All`     | 100        | 4207      | —         | —          | 25.4    | 4207     |
| Alexandrite            | 4        | `All`     | 9          | 4207      | 12.5      | 1600       | 13.2    | 1600     |
| Aluminium              | 8        | `All`     | 15         | 4207      | 11.2      | 3260       | 10.3    | 4207     |
| Amazonite              | 4        | `All`     | 10         | 4207      | 11.7      | 1600       | 13.2    | 1600     |
| Amber                  | 4        | `All`     | 19.5       | 4207      | 10.3      | 1600       | 11.2    | 1600     |
| Americium              | 8        | `All`     | 15         | 4207      | 8.3       | 1600       | 11.2    | 4207     |
| Amethyst               | 8        | `All`     | 15         | 4207      | 12.1      | 4207       | 12.8    | 1600     |
| Amethyst Crystal       | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Ametrine               | 4        | `All`     | 15         | 4207      | 13.5      | 1600       | 10.3    | 1600     |
| Ammolite               | 8        | `All`     | 15         | 4207      | 12.6      | 3260       | 13.2    | 4207     |
| Angerite               | 4        | `All`     | 7          | 4207      | 20.8      | 3260       | 21.2    | 4207     |
| Anti-Humoranium        | 20       | `All`     | 169        | 4207      | 21.7      | 3260       | 15.5    | 4207     |
| Antimony               | 4        | `All`     | 7          | 1600      | 13.4      | 1600       | 13.6    | 1600     |
| Aqua Sapphire          | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Aquamarine             | 4        | `All`     | 11         | 4207      | 12.8      | 1600       | 13.2    | 1600     |
| Aura Quartz            | 4        | `All`     | 19         | 1600      | 7.45      | 1600       | 7.97    | 1600     |
| Australian Sapphire    | 8        | `All`     | 15         | 4207      | 13.5      | 3260       | 13.5    | 4207     |
| Azurite                | 8        | `All`     | 15         | 4207      | 10.5      | 3260       | 11.5    | 4207     |
| Bismuth                | 8        | `All`     | 15         | 4207      | 11.2      | 1600       | 10.3    | 4207     |
| Bixbite                | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 15.3    | 4207     |
| Black Catseye          | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Black Diamond          | 8        | `All`     | 15         | 4207      | —         | —          | —       | —        |
| Black Opal             | 8        | `All`     | 15         | 4207      | 14.1      | 1600       | 14.1    | 4207     |
| Black Pearl            | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Blackstone             | 10       | `All`     | 35         | 4207      | 23.9      | 1600       | 12.8    | 4207     |
| Blood Quartz           | 4        | `All`     | 20         | 4207      | 15.5      | 3260       | 15.3    | 4207     |
| Bloodstone             | 8        | `All`     | 15         | 4207      | 12.8      | 1600       | 12.8    | 4207     |
| Blue Catseye           | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | —       | —        |
| Blue Pearl             | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Bluestone              | 10       | `All`     | 35         | 4207      | 13.2      | 1600       | 12.8    | 4207     |
| Brass                  | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Brickerite             | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Bronze                 | 8        | `All`     | 15         | 4207      | 5         | 1600       | 8.3     | 1600     |
| Brown Diamond          | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Brown Pearl            | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Cadmium                | 10       | `All`     | 16         | 1600      | 12.5      | 1600       | 12.5    | 1600     |
| Calcium                | 6        | `All`     | 20         | 1600      | 13.1      | 1600       | 13.2    | 1600     |
| Carnotite              | 10       | `All`     | 100        | 1600      | 14.8      | 1600       | 14.9    | 1600     |
| Catseye                | 4        | `All`     | 20         | 4207      | 12.8      | 3260       | 13.5    | 4207     |
| Chalcanthite           | 4        | `All`     | 7          | 4207      | 15.8      | 3260       | 16.3    | 4207     |
| Chloronium             | 10       | `All`     | 35         | 4207      | 16.8      | 3260       | 17.3    | 4207     |
| Chrome                 | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Chrysolite             | 4        | `All`     | 13         | 4207      | 11.2      | 1600       | 12.1    | 1600     |
| Cinnabar               | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Citrine                | 4        | `All`     | 9          | 4207      | 10.3      | 1600       | 11.2    | 1600     |
| Cobalt                 | 10       | `All`     | 100        | 4207      | 22.5      | 1600       | 15.5    | 4207     |
| Copper                 | 10       | `All`     | 35         | 200       | 7.4       | 200        | 8.3     | 200      |
| Crimson Gold           | 4        | `All`     | 20         | 4207      | 11.2      | 1600       | 12.1    | 1600     |
| Crystal                | 7        | `All`     | 17         | 4207      | 14.1      | 1600       | 14.7    | 1600     |
| Cupronickel            | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 11.2    | 4207     |
| Cyan Emerald           | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Dark Blue Diamond      | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Dark Blue Pearl        | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Draconic               | 10       | `All`     | 100        | 4207      | —         | —          | —       | —        |
| Dragon Scale           | 5        | `All`     | 20.5       | 4207      | 19        | 1600       | 19.3    | 1600     |
| Echo                   | 10       | `All`     | 35         | 4207      | 13.8      | 3260       | 12.8    | 4207     |
| Eclipse Diamond        | 8        | `All`     | 15         | 4207      | 19        | 1600       | 19      | 4207     |
| Electrum               | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Emerald                | 10       | `All`     | 35         | 500       | 8.3       | 500        | 9.1     | 500      |
| Enderium               | 6        | `All`     | 20         | 4207      | 14.1      | 1600       | 11.2    | 1600     |
| Europium               | 6        | `All`     | 20         | 2872      | 15        | 2872       | 15.1    | 2872     |
| Fire Opal              | 4        | `All`     | 20         | 4207      | 12.8      | 3260       | 14.1    | 4207     |
| Flourite               | 4        | `All`     | 7          | 4207      | 12.8      | 1600       | 13.5    | 1600     |
| Fluorite               | 8        | `All`     | 15         | 4207      | 11.9      | 3260       | 12.6    | 4207     |
| Galaxite †             | 10       | `All`     | 100        | 4207      | 17.9      | 1600       | 19      | 1600     |
| Garnet                 | 4        | `All`     | 6          | 4207      | 9.7       | 1600       | 11.2    | 1600     |
| Ghoul Quartz           | 4        | `All`     | 20         | 4207      | 15.3      | 3260       | 15.3    | 4207     |
| Goshenite              | 8        | `All`     | 15         | 4207      | 14.1      | 3260       | 14.7    | 4207     |
| Grandidierite          | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 10.3    | 4207     |
| Green Catseye          | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Green Diamond          | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Green Gold             | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 11.2    | 4207     |
| Green Pearl            | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Green Star Sapphire    | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Grindstone             | 8        | `All`     | 15         | 4207      | 9.1       | 3260       | 10.3    | 4207     |
| Hackmantite            | 8        | `All`     | 15         | 4207      | 12.1      | 3260       | 12.8    | 4207     |
| Hercynite              | 15       | `All`     | 50         | 3816      | 13.5      | 3816       | 12.8    | 4207     |
| Hero †                 | 70       | `All`     | 100069     | 9000      | 50        | 3550       | 44.8    | 4208     |
| Holmium                | 15       | `All`     | 50         | 1600      | 13.5      | 1600       | 12.2    | 1600     |
| Howlite                | 15       | `All`     | 50         | 1600      | 11.05     | 1600       | 6.58    | 1600     |
| Humoranium             | 20       | `All`     | 169        | 4207      | 17.9      | 3260       | 15.5    | 4207     |
| Hydro Potassium        | 20       | `All`     | 75         | 4207      | 17.3      | 1600       | —       | —        |
| Ice Opal               | 8        | `All`     | 15         | 4207      | 14.1      | 1600       | 14.1    | 4207     |
| Ikegamini              | 10       | `All`     | 35         | 4207      | 16.3      | 1600       | 12.8    | 4207     |
| Ikegamium              | 10       | `All`     | 35         | 4207      | 16.3      | 1600       | 12.8    | 4207     |
| Ikegamonium            | 10       | `All`     | 35         | 4207      | 16.3      | 1600       | 12.8    | 4207     |
| Ilmenite               | 8        | `All`     | 15         | 1600      | 14.5      | 1600       | 14.5    | 1600     |
| Ilmenite + Carnotite   | 10       | `All`     | 100        | 1600      | 20        | 1600       | 15.3    | 1600     |
| Indigolite             | 4        | `All`     | 12         | 4207      | 10.3      | 1600       | 11.2    | 1600     |
| Indium                 | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Iolite                 | 4        | `All`     | 16         | 4207      | 10.8      | 1600       | 11.7    | 1600     |
| Iridium                | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 11.2    | 4207     |
| Iris Agate             | 4        | `All`     | 7          | 4207      | 12.8      | 3260       | 13.5    | 4207     |
| Jade                   | 4        | `All`     | 6          | 4207      | 11.2      | 1600       | 12.8    | 1600     |
| Jasper                 | 4        | `All`     | 5          | 4207      | 11.2      | 1600       | 12.1    | 1600     |
| Kunzite                | 4        | `All`     | 10         | 4207      | 13.5      | 1600       | 13.2    | 1600     |
| Labradorite            | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Lapis                  | 10       | `All`     | 35         | 500       | —         | —          | 7.4     | 500      |
| Larimar                | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Lead                   | 8        | `All`     | 15         | 4207      | 15.5      | 3260       | 16.8    | 4207     |
| Magnesium              | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Malachite              | 4        | `All`     | 8          | 4207      | 10.3      | 1600       | 13.5    | 1600     |
| Manganese              | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Maradonyx              | 8        | `All`     | 15         | 4207      | 13.5      | 1600       | 12.5    | 4207     |
| Maroon Diamond         | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Matizium               | 8        | `All`     | 15         | 4207      | 14.1      | 1600       | 14.1    | 4207     |
| Medusa Quartz          | 8        | `All`     | 15         | 4207      | 13.5      | 3260       | 13.5    | 4207     |
| Meteorite †            | 8        | `All`     | 15         | 4207      | 20.8      | 3260       | 20.8    | 4207     |
| Molybdenum             | 4        | `All`     | 20         | 1600      | 12.1      | 1600       | 12.8    | 1600     |
| Moonstone              | 4        | `All`     | 18         | 4207      | 10.3      | 1600       | 11.2    | 1600     |
| Mythril                | 10       | `All`     | 100        | 4207      | 19.9      | 4207       | 15.5    | 4207     |
| Neon Meteorite †       | 8        | `All`     | 120        | 4207      | 28        | 3260       | 28      | 4207     |
| Neptunium              | 10       | `All`     | 100        | 4207      | 19.9      | 2872       | 20.5    | 1600     |
| Nickel                 | 8        | `All`     | 15         | 4207      | 7.4       | 3260       | 9.1     | 4207     |
| Niobium                | 4        | `All`     | 20         | 1600      | 12.1      | 1600       | 12.8    | 1600     |
| Obsidian †             | 10       | `All`     | 35         | 4207      | 5         | 1600       | 12.8    | 4207     |
| Olive Diamond          | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Olive Pearl            | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Onyx                   | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 11.2    | 4207     |
| Opal                   | 4        | `All`     | 12         | 4207      | 12.5      | 1600       | 13.2    | 1600     |
| Orange Catseye         | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Orange Diamond         | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Orange Star Sapphire   | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Orichalcum             | 10       | `All`     | 100        | 4207      | 23.9      | 3260       | 19      | 4207     |
| Osmium                 | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Painite                | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Paladium               | 8        | `All`     | 15         | 4207      | —         | —          | 11.2    | 4207     |
| Palintinium            | 8        | `All`     | 15         | 4207      | 13.5      | 1600       | 12.5    | 4207     |
| Peacock                | 8        | `All`     | 15         | 4207      | 12.8      | 3260       | 13.5    | 4207     |
| Peacock Topaz          | 8        | `All`     | 15         | 4207      | 12.1      | 3260       | 12.8    | 4207     |
| Pearl                  | 4        | `All`     | 19         | 4207      | 12.5      | 1600       | 12.6    | 1600     |
| Pelenite               | 16       | `All`     | 21         | 1600      | 13.2      | 1600       | 13.2    | 1600     |
| Peridot                | 4        | `All`     | 8          | 4207      | 9.1       | 1600       | 15.3    | 1600     |
| Pietersite             | 4        | `All`     | 8          | 1600      | 9.03      | 1600       | 6.85    | 1600     |
| Pink Catseye           | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Pink Diamond           | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Pink Pearl             | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Pink Ruby              | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Pink Star Sapphire     | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Pitambari              | 2        | `Diamond` | 48         | 1600      | 12.5      | 1600       | 13.5    | 1600     |
| Platinum               | 10       | `All`     | 25         | 1600      | 9.15      | 1600       | 9.3     | 1600     |
| Plutonium              | 20       | `All`     | 169        | 4207      | 28        | 2872       | 26.7    | 4207     |
| Plutonium + Unoptanium | 10       | `All`     | 400        | 4207      | —         | —          | —       | —        |
| Potassium              | 10       | `All`     | 35         | 4207      | 12.8      | 1600       | 13.5    | 4207     |
| Princess               | 70       | `All`     | 100069     | 9000      | —         | —          | 44.8    | 4208     |
| Prism                  | 10       | `All`     | 100        | 4207      | 15        | 1600       | —       | —        |
| Purple Catseye         | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Purple Diamond         | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Purple Gold            | 8        | `All`     | 15         | 4207      | 10.3      | 3260       | 11.2    | 4207     |
| Purple Star Sapphire   | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Pyrite                 | 4        | `All`     | 7          | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Quartz-Infused Pyrite  | 4        | `All`     | 7          | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Quicksilver            | 8        | `All`     | 17         | 3         | 2         | 15         | 2       | 15       |
| Radium                 | 1000     | `All`     | 1000       | 4207      | 30.3      | 2872       | 29.3    | 4207     |
| Rainbow Opal           | 8        | `All`     | 15         | 1600      | 12.8      | 1600       | 12.8    | 1600     |
| Rare Amethyst          | 8        | `All`     | 15         | 4207      | 13.5      | 3260       | 13.5    | 4207     |
| Rare Citrine           | 8        | `All`     | 15         | 4207      | 13.5      | 3260       | 13.5    | 4207     |
| Rare Sapphire          | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Rare Star Sapphire     | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Rare Tanzanite         | 8        | `All`     | 15         | 4207      | 13.5      | 3260       | 14.1    | 4207     |
| Raspberry Diamond      | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Red Diamond            | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Red Pearl              | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Redstone               | 10       | `All`     | 35         | 500       | 7.4       | 500        | 8.3     | 500      |
| Rhodium (sic)          | 10       | `All`     | 16         | 1600      | 12.5      | 1600       | 12.5    | 1600     |
| Rhodonite              | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Rose Gold              | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Rose Quartz            | 8        | `All`     | 15         | 4207      | 11.2      | 3260       | 12.1    | 4207     |
| Ruby                   | 4        | `All`     | 6          | 4207      | 11.2      | 1600       | 12.1    | 1600     |
| Ruthenium (sic)        | 4        | `All`     | 200        | 1600      | 13.5      | 1600       | 13.5    | 1600     |
| Rutile                 | 8        | `All`     | 15         | 4207      | 10.2      | 3260       | 11.2    | 4207     |
| Sapphire               | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Sardonyx               | 4        | `All`     | 6          | 4207      | 11.2      | 1600       | 13.5    | 1600     |
| Scandium               | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Serpentine             | 4        | `All`     | 7          | 4207      | 13.2      | 1600       | 13.8    | 1600     |
| Silicon                | 8        | `All`     | 15         | 4207      | 8.3       | 1600       | 11.2    | 4207     |
| Silver                 | 8        | `All`     | 17         | 1600      | 7.83      | 1600       | 8       | 1600     |
| Simoganium             | 10       | `All`     | 35         | 4207      | 16.8      | 1600       | 12.8    | 4207     |
| Simonium               | 10       | `All`     | 35         | 4207      | 16.8      | 1600       | 12.8    | 4207     |
| Smoky Quartz           | 8        | `All`     | 15         | 4207      | —         | —          | —       | —        |
| Snowflake              | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Solar Diamond          | 8        | `All`     | 15         | 4207      | 16.8      | 1600       | 16.8    | 4207     |
| Sonoranite             | 15       | `All`     | 50         | 1600      | 12.8      | 1600       | 11.3    | 1600     |
| Soul Quartz            | 4        | `All`     | 20         | 4207      | 14.1      | 3260       | 14.7    | 4207     |
| Spinel                 | 4        | `All`     | 8          | 4207      | 10.8      | 1600       | 11.7    | 1600     |
| Star Ruby              | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Star Sapphire          | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Steel                  | 8        | `All`     | 15         | 4207      | 6.8       | 3260       | 10.3    | 4207     |
| Stibnite               | 4        | `All`     | 7          | 4207      | 15.8      | 3260       | 16.3    | 4207     |
| Sugillite              | 4        | `All`     | 8          | 4207      | 11.2      | 1600       | —       | —        |
| Sulfur                 | 4        | `All`     | 7          | 4207      | 9.1       | 3260       | 10.3    | 4207     |
| Sunset Jasper          | 8        | `All`     | 15         | 4207      | 15.5      | 3260       | 16.3    | 4207     |
| Sunstone               | 8        | `All`     | 15         | 4207      | 11.2      | 3260       | 11.2    | 4207     |
| Tantalum               | 10       | `All`     | 16         | 1600      | 12.5      | 1600       | 12.5    | 1600     |
| Tanzanite              | 4        | `All`     | 14         | 4207      | 11.2      | 1600       | 12.5    | 1600     |
| Technetium             | 4        | `All`     | 20         | 1600      | 12.1      | 1600       | 12.8    | 1600     |
| Thorium                | 10       | `All`     | 35         | 4207      | 12.8      | 1600       | 13.5    | 4207     |
| Tin                    | 8        | `All`     | 15         | 4207      | 6.7       | 1600       | 7.9     | 1600     |
| Titanium               | 15       | `All`     | 70         | 1600      | 13.8      | 1600       | 12.8    | 1600     |
| Titanium Quartz        | 15       | `All`     | 70         | 1600      | 6.82      | 1600       | 7.65    | 1600     |
| Topaz                  | 4        | `All`     | 8          | 4207      | 12.5      | 1600       | 13.2    | 1600     |
| Tourmaline             | 4        | `All`     | 11         | 4207      | 11.7      | 1600       | 12.5    | 1600     |
| Tungsten               | 8        | `All`     | 15         | 4207      | 11.2      | 1600       | 12.1    | 4207     |
| Turquoise              | 8        | `All`     | 15         | 4207      | 11.2      | 3260       | 11.2    | 4207     |
| Umbranova              | 10       | `All`     | 100        | 1600      | 14.1      | 1600       | 14.5    | 1600     |
| Unoptanium             | 20       | `All`     | 169        | 4207      | 26.1      | 4209       | 26.7    | 4207     |
| Uranium                | 15       | `All`     | 70         | 1600      | 14.7      | 1600       | 14.7    | 1600     |
| Uranium + Titanium     | 10       | `All`     | 100        | 4207      | 17.7      | 4207       | 18.1    | 4207     |
| Vanadium               | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Vesuvianite            | 8        | `All`     | 15         | 4207      | 14.1      | 3260       | 12.8    | 4207     |
| Watermelon Tourmaline  | 4        | `All`     | 5          | 4207      | 10.3      | 1600       | 12.5    | 1600     |
| White Catseye          | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| White Diamond          | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| White Pearl            | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Whitestone             | 10       | `All`     | 35         | 4207      | 19.3      | 1600       | 12.8    | 4207     |
| Wither †               | 5        | `All`     | 20.5       | 4207      | 16.8      | 4207       | 17.3    | 1600     |
| Xernium                | 8        | `All`     | 15         | 4207      | 13.5      | 1600       | 12.5    | 4207     |
| Yellow Catseye         | 10       | `All`     | 35         | 4207      | 15.5      | 3260       | 16.1    | 4207     |
| Yellow Diamond         | 8        | `All`     | 15         | 4207      | 12.5      | 3260       | 13.2    | 4207     |
| Yellow Onyx            | 8        | `All`     | 15         | 4207      | 10.3      | 1600       | 11.2    | 4207     |
| Yellow Pearl           | 10       | `All`     | 35         | 4207      | 12.5      | 1600       | 12.8    | 4207     |
| Yellow Star Sapphire   | 10       | `All`     | 35         | 4207      | 19        | 3260       | 19      | 4207     |
| Yttrium                | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |
| Yurium                 | 8        | `All`     | 15         | 4207      | 13.5      | 1600       | 13.5    | 4207     |
| Zebra Jasper           | 8        | `All`     | 15         | 4207      | 14.1      | 3260       | 14.1    | 4207     |
| Zinc                   | 8        | `All`     | 15         | 4207      | 10.3      | 4207       | 11.2    | 4207     |
| Zirconium              | 10       | `All`     | 35         | 4207      | 12.1      | 1600       | 12.8    | 4207     |




## Armor reference

Armor points are listed by slot as **H / C / L / B** for helmet, chestplate, leggings, and boots. **Total** is the full set's armor value. For comparison, a full vanilla iron set has 15 armor points and diamond or netherite has 20.

**H / C / L / B dur.** gives each piece's durability in the same slot order. **Tough.** is armor toughness, which helps protection hold up against high-damage hits. **KB resist.** is knockback resistance, where 0.1 means 10%. **Enchant.** is enchantability, which affects the quality of enchantments offered at an enchanting table.

### Vanilla armor

| Material | H | C | L | B | Total | H / C / L / B dur. | Tough. | KB resist. | Enchant. |
| -------- | - | - | - | - | ----- | ------------------- | ------ | ---------- | -------- |
| Leather | 1 | 3 | 2 | 1 | 7 | 55 / 80 / 75 / 65 | 0 | 0 | 15 |
| Gold | 2 | 5 | 3 | 1 | 11 | 77 / 112 / 105 / 91 | 0 | 0 | 25 |
| Chainmail | 2 | 5 | 4 | 1 | 12 | 165 / 240 / 225 / 195 | 0 | 0 | 12 |
| Iron | 2 | 6 | 5 | 2 | 15 | 165 / 240 / 225 / 195 | 0 | 0 | 9 |
| Diamond | 3 | 8 | 6 | 3 | 20 | 363 / 528 / 495 / 429 | 2 | 0 | 10 |
| Netherite | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 3 | 0.1 | 15 |

### All Crystalcraft armor sets (237)

Alphabetical. Values come from the armor-material classes in the installed mod. Numbered Zircon sets and other similarly named variants are kept separate because they are distinct registered armor sets.

| Material | H | C | L | B | Total | H / C / L / B dur. | Tough. | KB resist. | Enchant. |
| -------- | - | - | - | - | ----- | ------------------- | ------ | ---------- | -------- |
| Adamantite | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 4 | 0.07 | 40 |
| Alexandrite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.5 | 0 | 9 |
| Aluminium | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 1 | 0 | 9 |
| Amazonite | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 40 |
| Amber | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.6 | 0 | 9 |
| Americium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Amethyst | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Amethyst Crystal | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Ametrine | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.6 | 0 | 20 |
| Ammolite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Angerite | 4 | 9 | 7 | 4 | 24 | 550 / 800 / 750 / 650 | 3.5 | 0.07 | 40 |
| Anti-Humoranium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.6 | 0.03 | 25 |
| Antimony | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Aquamarine | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Aura Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Australian Sapphire | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Azurite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Bismuth | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 40 |
| Bixbite | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.4 | 0 | 40 |
| Black Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Black Opal | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Black Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Blackstone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Blood Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Bloodstone | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.4 | 0 | 40 |
| Blue Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Blue Pearl 1 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Blue Pearl 2 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Blue Sapphire | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Bluestone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Brass | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Brickerite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Bronze | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Brown Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Brown Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Cadmium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Calcium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0 | 0 | 9 |
| Carnotite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 20 |
| Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Chalcanthite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Chloronium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Chrome | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.1 | 0 | 9 |
| Chrysolite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.6 | 0 | 20 |
| Cinnabar | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Citrine | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Cobalt | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 10.7 | 0.21 | 20 |
| Copper | 2 | 5 | 5 | 1 | 13 | 165 / 240 / 225 / 195 | 0 | 0 | 9 |
| Crimson Gold | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.3 | 0 | 20 |
| Crystal | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.5 | 0.02 | 40 |
| Cupronickel | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 27 |
| Cyan Emerald | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Cyan Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Dark Blue Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 20 |
| Dragon Scale | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Eclipse | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 40 |
| Electrum | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.1 | 0 | 9 |
| Emerald | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 36 |
| Enderium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 40 |
| Europium | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 9 |
| Fire Opal | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Flourite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Fluorite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Galaxite | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 40 |
| Garnet | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Ghoul Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Goshenite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Grandidierite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Green Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Green Gold | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.7 | 0 | 36 |
| Green Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Green Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Grindstone | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.8 | 0 | 40 |
| Hackmantite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Helios | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.9 | 0.05 | 40 |
| Hercynite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Holmium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Howlite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Humoranium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.6 | 0.03 | 25 |
| Hydro Potassium | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 20 |
| Ice Opal | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 40 |
| Ikegamini | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Ikegamium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Ikegamonium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Ilmenite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 20 |
| Indigolite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 30 |
| Indium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Iolite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.6 | 0 | 9 |
| Iridium | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Iris Agate | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Jade | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.3 | 0 | 9 |
| Jasper | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Kunzite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Labradorite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Lapis | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Larimar | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Lead | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Lithium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 23 |
| Magnesium | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 40 |
| Malachite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Manganese | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Maradonyx | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.1 | 0.05 | 20 |
| Maroon Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 9 |
| Matizium | 4 | 8 | 6 | 4 | 22 | 484 / 704 / 660 / 572 | 3.1 | 0.05 | 20 |
| Matrix | 20 | 20 | 20 | 20 | 80 | 1100 / 1600 / 1500 / 1300 | 20 | 0.4 | 40 |
| Medusa | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Meteorite | 3 | 8 | 6 | 3 | 20 | 440 / 640 / 600 / 520 | 10 | 0.2 | 20 |
| Moonstone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 9 |
| Mythril | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 4 | 0.07 | 40 |
| Neon Meteorite | 10 | 20 | 10 | 10 | 50 | 880 / 1280 / 1200 / 1040 | 20 | 0.4 | 20 |
| Neptunium | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 10.7 | 0.21 | 20 |
| Nickel | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.4 | 0 | 40 |
| Niobium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Obsidian | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Olive Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Olive Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Olivine | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Onyx | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Opal | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.5 | 0 | 9 |
| Orange Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Orange Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Orange Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Orichalcum | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.6 | 0.08 | 40 |
| Osmium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Painite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Palintinium | 4 | 8 | 6 | 4 | 22 | 484 / 704 / 660 / 572 | 3.1 | 0.05 | 20 |
| Palladium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.1 | 0 | 9 |
| Peacock | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.5 | 0 | 20 |
| Peacock Topaz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.3 | 0 | 9 |
| Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Pelenium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Peridot | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.5 | 0 | 30 |
| Pietersite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0 | 0 | 9 |
| Pink Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Pink Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Pink Ruby | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.6 | 0 | 36 |
| Pink Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Pink Tigerseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Pitambari Neelam | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Platinum | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 20 |
| Plutonium | 6 | 9 | 7 | 5 | 27 | 407 / 592 / 555 / 481 | 10.7 | 0.21 | 40 |
| Potassium | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 20 |
| Prism | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.6 | 0.03 | 25 |
| Purple Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Purple Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Purple Gold | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.7 | 0 | 40 |
| Purple Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Purple Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Pyrite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Quartz-Infused Pyrite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0.2 | 9 |
| Quicksilver | 1 | 1 | 1 | 1 | 4 | 165 / 240 / 225 / 195 | 0 | 0 | 20 |
| Radium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 40 |
| Rainbow Opal | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 20 |
| Rare Amethyst | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Rare Citrine | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.1 | 0.01 | 40 |
| Rare Sapphire | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.2 | 0 | 9 |
| Rare Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Rare Tanzanite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 9 |
| Raspberry Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 9 |
| Red Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Red Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Redstone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Rhodium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Rhodonite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Rose | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Rose Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Ruby | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Ruthenium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Rutile | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 31 |
| Sapphire | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.5 | 0 | 9 |
| Sardonyx | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 9 |
| Scandium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Serpentine | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.8 | 0 | 36 |
| Shadow Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 20 |
| Silicon | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.3 | 0 | 36 |
| Silver | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Simoganium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Simonium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Smoky Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Snowflake | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Solar | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 40 |
| Sonoranite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Soul Quartz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Spinel | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 36 |
| Star Ruby | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Steel | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.5 | 0 | 40 |
| Stibnite | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 20 |
| Sugillite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 9 |
| Sulfur | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Sunset Jasper | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 9 |
| Sunstone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Tantalum | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Tanzanite | 2 | 7 | 5 | 2 | 16 | 220 / 320 / 300 / 260 | 0.5 | 0 | 20 |
| Technetium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Thorium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.6 | 0.08 | 20 |
| Tigerseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Tin | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Titanium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.8 | 0.09 | 20 |
| Titanium Quartz | 4 | 6 | 6 | 4 | 20 | 407 / 592 / 555 / 481 | 4 | 0.2 | 20 |
| Topaz | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.4 | 0 | 25 |
| Tourmaline | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Tungsten | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 9 |
| Turquoise | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.4 | 0 | 40 |
| Umbranova | 6 | 7 | 6 | 5 | 24 | 484 / 704 / 660 / 572 | 6 | 0.4 | 90 |
| Unoptanium | 6 | 9 | 7 | 5 | 27 | 407 / 592 / 555 / 481 | 10.7 | 0.21 | 40 |
| Uranium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.8 | 0.09 | 20 |
| Vanadium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Vesuvianite | 3 | 7 | 6 | 3 | 19 | 363 / 528 / 495 / 429 | 1.3 | 0 | 9 |
| Watermelon | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| White Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| White Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| White Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Whitestone | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Wither | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 40 |
| Xernium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.1 | 0.05 | 20 |
| Yellow Catseye | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Yellow Diamond | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2 | 0 | 20 |
| Yellow Onyx | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.7 | 0 | 9 |
| Yellow Pearl | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Yellow Star Sapphire | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.5 | 0.07 | 9 |
| Yurium | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 3.1 | 0.05 | 20 |
| Zebra Jasper | 4 | 9 | 7 | 4 | 24 | 484 / 704 / 660 / 572 | 2.2 | 0.01 | 20 |
| Zinc | 3 | 8 | 6 | 3 | 20 | 407 / 592 / 555 / 481 | 1.9 | 0 | 9 |
| Zircon | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 1 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 10 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 11 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 12 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 14 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 3 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 4 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 5 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 6 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 7 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 8 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zircon 9 | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |
| Zirconium | 2 | 6 | 5 | 2 | 15 | 198 / 288 / 270 / 234 | 0.1 | 0 | 9 |


## Where each ore spawns



### Overworld (109)


| Ore                       | Host rock         |
| ------------------------- | ----------------- |
| Alexandrite Ore           | Stone + Deepslate |
| Aluminium Ore             | Stone + Deepslate |
| Amazonite Ore             | Stone only        |
| Amber Ore                 | Stone + Deepslate |
| Americium Ore             | Stone only        |
| Amethyst Ore              | Stone + Deepslate |
| Ametrine Ore              | Stone + Deepslate |
| Ammolite Ore              | Stone + Deepslate |
| Aqua Sapphire Ore         | Stone + Deepslate |
| Aquamarine Ore            | Stone + Deepslate |
| Australian Sapphire Ore   | Stone + Deepslate |
| Azurite Ore               | Stone only        |
| Bismuth Ore               | Stone only        |
| Black Opal Ore            | Stone + Deepslate |
| Brickerite Ore            | Stone only        |
| Bronze Ore                | Stone only        |
| Cadmium Ore               | Stone + Deepslate |
| Calcium Ore               | Stone only        |
| Chalcanthite Ore          | Stone + Deepslate |
| Chloronium Ore            | Stone only        |
| Chrome Ore                | Stone only        |
| Chrysolite Ore            | Stone + Deepslate |
| Cinnabar Ore              | Stone only        |
| Citrine Ore               | Stone + Deepslate |
| Cyan Emerald Ore          | Stone only        |
| Flourite Ore              | Stone + Deepslate |
| Fluorite Ore              | Stone only        |
| Garnet Ore                | Stone + Deepslate |
| Goshenite Ore             | Stone only        |
| Grandidierite Ore         | Stone + Deepslate |
| Hackmantite Ore           | Stone only        |
| Hercynite Ore             | Stone only        |
| Holmium Ore               | Stone + Deepslate |
| Howlite Ore               | Stone + Deepslate |
| Indigolite Ore            | Stone only        |
| Indium Ore                | Stone + Deepslate |
| Iolite Ore                | Stone only        |
| Iridium Ore               | Stone only        |
| Iris Agate Ore            | Stone only        |
| Jade Ore                  | Stone + Deepslate |
| Jasper Agate Ore          | Stone only        |
| Kunzite Ore               | Stone only        |
| Labradorite Ore           | Stone only        |
| Lead Ore                  | Stone only        |
| Lithium Ore               | Stone only        |
| Magnesium Ore             | Stone + Deepslate |
| Malachite Ore             | Stone + Deepslate |
| Manganese Ore             | Stone + Deepslate |
| Matizium Ore              | Stone + Deepslate |
| Matrix Opal Ore           | Stone only        |
| Medusa Quartz Ore         | Stone only        |
| Molybdenum Ore            | Stone + Deepslate |
| Nickel Ore                | Stone only        |
| Niobium Ore               | Stone + Deepslate |
| Olivine Ore               | Stone + Deepslate |
| Onyx Ore                  | Stone only        |
| Opal Ore                  | Stone + Deepslate |
| Osmium Ore                | Stone + Deepslate |
| Palintinium Ore           | Stone + Deepslate |
| Peacock Ore               | Stone only        |
| Peacock Topaz Ore         | Stone only        |
| Peridot Ore               | Stone + Deepslate |
| Pietersite Ore            | Stone + Deepslate |
| Pink Ruby Ore             | Stone + Deepslate |
| Pitambari Neelam Ore      | Stone only        |
| Platinum Ore              | Stone + Deepslate |
| Prism Ore                 | Stone + Deepslate |
| Quicksilver Ore           | Stone only        |
| Rainbow Opal Ore          | Stone + Deepslate |
| Rare Amethyst Ore         | Stone only        |
| Rare Citrine Ore          | Stone only        |
| Rare Sapphire Ore         | Stone + Deepslate |
| Rare Tanzanite Ore        | Stone only        |
| Raspberry Diamond Ore     | Stone only        |
| Rhodium Ore               | Stone + Deepslate |
| Rose Quartz Ore           | Stone only        |
| Ruby Ore                  | Stone + Deepslate |
| Ruthenium Ore             | Stone + Deepslate |
| Rutile Ore                | Stone only        |
| Sapphire Ore              | Stone + Deepslate |
| Sardonyx Ore              | Stone + Deepslate |
| Scandium Ore              | Stone + Deepslate |
| Silicon Ore               | Stone only        |
| Silver Ore                | Stone + Deepslate |
| Smoky Quartz Ore          | Stone only        |
| Sonoranite Ore            | Stone only        |
| Spinel Ore                | Stone + Deepslate |
| Stibnite Ore              | Stone only        |
| Sugillite Ore             | Stone + Deepslate |
| Sunset Jasper Ore         | Stone only        |
| Tantalum Ore              | Stone + Deepslate |
| Tanzanite Ore             | Stone + Deepslate |
| Technetium Ore            | Stone + Deepslate |
| Thorium Ore               | Stone + Deepslate |
| Tin Ore                   | Stone only        |
| Titanium Ore              | Stone + Deepslate |
| Topaz Ore                 | Stone + Deepslate |
| Tourmaline Ore            | Stone + Deepslate |
| Tungsten Ore              | Stone only        |
| Turquoise Ore             | Stone only        |
| Uranium Ore               | Stone + Deepslate |
| Vanadium Ore              | Stone + Deepslate |
| Vesuvianite Ore           | Stone only        |
| Watermelon Tourmaline Ore | Stone only        |
| Yellow Onyx Ore           | Stone only        |
| Yttrium Ore               | Stone + Deepslate |
| Zinc Ore                  | Stone only        |
| Zircon Ore                | Stone only        |
| Zirconium Ore             | Stone + Deepslate |




### Nether — in netherrack (14)


| Ore                |
| ------------------ |
| Bixbite Ore        |
| Bloodstone Ore     |
| Catseye Ore        |
| Fire Opal Ore      |
| Green Catseye Ore  |
| Orange Diamond Ore |
| Palladium Ore      |
| Pelenium Ore       |
| Pyrite Ore         |
| Red Diamond Ore    |
| Seaborgium Ore     |
| Sulfur Ore         |
| Sunstone Ore       |
| Yurium Ore         |




### The End — in end stone (16)


| Ore                |
| ------------------ |
| Bluestone Ore      |
| Cobalt Ore         |
| Cyber Crystal Ore  |
| Enderium Ore       |
| Europium Ore       |
| Larimar Ore        |
| Maradonyx Ore      |
| Moonstone Ore      |
| Obsidian Ore       |
| Orichalcum Ore     |
| Pottasium Ore      |
| Purple Diamond Ore |
| Rhodonite Ore      |
| Serpentine Ore     |
| White Diamond Ore  |
| Xernium Ore        |




## Rankings (Crystalcraft only)



### Fastest pickaxes


| #   | Material               | Value  |
| --- | ---------------------- | ------ |
| 1   | Hero                   | 100069 |
| 2   | Princess               | 100069 |
| 3   | Radium                 | 1000   |
| 4   | Plutonium + Unoptanium | 400    |
| 5   | Ruthenium (sic)        | 200    |
| 6   | Anti-Humoranium        | 169    |
| 7   | Humoranium             | 169    |
| 8   | Plutonium              | 169    |
| 9   | Unoptanium             | 169    |
| 10  | Neon Meteorite         | 120    |
| 11  | Adamantite             | 100    |
| 12  | Adamantite + Mythril   | 100    |




### Slowest pickaxes


| #   | Material              | Value |
| --- | --------------------- | ----- |
| 1   | Jasper                | 5     |
| 2   | Watermelon Tourmaline | 5     |
| 3   | Garnet                | 6     |
| 4   | Jade                  | 6     |
| 5   | Ruby                  | 6     |
| 6   | Sardonyx              | 6     |
| 7   | Angerite              | 7     |
| 8   | Antimony              | 7     |
| 9   | Aqua Sapphire         | 7     |
| 10  | Chalcanthite          | 7     |
| 11  | Cyan Emerald          | 7     |
| 12  | Flourite              | 7     |




### Strongest swords


| #   | Material             | Value |
| --- | -------------------- | ----- |
| 1   | Hero                 | 50    |
| 2   | Radium               | 30.3  |
| 3   | Neon Meteorite       | 28    |
| 4   | Plutonium            | 28    |
| 5   | Unoptanium           | 26.1  |
| 6   | Blackstone           | 23.9  |
| 7   | Orichalcum           | 23.9  |
| 8   | Cobalt               | 22.5  |
| 9   | Anti-Humoranium      | 21.7  |
| 10  | Angerite             | 20.8  |
| 11  | Meteorite            | 20.8  |
| 12  | Ilmenite + Carnotite | 20    |




### Weakest swords


| #   | Material        | Value |
| --- | --------------- | ----- |
| 1   | Quicksilver     | 2     |
| 2   | Bronze          | 5     |
| 3   | Obsidian        | 5     |
| 4   | Tin             | 6.7   |
| 5   | Steel           | 6.8   |
| 6   | Titanium Quartz | 6.82  |
| 7   | Copper          | 7.4   |
| 8   | Nickel          | 7.4   |
| 9   | Redstone        | 7.4   |
| 10  | Aura Quartz     | 7.45  |
| 11  | Silver          | 7.83  |
| 12  | Americium       | 8.3   |




### Strongest axes


| #   | Material             | Value |
| --- | -------------------- | ----- |
| 1   | Hero                 | 44.8  |
| 2   | Princess             | 44.8  |
| 3   | Radium               | 29.3  |
| 4   | Neon Meteorite       | 28    |
| 5   | Plutonium            | 26.7  |
| 6   | Unoptanium           | 26.7  |
| 7   | Adamantite + Mythril | 25.4  |
| 8   | Angerite             | 21.2  |
| 9   | Meteorite            | 20.8  |
| 10  | Neptunium            | 20.5  |
| 11  | Dragon Scale         | 19.3  |
| 12  | Adamantite           | 19    |




### Highest pickaxe durability


| #   | Material             | Value |
| --- | -------------------- | ----- |
| 1   | Hero                 | 9000  |
| 2   | Princess             | 9000  |
| 3   | Adamantite           | 4207  |
| 4   | Adamantite + Mythril | 4207  |
| 5   | Alexandrite          | 4207  |
| 6   | Aluminium            | 4207  |
| 7   | Amazonite            | 4207  |
| 8   | Amber                | 4207  |
| 9   | Americium            | 4207  |
| 10  | Amethyst             | 4207  |
| 11  | Amethyst Crystal     | 4207  |
| 12  | Ametrine             | 4207  |




### Lowest pickaxe durability


| #   | Material    | Value |
| --- | ----------- | ----- |
| 1   | Quicksilver | 3     |
| 2   | Copper      | 200   |
| 3   | Emerald     | 500   |
| 4   | Lapis       | 500   |
| 5   | Redstone    | 500   |
| 6   | Antimony    | 1600  |
| 7   | Aura Quartz | 1600  |
| 8   | Brickerite  | 1600  |
| 9   | Cadmium     | 1600  |
| 10  | Calcium     | 1600  |
| 11  | Carnotite   | 1600  |
| 12  | Holmium     | 1600  |




## Notes & oddities

- **Almost every Crystalcraft pickaxe can mine everything.** The only exception is **Pitambari Neelam** (level 2 = iron-equivalent: diamond ore yes, obsidian no). Every other pickaxe is level 4 or higher.
- **Joke / novelty tiers:** *Princess* and *Hero* pickaxes have speed 100069 and level 70 (instant-break anything). *Radium* has pick speed & level 1000 and the strongest plain sword (~30). *Hero* blade hits for 50. *Plutonium + Unoptanium* pickaxe has speed 400. *Copper*'s pickaxe has only 200 durability — a deliberate downgrade.
- **Pickaxe-only materials** (no sword, axe, or armour): *Draconic*, *Smoky Quartz*, *Plutonium + Unoptanium*. *Black Diamond* has only pickaxe/shovel/hoe. Several materials have a pickaxe **and axe but no sword** (*Lapis*, *Palladium*, *Princess*, *Adamantite + Mythril*), or a sword but no axe (*Blue Catseye*, *Hydro Potassium*, *Prism*, *Sugillite*).
- **Blade weapons** (marked †) replace the sword for *Galaxite, Hero, Meteorite, Neon Meteorite, Obsidian, Wither*. There are also katanas, scythes, and cyber-sabers in the mod that aren't broken out here.
- Every ore also crafts a full **armour set**, a **shield**, and a **storage block**; metals have a raw form that smelts into an ingot.
- A few names are misspelled in the mod itself — *Saphire* (Aqua Sapphire), *Rutheniu*, *Rhodiu*, *Lapiz* (Lapis), *Pottasium* (Potassium).
- The mod ships an in-game guide, the craftable **Crystalopedia** book.

