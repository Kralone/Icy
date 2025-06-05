package com.icy.icy_backend.clients;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Slf4j
@Service
public class DiscordIcyClient {

    private final WebClient webClient;

    public DiscordIcyClient(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("http://bot:8090").build(); // À adapter en prod
    }

    public void sendTemporaryPassword(String discordId, String tempPassword) {
        log.error(discordId + " " + tempPassword);
        webClient.post()
                .uri("/notify-password")
                .bodyValue(Map.of("discordId", discordId, "tempPassword", tempPassword))
                .retrieve()
                .bodyToMono(Void.class)
                .subscribe();
    }
}
