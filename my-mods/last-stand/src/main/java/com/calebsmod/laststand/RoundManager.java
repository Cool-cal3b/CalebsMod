package com.calebsmod.laststand;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.util.Mth;
import net.minecraft.world.BossEvent;
import net.minecraft.world.Container;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.phys.Vec3;
import net.minecraftforge.event.RegisterCommandsEvent;
import net.minecraftforge.event.TickEvent;
import net.minecraftforge.event.entity.EntityTravelToDimensionEvent;
import net.minecraftforge.event.entity.living.LivingAttackEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraftforge.event.entity.player.PlayerContainerEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.event.server.ServerStoppingEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;

/**
 * One round at a time: BUILD (creative, locked to a cell on X/Z) -> SURVIVAL (borders down, last one standing)
 * -> ENDED (winner announced, everyone returned). State is in memory only, so a server restart ends the round.
 */
public class RoundManager {
    enum Phase { BUILD, SURVIVAL, ENDED }

    /** One player's slot in the round. Bounds are the cell they are locked to during BUILD. */
    static final class Participant {
        final UUID id;
        final String name;
        final double minX, maxX, minZ, maxZ, spawnX, spawnZ;
        boolean eliminated;
        boolean filtered;
        long disconnectDeadline = -1;
        final Map<ResourceLocation, Integer> carried = new HashMap<>();

        Participant(UUID id, String name, double cx, double cz, double half) {
            this.id = id;
            this.name = name;
            this.minX = cx - half;
            this.maxX = cx + half;
            this.minZ = cz - half;
            this.maxZ = cz + half;
            this.spawnX = cx;
            this.spawnZ = cz;
        }

        boolean contains(BlockPos pos) {
            return pos.getX() + 1 > minX && pos.getX() < maxX && pos.getZ() + 1 > minZ && pos.getZ() < maxZ;
        }
    }

    static final class Round {
        final ResourceKey<Level> dimension;
        final Map<UUID, Participant> participants = new LinkedHashMap<>();
        final ItemFilter filter = ItemFilter.fromConfig();
        final ServerBossEvent bar = new ServerBossEvent(
                Component.empty(), BossEvent.BossBarColor.GREEN, BossEvent.BossBarOverlay.PROGRESS);
        Phase phase = Phase.BUILD;
        long phaseStart;
        long phaseEnd;

        Round(ResourceKey<Level> dimension) {
            this.dimension = dimension;
        }

        long aliveCount() {
            return participants.values().stream().filter(p -> !p.eliminated).count();
        }
    }

    private Round round;
    private MinecraftServer server;

    // ---- Commands -------------------------------------------------------------------------------------------

    String start(ServerPlayer host, int buildSeconds, boolean force) {
        MinecraftServer srv = host.server;
        if (round != null) return "A round is already running. Use /arena stop first.";
        List<ServerPlayer> players = new ArrayList<>(srv.getPlayerList().getPlayers());
        if (!force && players.size() < ArenaConfig.MIN_PLAYERS.get())
            return "Need at least " + ArenaConfig.MIN_PLAYERS.get() + " players online.";
        server = srv;
        ServerLevel level = host.serverLevel();
        Collections.shuffle(players);

        int n = players.size();
        int cols = (int) Math.ceil(Math.sqrt(n));
        double size = ArenaConfig.CELL_SIZE.get();
        double pitch = size + ArenaConfig.CELL_GAP.get();
        Round r = new Round(level.dimension());
        for (int i = 0; i < n; i++) {
            int col = i % cols;
            int row = i / cols;
            int rows = (int) Math.ceil(n / (double) cols);
            double cx = Math.floor(host.getX()) + 0.5 + (col - (cols - 1) / 2.0) * pitch;
            double cz = Math.floor(host.getZ()) + 0.5 + (row - (rows - 1) / 2.0) * pitch;
            ServerPlayer p = players.get(i);
            r.participants.put(p.getUUID(), new Participant(p.getUUID(), p.getGameProfile().getName(), cx, cz, size / 2.0));
        }
        round = r;
        r.phaseStart = srv.getTickCount();
        r.phaseEnd = r.phaseStart + buildSeconds * 20L;

        for (ServerPlayer p : players) {
            Participant part = r.participants.get(p.getUUID());
            prepareForBuild(p, level, part);
            r.bar.addPlayer(p);
        }
        updateBar(r, buildSeconds);
        broadcast(Component.literal("Round started! " + n + " players, " + buildSeconds
                + "s to build. You cannot leave your cell until the borders fall.").withStyle(ChatFormatting.GOLD));
        title(players, "Build!", "Borders fall in " + formatTime(buildSeconds));
        return null;
    }

