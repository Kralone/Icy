package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventPublisherTest {

    @Test
    void publishEventCreatedSendsPayload() {
        RabbitTemplate rabbitTemplate = Mockito.mock(RabbitTemplate.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        EventPublisher publisher = new EventPublisher(rabbitTemplate, participationRepository);

        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setTitle("Event");
        event.setDescription("Desc");
        event.setStartDateTime(LocalDateTime.now());
        EventType type = new EventType();
        type.setName("Type");
        event.setType(type);

        User user = new User();
        user.setUsername("alice");
        EventParticipation participation = new EventParticipation();
        participation.setUser(user);
        participation.setStatus(1);
        when(participationRepository.findAllByEvent(event)).thenReturn(Optional.of(List.of(participation)));

        publisher.publishEventCreated(event);

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(rabbitTemplate).convertAndSend(eq("icy.exchange"), eq("events.created"), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue()).isInstanceOfAny(java.util.Map.class);
    }
}
