package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.entity.EventParticipation;
import com.icy.icy_backend.db.entity.EventType;
import com.icy.icy_backend.db.repository.EventParticipationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class EventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final EventParticipationRepository participationRepository;

    public void publishEventCreated(Event event) {
        sendEventMessage("events.created", event);
    }

    public void publishEventUpdated(Event event) {
        sendEventMessage("events.updated", event);
    }

    public void publishEventDeleted(Event event) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("eventId", event.getId());
        payload.put("channelId", event.getDiscordChannelId());
        payload.put("messageId", event.getDiscordMessageId());
        rabbitTemplate.convertAndSend("icy.exchange", "events.deleted", payload);
        log.info("📤 Event supprimé publié (id={})", event.getId());
    }

    private void sendEventMessage(String routingKey, Event event) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", event.getId());
        payload.put("title", event.getTitle());
        payload.put("description", event.getDescription());
        payload.put("author", event.getCreator() != null ? event.getCreator().getUsername() : "Inconnu");
        payload.put("date", event.getStartDateTime().toString());

        // ✅ Ajout des IDs Discord pour les updates
        payload.put("channelId", event.getDiscordChannelId());
        payload.put("messageId", event.getDiscordMessageId());

        // 🎨 Type d’événement
        EventType type = event.getType();
        if (type != null) {
            Map<String, Object> typeInfo = new HashMap<>();
            typeInfo.put("name", type.getName());
            typeInfo.put("textColor", type.getTextColor());
            typeInfo.put("color", type.getBackgroundColor());
            typeInfo.put("imageUrl", type.getImageUrl());
            payload.put("type", typeInfo);
        }

        // 👥 Participants
        List<EventParticipation> participations = participationRepository.findAllByEvent(event)
                .orElse(List.of());
        List<Map<String, Object>> participantData = participations.stream()
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("username", p.getUser().getUsername());
                    m.put("status", p.getStatus());
                    return m;
                })
                .collect(Collectors.toList());
        payload.put("participants", participantData);

        rabbitTemplate.convertAndSend("icy.exchange", routingKey, payload);
        log.info("📤 Événement RabbitMQ envoyé : {} ({})", routingKey, event.getTitle());
    }

    public void publishEventEnded(Event event) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", event.getId());
        payload.put("title", event.getTitle());
        payload.put("channelId", event.getDiscordChannelId());
        payload.put("messageId", event.getDiscordMessageId());

        rabbitTemplate.convertAndSend("icy.exchange", "events.ended", payload);
    }

    public void sendGeneric(String routingKey, Map<String, Object> payload) {
        rabbitTemplate.convertAndSend("icy.exchange", routingKey, payload);
        log.info("📤 Message RabbitMQ envoyé ({}) : {}", routingKey, payload);
    }

}
