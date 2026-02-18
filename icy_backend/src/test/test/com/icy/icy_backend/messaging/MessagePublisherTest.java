package com.icy.icy_backend.messaging;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.mockito.Mockito.verify;

class MessagePublisherTest {

    @Test
    void publishSendsThroughRabbitTemplate() {
        RabbitTemplate rabbitTemplate = Mockito.mock(RabbitTemplate.class);
        MessagePublisher publisher = new MessagePublisher(rabbitTemplate);

        publisher.publish("ex", "rk", "payload");
        verify(rabbitTemplate).convertAndSend("ex", "rk", "payload");
    }
}
