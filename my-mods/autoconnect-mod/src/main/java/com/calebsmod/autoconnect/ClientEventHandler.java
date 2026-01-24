package com.calebsmod.autoconnect;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraftforge.client.event.ScreenEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileReader;

public class ClientEventHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(ClientEventHandler.class);
    private boolean hasConnected = false;
    private int tickDelay = 0;
    private static final int DELAY_TICKS = 20;

    @SubscribeEvent
    public void onScreenOpen(ScreenEvent.Opening event) {
        if (hasConnected) {
            return;
        }

        if (!(event.getScreen() instanceof TitleScreen)) {
            return;
        }

        if (tickDelay < DELAY_TICKS) {
            tickDelay++;
            return;
        }

        hasConnected = true;

        try {
            File configFile = new File(Minecraft.getInstance().gameDirectory, "config/autoconnect.json");
            
            if (!configFile.exists()) {
                LOGGER.warn("AutoConnect config file not found at: {}", configFile.getAbsolutePath());
                return;
            }

            JsonObject config = JsonParser.parseReader(new FileReader(configFile)).getAsJsonObject();
            
            if (!config.has("enabled") || !config.get("enabled").getAsBoolean()) {
                LOGGER.info("AutoConnect is disabled in config");
                return;
            }

            String serverAddress = config.get("serverAddress").getAsString();
            LOGGER.info("Attempting to connect to: {}", serverAddress);

            Minecraft minecraft = Minecraft.getInstance();
            ServerAddress address = ServerAddress.parseString(serverAddress);
            
            ServerData serverData = new ServerData("Caleb's Server", serverAddress, false);
            
            ConnectScreen.startConnecting(
                event.getScreen(),
                minecraft,
                address,
                serverData,
                false
            );

            LOGGER.info("Connection initiated successfully");

        } catch (Exception e) {
            LOGGER.error("Failed to auto-connect to server", e);
        }
    }
}
