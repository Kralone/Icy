package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import com.icy.icy_backend.db.entity.News;
import com.icy.icy_backend.db.entity.NewsType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service centralisé pour publier des événements RabbitMQ liés aux actualités (News).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NewsMessagingService {

    private final MessagePublisher publisher;

    /**
     * 🔵 Envoie un message "news.created" vers RabbitMQ.
     */
    public void sendNewsCreated(News news) {
        if (news == null || news.getType() == null) {
            log.warn("Impossible d’envoyer un message RabbitMQ : News ou type null");
            return;
        }

        publisher.publish(
                RabbitConfig.EXCHANGE,
                MessageTopic.NEWS_CREATED.getRoutingKey(),
                buildNewsPayload(news)
        );

        log.info("📤 Message 'news.created' envoyé pour la news id={}", news.getId());
    }

    public void sendNewsUpdated(News news) {
        if (news == null || news.getType() == null) {
            log.warn("Impossible d’envoyer un message RabbitMQ : News ou type null");
            return;
        }

        Map<String, Object> typeMap = new HashMap<>();
        typeMap.put("name", news.getType().getName());
        typeMap.put("color", news.getType().getColor());
        typeMap.put("imageUrl", news.getType().getImageUrl());

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", news.getId());
        payload.put("title", news.getTitle());
        payload.put("content", news.getContent());
        payload.put("author", news.getAuthor());
        payload.put("type", typeMap);
        payload.put("channelId", news.getDiscordChannelId());
        payload.put("messageId", news.getDiscordMessageId());

        publisher.publish(
                RabbitConfig.EXCHANGE,
                "news.updated",
                payload
        );

        log.info("Message RabbitMQ 'news.updated' envoyé pour la news id={}", news.getId());
    }



    /**
     * 🔴 Envoie un message "news.deleted" pour que le bot supprime le message Discord.
     */
    public void sendNewsDeleted(News news) {
        if (news == null) {
            log.warn("Impossible d’envoyer un message RabbitMQ : News null");
            return;
        }

        if (news.getDiscordMessageId() == null || news.getDiscordChannelId() == null) {
            log.info("ℹ️ News id={} sans message Discord associé, aucun envoi RabbitMQ", news.getId());
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("newsId", news.getId());
        payload.put("messageId", news.getDiscordMessageId());
        payload.put("channelId", news.getDiscordChannelId());

        publisher.publish(
                RabbitConfig.EXCHANGE,
                MessageTopic.NEWS_DELETED.getRoutingKey(),
                payload
        );

        log.info("📤 Message 'news.deleted' envoyé pour la news id={}", news.getId());
    }

    // 🧱 Construction du corps du message pour news.created
    private static Map<String, Object> buildNewsPayload(News news) {
        NewsType type = news.getType();

        return Map.of(
                "id", news.getId(),
                "title", news.getTitle(),
                "content", news.getContent(),
                "author", news.getAuthor(),
                "type", Map.of(
                        "name", type.getName(),
                        "color", type.getColor(),
                        "imageUrl", type.getImageUrl()
                ),
                "createdAt", news.getCreatedAt().toString()
        );
    }
}
