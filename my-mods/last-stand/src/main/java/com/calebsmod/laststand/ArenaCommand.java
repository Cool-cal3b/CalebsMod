package com.calebsmod.laststand;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

/** /arena start|forcestart [seconds], /arena skipbuild, /arena stop, /arena status. Operators only. */
final class ArenaCommand {
    static void register(CommandDispatcher<CommandSourceStack> dispatcher, RoundManager manager) {
        dispatcher.register(Commands.literal("arena")
                .requires(src -> src.hasPermission(2))
                .then(startNode("start", false, manager))
                .then(startNode("forcestart", true, manager))
                .then(Commands.literal("skipbuild").executes(c -> reply(c, manager.skipBuild())))
                .then(Commands.literal("stop").executes(c -> reply(c, manager.stop())))
                .then(Commands.literal("status").executes(c -> reply(c, manager.status()))));
    }

    private static com.mojang.brigadier.builder.LiteralArgumentBuilder<CommandSourceStack> startNode(
            String name, boolean force, RoundManager manager) {
        return Commands.literal(name)
                .executes(c -> begin(c, ArenaConfig.BUILD_SECONDS.get(), force, manager))
                .then(Commands.argument("seconds", IntegerArgumentType.integer(10, 3600))
                        .executes(c -> begin(c, IntegerArgumentType.getInteger(c, "seconds"), force, manager)));
    }

    private static int begin(CommandContext<CommandSourceStack> c, int seconds, boolean force, RoundManager manager) {
        ServerPlayer host = c.getSource().getPlayer();
        if (host == null) return reply(c, "Run this as a player: the arena is centred on where you stand.");
        return reply(c, manager.start(host, seconds, force));
    }

    /** A null message means the action succeeded and has already announced itself. */
    private static int reply(CommandContext<CommandSourceStack> c, String message) {
        if (message == null) return 1;
        c.getSource().sendSystemMessage(Component.literal(message));
        return 0;
    }

    private ArenaCommand() {}
}