    String stop() {
        if (round == null) return "No round is running.";
        broadcast(Component.literal("The round was stopped by an operator.").withStyle(ChatFormatting.RED));
        finish();
        return null;
    }

    String skipBuild() {
        if (round == null || round.phase != Phase.BUILD) return "No build phase is running.";
        beginSurvival();
        return null;
    }

    String status() {
        if (round == null) return "No round is running.";
        long left = Math.max(0, round.phaseEnd - server.getTickCount()) / 20;
        StringBuilder sb = new StringBuilder("Phase " + round.phase + ", " + formatTime(left) + " left. Players: ");
        round.participants.values().forEach(p -> sb.append(p.name)
                .append(p.eliminated ? " (out)" : p.disconnectDeadline >= 0 ? " (offline)" : "").append(", "));
        return sb.toString();
    }

    // ---- Phase transitions ----------------------------------------------------------------------------------

    private void prepareForBuild(ServerPlayer p, ServerLevel level, Participant part) {
        p.stopRiding();
        level.getChunk(Mth.floor(part.spawnX) >> 4, Mth.floor(part.spawnZ) >> 4);
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, Mth.floor(part.spawnX), Mth.floor(part.spawnZ)) + 1;
        p.setGameMode(GameType.CREATIVE);
        p.teleportTo(level, part.spawnX, y, part.spawnZ, p.getYRot(), 0);
        p.setDeltaMovement(Vec3.ZERO);
        p.setHealth(p.getMaxHealth());
        p.getFoodData().setFoodLevel(20);
    }

    private void beginSurvival() {
        Round r = round;
        r.phase = Phase.SURVIVAL;
        r.phaseStart = server.getTickCount();
        r.phaseEnd = Long.MAX_VALUE;
        List<ServerPlayer> online = new ArrayList<>();
        for (Participant part : r.participants.values()) {
            ServerPlayer p = server.getPlayerList().getPlayer(part.id);
            if (p == null) continue;
            enterSurvival(p, part);
            online.add(p);
        }
        r.bar.setColor(BossEvent.BossBarColor.RED);
        r.bar.setProgress(1f);
        updateBar(r, 0);
        broadcast(Component.literal("The borders have fallen. Last one standing wins!").withStyle(ChatFormatting.RED));
        title(online, "Fight!", "Last one standing wins");
    }

    private void enterSurvival(ServerPlayer p, Participant part) {
        int changed = part.filtered ? 0 : round.filter.filter(p.getInventory(), part.carried)
                + round.filter.filter(p.getEnderChestInventory(), part.carried);
        part.filtered = true;
        p.setGameMode(part.eliminated ? GameType.SPECTATOR : GameType.SURVIVAL);
        if (!part.eliminated) {
            p.setHealth(p.getMaxHealth());
            p.getFoodData().setFoodLevel(20);
        }
        if (changed > 0)
            p.sendSystemMessage(Component.literal(changed + " item stack(s) were removed or reduced to fit the round rules.")
                    .withStyle(ChatFormatting.YELLOW));
    }

    private void eliminate(Participant part, Component reason) {
        if (part.eliminated) return;
        part.eliminated = true;
        part.disconnectDeadline = -1;
        ServerPlayer p = server.getPlayerList().getPlayer(part.id);
        if (p != null) p.setGameMode(GameType.SPECTATOR);
        broadcast(reason);
        checkWin();
    }

    private void checkWin() {
        Round r = round;
        if (r == null || r.phase != Phase.SURVIVAL) return;
        long alive = r.aliveCount();
        if (alive > 1) return;
        Participant winner = r.participants.values().stream().filter(p -> !p.eliminated).findFirst().orElse(null);
        List<ServerPlayer> everyone = new ArrayList<>(server.getPlayerList().getPlayers());
        if (winner == null) {
            broadcast(Component.literal("Nobody survived. It's a draw!").withStyle(ChatFormatting.YELLOW));
            title(everyone, "Draw", "");
        } else {
            broadcast(Component.literal(winner.name + " wins the round!").withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
            title(everyone, winner.name + " wins!", "Last one standing");
        }
        r.phase = Phase.ENDED;
        r.phaseStart = server.getTickCount();
        r.phaseEnd = r.phaseStart + 15 * 20L;
        r.bar.setColor(BossEvent.BossBarColor.YELLOW);
        r.bar.setName(Component.literal("Round over"));
        r.bar.setProgress(1f);
    }

    /** Ends the round, returns everyone to survival at world spawn. */
    private void finish() {
        Round r = round;
        round = null;
        r.bar.removeAllPlayers();
        ServerLevel overworld = server.overworld();
        BlockPos spawn = overworld.getSharedSpawnPos();
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            p.setGameMode(GameType.SURVIVAL);
            p.teleportTo(overworld, spawn.getX() + 0.5, spawn.getY(), spawn.getZ() + 0.5, p.getYRot(), 0);
            p.setHealth(p.getMaxHealth());
        }
    }

    // ---- Tick -----------------------------------------------------------------------------------------------

    @SubscribeEvent
    public void onServerTick(TickEvent.ServerTickEvent event) {
        if (event.phase != TickEvent.Phase.END || round == null) return;
        Round r = round;
        long now = server.getTickCount();

        if (r.phase == Phase.BUILD) {
            for (Participant part : r.participants.values()) {
                ServerPlayer p = server.getPlayerList().getPlayer(part.id);
                if (p != null && !part.eliminated) confine(p, part);
            }
        }

        if (now % 20 == 0) {
            expireDisconnects(r, now);
            if (round != r) return;
            if (r.phase == Phase.BUILD) {
                long left = Math.max(0, (r.phaseEnd - now) / 20);
                updateBar(r, left);
                if (left == 60 || left == 30 || left == 10 || (left > 0 && left <= 5))
                    broadcast(Component.literal("Borders fall in " + formatTime(left)).withStyle(ChatFormatting.YELLOW));
            } else if (r.phase == Phase.SURVIVAL) {
                updateBar(r, 0);
            }
        }
        if (r.phase == Phase.BUILD && now >= r.phaseEnd) beginSurvival();
        else if (r.phase == Phase.ENDED && now >= r.phaseEnd) finish();
    }

    private void expireDisconnects(Round r, long now) {
        for (Participant part : new ArrayList<>(r.participants.values())) {
            if (part.eliminated || part.disconnectDeadline < 0 || now < part.disconnectDeadline) continue;
            if (r.phase == Phase.SURVIVAL) {
                eliminate(part, Component.literal(part.name + " did not return in time and is out.")
                        .withStyle(ChatFormatting.RED));
            } else {
                part.eliminated = true;
                part.disconnectDeadline = -1;
                broadcast(Component.literal(part.name + " did not return in time and is out.")
                        .withStyle(ChatFormatting.RED));
            }
            if (round != r) return;
        }
    }

    /** Pushes a player back inside their cell. Height is never restricted. */
    private void confine(ServerPlayer p, Participant part) {
        ServerLevel level = server.getLevel(round.dimension);
        if (level == null) return;
        if (p.level().dimension() != round.dimension) {
            returnToSpawn(p, level, part);
            return;
        }
        if (p.getY() < level.getMinBuildHeight() - 10) {
            returnToSpawn(p, level, part);
            return;
        }
        double nx = Mth.clamp(p.getX(), part.minX + 0.3, part.maxX - 0.3);
        double nz = Mth.clamp(p.getZ(), part.minZ + 0.3, part.maxZ - 0.3);
        if (nx != p.getX() || nz != p.getZ()) {
            p.stopRiding();
            p.connection.teleport(nx, p.getY(), nz, p.getYRot(), p.getXRot());
            p.setDeltaMovement(Vec3.ZERO);
            p.hurtMarked = true;
        }
    }

    private void returnToSpawn(ServerPlayer p, ServerLevel level, Participant part) {
        prepareForBuild(p, level, part);
    }

    // ---- Player events --------------------------------------------------------------------------------------

    @SubscribeEvent
    public void onDeath(LivingDeathEvent event) {
        if (round == null || !(event.getEntity() instanceof ServerPlayer p)) return;
        Participant part = round.participants.get(p.getUUID());
        if (part == null || part.eliminated) return;

        if (round.phase == Phase.BUILD) {
            // Void or /kill during the build phase: put them back rather than ending their round.
            event.setCanceled(true);
            returnToSpawn(p, server.getLevel(round.dimension), part);
        } else if (round.phase == Phase.SURVIVAL) {
            event.setCanceled(true);
            Component message = p.getCombatTracker().getDeathMessage();
            p.getInventory().dropAll();
            p.removeAllEffects();
            p.clearFire();
            p.setHealth(p.getMaxHealth());
            eliminate(part, message.copy().withStyle(ChatFormatting.RED));
        }
    }

    /** No damage between creative-phase players (void is handled by confine()). */
    @SubscribeEvent
    public void onAttack(LivingAttackEvent event) {
        if (round == null || round.phase != Phase.BUILD || !(event.getEntity() instanceof ServerPlayer p)) return;
        if (round.participants.containsKey(p.getUUID())) event.setCanceled(true);
    }

    @SubscribeEvent
    public void onTravel(EntityTravelToDimensionEvent event) {
        if (round == null || round.phase != Phase.BUILD || !(event.getEntity() instanceof ServerPlayer p)) return;
        if (round.participants.containsKey(p.getUUID())) event.setCanceled(true);
    }

    @SubscribeEvent
    public void onBreak(BlockEvent.BreakEvent event) {
        if (!outsideOwnCell(event.getPlayer(), event.getPos())) return;
        event.setCanceled(true);
    }

    @SubscribeEvent
    public void onPlace(BlockEvent.EntityPlaceEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer p) || !outsideOwnCell(p, event.getPos())) return;
        event.setCanceled(true);
    }

    private boolean outsideOwnCell(net.minecraft.world.entity.player.Player player, BlockPos pos) {
        if (round == null || round.phase != Phase.BUILD) return false;
        Participant part = round.participants.get(player.getUUID());
        return part != null && !part.contains(pos);
    }

    /** Containers are filtered the first time they are opened in survival, covering chests built during creative. */
    @SubscribeEvent
    public void onContainerOpen(PlayerContainerEvent.Open event) {
        if (round == null || round.phase != Phase.SURVIVAL || !(event.getEntity() instanceof ServerPlayer p)) return;
        Container own = p.getInventory();
        List<Container> seen = new ArrayList<>();
        for (Slot slot : event.getContainer().slots) {
            if (slot.container != own && !seen.contains(slot.container)) seen.add(slot.container);
        }
        for (Container c : seen) round.filter.filter(c, null);
    }

    @SubscribeEvent
    public void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (round == null || !(event.getEntity() instanceof ServerPlayer p)) return;
        Participant part = round.participants.get(p.getUUID());
        round.bar.addPlayer(p);
        if (part == null) {
            p.setGameMode(GameType.SPECTATOR);
            p.sendSystemMessage(Component.literal("A round is in progress. You are spectating.").withStyle(ChatFormatting.YELLOW));
            return;
        }
        part.disconnectDeadline = -1;
        ServerLevel level = server.getLevel(round.dimension);
        if (part.eliminated) {
            p.setGameMode(GameType.SPECTATOR);
        } else if (round.phase == Phase.BUILD && level != null) {
            p.setGameMode(GameType.CREATIVE);
            confine(p, part);
            broadcast(Component.literal(part.name + " is back.").withStyle(ChatFormatting.GREEN));
        } else if (round.phase == Phase.SURVIVAL) {
            enterSurvival(p, part);
            broadcast(Component.literal(part.name + " is back.").withStyle(ChatFormatting.GREEN));
        }
    }

    @SubscribeEvent
    public void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        if (round == null || !(event.getEntity() instanceof ServerPlayer p)) return;
        round.bar.removePlayer(p);
        Participant part = round.participants.get(p.getUUID());
        if (part == null || part.eliminated || round.phase == Phase.ENDED) return;
        int seconds = ArenaConfig.RECONNECT_SECONDS.get();
        part.disconnectDeadline = server.getTickCount() + seconds * 20L;
        broadcast(Component.literal(part.name + " disconnected. " + seconds + "s to rejoin.").withStyle(ChatFormatting.YELLOW));
    }

    @SubscribeEvent
    public void onRegisterCommands(RegisterCommandsEvent event) {
        ArenaCommand.register(event.getDispatcher(), this);
    }

    @SubscribeEvent
    public void onServerStopping(ServerStoppingEvent event) {
        if (round != null) round.bar.removeAllPlayers();
        round = null;
    }

    // ---- Helpers --------------------------------------------------------------------------------------------

    private void updateBar(Round r, long buildSecondsLeft) {
        if (r.phase == Phase.BUILD) {
            long total = Math.max(1, (r.phaseEnd - r.phaseStart) / 20);
            r.bar.setName(Component.literal("Build phase: " + formatTime(buildSecondsLeft)));
            r.bar.setProgress(Mth.clamp(buildSecondsLeft / (float) total, 0f, 1f));
        } else if (r.phase == Phase.SURVIVAL) {
            r.bar.setName(Component.literal("Survival: " + r.aliveCount() + " alive"));
        }
    }

    private void broadcast(Component message) {
        server.getPlayerList().broadcastSystemMessage(message, false);
    }

    private void title(List<ServerPlayer> players, String title, String subtitle) {
        for (ServerPlayer p : players) {
            p.connection.send(new ClientboundSetTitlesAnimationPacket(10, 60, 20));
            p.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal(subtitle)));
            p.connection.send(new ClientboundSetTitleTextPacket(Component.literal(title).withStyle(ChatFormatting.GOLD)));
        }
    }

    static String formatTime(long seconds) {
        return String.format("%d:%02d", seconds / 60, seconds % 60);
    }
}
