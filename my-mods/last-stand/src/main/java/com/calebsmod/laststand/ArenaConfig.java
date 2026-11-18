package com.calebsmod.laststand;

import java.util.List;
import net.minecraftforge.common.ForgeConfigSpec;

/** Written to config/laststand-common.toml on the server. */
public final class ArenaConfig {
    public static final ForgeConfigSpec SPEC;
    public static final ForgeConfigSpec.IntValue BUILD_SECONDS;
    public static final ForgeConfigSpec.IntValue CELL_SIZE;
    public static final ForgeConfigSpec.IntValue CELL_GAP;
    public static final ForgeConfigSpec.IntValue RECONNECT_SECONDS;
    public static final ForgeConfigSpec.IntValue MIN_PLAYERS;
    public static final ForgeConfigSpec.ConfigValue<List<? extends String>> BANNED_ITEMS;
    public static final ForgeConfigSpec.ConfigValue<List<? extends String>> ITEM_CAPS;

    static {
        ForgeConfigSpec.Builder b = new ForgeConfigSpec.Builder();
        BUILD_SECONDS = b.comment("Length of the creative build phase.")
                .defineInRange("buildSeconds", 300, 10, 3600);
        CELL_SIZE = b.comment("Width and depth of each player's cell, in blocks (X and Z only, height is unlimited).")
                .defineInRange("cellSize", 200, 32, 2000);
        CELL_GAP = b.comment("Neutral ground between neighbouring cells. Keeps lava, water and sand from spilling over.")
                .defineInRange("cellGap", 32, 0, 500);
        RECONNECT_SECONDS = b.comment("How long a disconnected player's slot is held before they are eliminated.")
                .defineInRange("reconnectSeconds", 60, 0, 600);
        MIN_PLAYERS = b.comment("Players needed for /arena start. /arena forcestart ignores this.")
                .defineInRange("minPlayers", 2, 1, 64);
        BANNED_ITEMS = b.comment(
                        "Removed from every participant (inventory, ender chest, shulker boxes, bundles, opened chests)",
                        "when the build phase ends. Entries: 'modid:item', '#modid:tag' for an item tag, '@modid' for a whole mod.",
                        "All spawn eggs are always removed.")
                .defineListAllowEmpty(List.of("bannedItems"), () -> List.of(
                        "minecraft:command_block", "minecraft:chain_command_block",
                        "minecraft:repeating_command_block", "minecraft:command_block_minecart",
                        "minecraft:structure_block", "minecraft:structure_void", "minecraft:jigsaw",
                        "minecraft:barrier", "minecraft:light", "minecraft:debug_stick",
                        "minecraft:bedrock", "minecraft:spawner", "minecraft:end_portal_frame",
                        "minecraft:knowledge_book", "minecraft:enchanted_golden_apple",
                        "minecraft:dragon_egg", "minecraft:netherite_block"), o -> o instanceof String);
        ITEM_CAPS = b.comment(
                        "Per-player maximum carried when the build phase ends, as 'modid:item=max'.",
                        "Applies to the player's inventory and ender chest combined. Chests are only checked against bannedItems.")
                .defineListAllowEmpty(List.of("itemCaps"), () -> List.of(
                        "minecraft:tnt=16", "minecraft:ender_pearl=8", "minecraft:lava_bucket=2",
                        "minecraft:golden_apple=8", "minecraft:totem_of_undying=1",
                        "minecraft:netherite_ingot=8", "minecraft:netherite_sword=1",
                        "minecraft:netherite_helmet=1", "minecraft:netherite_chestplate=1",
                        "minecraft:netherite_leggings=1", "minecraft:netherite_boots=1",
                        "minecraft:elytra=1", "minecraft:end_crystal=4", "minecraft:respawn_anchor=2",
                        "minecraft:fire_charge=16", "minecraft:flint_and_steel=2"), o -> o instanceof String);
        SPEC = b.build();
    }

    private ArenaConfig() {}
}
