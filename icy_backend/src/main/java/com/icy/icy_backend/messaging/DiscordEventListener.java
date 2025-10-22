package com.icy.icy_backend.messaging;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.News;
import com.icy.icy_backend.db.repository.NewsRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DiscordEventListener {

    private final NewsRepository newsRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 🔔 Écoute les événements RabbitMQ "news.discordLinked" envoyés par le bot.
     */
    @Transactional
    @RabbitListener(queues = "discord.event.queue")
    public void onDiscordLinkedEvent(Map<String, Object> message) {
        try {
            Long newsId = Long.valueOf(message.get("newsId").toString());
            Long messageId = Long.valueOf(message.get("messageId").toString());
            Long channelId = Long.valueOf(message.get("channelId").toString());

            log.info("📩 Événement Discord reçu pour newsId={} (msgId={}, channelId={})",
                    newsId, messageId, channelId);

            News news = newsRepository.findById(newsId)
                    .orElseThrow(() -> new ResourceNotFoundException("Actualité non trouvée (id=" + newsId + ")"));

            news.setDiscordMessageId(messageId);
            news.setDiscordChannelId(channelId);
            newsRepository.save(news);

            log.info("✅ News #{} mise à jour avec les infos Discord.", newsId);

        } catch (Exception e) {
            log.error("❌ Erreur lors du traitement de l’événement Discord : {}", e.getMessage(), e);
        }
    }

}
