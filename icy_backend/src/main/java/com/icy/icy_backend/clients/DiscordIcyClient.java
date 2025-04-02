package com.icy.icy_backend.clients;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class DiscordIcyClient {

    private final WebClient webClient;

    public DiscordIcyClient(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("http://localhost:8090").build(); // À adapter en prod
    }

    public void sendTemporaryPassword(Long discordId, String tempPassword) {
        webClient.post()
                .uri("/notify-password")
                .bodyValue(Map.of("discordId", 190174996235026433L, "tempPassword", tempPassword))
                .retrieve()
                .bodyToMono(Void.class)
                .subscribe();
    }
}
