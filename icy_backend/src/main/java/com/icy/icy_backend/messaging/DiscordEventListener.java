package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.entity.News;
import com.icy.icy_backend.db.repository.EventRepository;
import com.icy.icy_backend.db.repository.NewsRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DiscordEventListener {

    private final NewsRepository newsRepository;
    private final EventRepository eventRepository;

    /**
     * 🔔 Écoute tous les événements de lien Discord → BDD (news, events, etc.)
     * On ne gère ici que les associations messageId/channelId.
     */
    @Transactional
    @RabbitListener(queues = {
            "discord.event.queue",
            "events.discordLinked.queue"
    })
    public void onDiscordLinked(Map<String, Object> message) {
        try {
            if (message.containsKey("newsId")) {
                handleNewsLink(message);
            } else if (message.containsKey("eventId")) {
                handleEventLink(message);
            } else {
                log.warn("⚠️ Message Discord non reconnu : {}", message);
            }
        } catch (Exception e) {
            log.error("❌ Erreur lors du lien Discord : {}", e.getMessage(), e);
        }
    }

    // === 📰 News → Discord ===
    private void handleNewsLink(Map<String, Object> message) {
        Long newsId = Long.valueOf(message.get("newsId").toString());
        Long messageId = Long.valueOf(message.get("messageId").toString());
        Long channelId = Long.valueOf(message.get("channelId").toString());

        News news = newsRepository.findById(newsId)
                .orElseThrow(() -> new ResourceNotFoundException("News introuvable (id=" + newsId + ")"));

        news.setDiscordMessageId(messageId);
        news.setDiscordChannelId(channelId);
        newsRepository.save(news);

        log.info("✅ News #{} liée à Discord (msg={}, channel={})", newsId, messageId, channelId);
    }

    // === 📅 Event → Discord ===
    private void handleEventLink(Map<String, Object> message) {
        UUID eventId = UUID.fromString(message.get("eventId").toString());
        String messageId = message.get("messageId").toString();
        String channelId = message.get("channelId").toString();

        Optional<Event> opt = eventRepository.findById(eventId);
        if (opt.isEmpty()) {
            log.warn("⚠️ Event introuvable (id={})", eventId);
            return;
        }

        Event event = opt.get();
        event.setDiscordMessageId(messageId);
        event.setDiscordChannelId(channelId);
        eventRepository.save(event);

        log.info("✅ Event #{} lié à Discord (msg={}, channel={})", eventId, messageId, channelId);
    }
}
