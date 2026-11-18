package com.calebsmod.laststand;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.Container;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraftforge.registries.ForgeRegistries;

/** Strips banned items and enforces carry caps when the build phase ends. */
final class ItemFilter {
    private final Set<ResourceLocation> bannedIds = new HashSet<>();
    private final Set<String> bannedMods = new HashSet<>();
    private final Set<TagKey<Item>> bannedTags = new HashSet<>();
    private final Map<ResourceLocation, Integer> caps = new HashMap<>();

    static ItemFilter fromConfig() {
        ItemFilter f = new ItemFilter();
        for (String entry : ArenaConfig.BANNED_ITEMS.get()) {
            if (entry.startsWith("@")) {
                f.bannedMods.add(entry.substring(1));
            } else if (entry.startsWith("#")) {
                ResourceLocation id = ResourceLocation.tryParse(entry.substring(1));
                if (id != null) f.bannedTags.add(TagKey.create(Registries.ITEM, id));
            } else {
                ResourceLocation id = ResourceLocation.tryParse(entry);
                if (id != null) f.bannedIds.add(id);
            }
        }
        for (String entry : ArenaConfig.ITEM_CAPS.get()) {
            int eq = entry.lastIndexOf('=');
            if (eq < 0) continue;
            ResourceLocation id = ResourceLocation.tryParse(entry.substring(0, eq).trim());
            try {
                int max = Integer.parseInt(entry.substring(eq + 1).trim());
                if (id != null && max >= 0) f.caps.put(id, max);
            } catch (NumberFormatException ignored) {
                // A malformed cap is skipped rather than failing the whole round.
            }
        }
        return f;
    }

    private boolean banned(ItemStack stack, ResourceLocation id) {
        if (stack.getItem() instanceof SpawnEggItem) return true;
        if (bannedIds.contains(id) || bannedMods.contains(id.getNamespace())) return true;
        for (TagKey<Item> tag : bannedTags) if (stack.is(tag)) return true;
        return false;
    }

    /**
     * Filters every slot. {@code counts} tracks how much of each capped item the owner already holds;
     * pass null to apply bans only (used for chests). Returns the number of stacks removed or reduced.
     */
    int filter(Container container, Map<ResourceLocation, Integer> counts) {
        int changed = 0;
        for (int i = 0; i < container.getContainerSize(); i++) {
            ItemStack stack = container.getItem(i);
            if (stack.isEmpty()) continue;
            int before = stack.getCount();
            ItemStack result = filterStack(stack, counts);
            if (result.isEmpty() || result.getCount() != before) changed++;
            if (result != stack) container.setItem(i, result);
        }
        return changed;
    }

    private ItemStack filterStack(ItemStack stack, Map<ResourceLocation, Integer> counts) {
        ResourceLocation id = ForgeRegistries.ITEMS.getKey(stack.getItem());
        if (id == null || banned(stack, id)) return ItemStack.EMPTY;

        Integer cap = counts == null ? null : caps.get(id);
        if (cap != null) {
            int allowed = Math.max(0, cap - counts.getOrDefault(id, 0));
            if (allowed == 0) return ItemStack.EMPTY;
            if (stack.getCount() > allowed) stack.setCount(allowed);
            counts.merge(id, stack.getCount(), Integer::sum);
        }

        CompoundTag tag = stack.getTag();
        if (tag != null) {
            // Bundles keep contents at the top level, shulker boxes under BlockEntityTag.
            if (tag.contains("Items", Tag.TAG_LIST)) filterNested(tag, counts);
            if (tag.contains("BlockEntityTag", Tag.TAG_COMPOUND)) {
                CompoundTag blockEntity = tag.getCompound("BlockEntityTag");
                if (blockEntity.contains("Items", Tag.TAG_LIST)) filterNested(blockEntity, counts);
            }
        }
        return stack;
    }

    private void filterNested(CompoundTag holder, Map<ResourceLocation, Integer> counts) {
        ListTag items = holder.getList("Items", Tag.TAG_COMPOUND);
        ListTag kept = new ListTag();
        for (Tag raw : items) {
            CompoundTag entry = (CompoundTag) raw;
            ItemStack inner = filterStack(ItemStack.of(entry), counts);
            if (inner.isEmpty()) continue;
            CompoundTag out = new CompoundTag();
            inner.save(out);
            if (entry.contains("Slot")) out.putByte("Slot", entry.getByte("Slot"));
            kept.add(out);
        }
        holder.put("Items", kept);
    }
}
