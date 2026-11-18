package com.calebsmod.laststand;

import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.config.ModConfig;

@Mod(LastStandMod.MOD_ID)
public class LastStandMod {
    public static final String MOD_ID = "laststand";

    public LastStandMod() {
        ModLoadingContext.get().registerConfig(ModConfig.Type.COMMON, ArenaConfig.SPEC);
        MinecraftForge.EVENT_BUS.register(new RoundManager());
    }
}
