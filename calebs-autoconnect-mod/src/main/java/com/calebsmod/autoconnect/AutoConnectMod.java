package com.calebsmod.autoconnect;

import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Mod("autoconnect")
public class AutoConnectMod {
    public static final String MOD_ID = "autoconnect";
    private static final Logger LOGGER = LoggerFactory.getLogger(AutoConnectMod.class);

    public AutoConnectMod() {
        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::clientSetup);
        LOGGER.info("Caleb's AutoConnect Mod initialized");
    }

    private void clientSetup(FMLClientSetupEvent event) {
        MinecraftForge.EVENT_BUS.register(new ClientEventHandler());
        LOGGER.info("Client event handler registered");
    }
}
