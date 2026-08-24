package com.icy.icy_backend.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    // === EXCHANGE PRINCIPAL ===
    public static final String EXCHANGE = "icy.exchange";

    // === ROUTING KEYS ===
    public static final String NEWS_ROUTING_KEY = "news.*";
    public static final String EVENTS_ROUTING_KEY = "events.*";
    public static final String USERS_ROUTING_KEY = "users.*";

    // === QUEUES SORTANTES (backend → bot) ===
    public static final String NEWS_QUEUE = "news.queue";
    public static final String EVENTS_QUEUE = "events.queue";

    // === QUEUES RETOUR (bot → backend) ===
    public static final String NEWS_DISCORD_LINKED_QUEUE = "news.discordLinked.queue";
    public static final String NEWS_DISCORD_LINKED_KEY = "news.discordLinked";

    public static final String EVENTS_DISCORD_LINKED_QUEUE = "events.discordLinked.queue";
    public static final String EVENTS_DISCORD_LINKED_KEY = "event.discordLinked";

    public static final String EVENTS_PARTICIPATION_QUEUE = "events.participation.queue";
    public static final String EVENTS_PARTICIPATION_KEY = "events.participation";

    public static final String USERS_QUEUE = "users.queue";

    // === EXCHANGE ===
    @Bean
    public TopicExchange icyExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    // === QUEUES SORTANTES (backend → bot) ===
    @Bean
    public Queue newsQueue() {
        return new Queue(NEWS_QUEUE, true);
    }

    @Bean
    public Queue eventsQueue() {
        return new Queue(EVENTS_QUEUE, true);
    }

    @Bean
    public Queue usersQueue() {
        return new Queue(USERS_QUEUE, true);
    }

    // === QUEUES RETOUR (bot → backend) ===
    @Bean
    public Queue newsDiscordLinkedQueue() {
        return new Queue(NEWS_DISCORD_LINKED_QUEUE, true);
    }

    @Bean
    public Queue eventsDiscordLinkedQueue() {
        return new Queue(EVENTS_DISCORD_LINKED_QUEUE, true);
    }

    @Bean
    public Queue eventsParticipationQueue() {
        return new Queue(EVENTS_PARTICIPATION_QUEUE, true);
    }

    // === BINDINGS SORTANTS ===
    @Bean
    public Binding newsBinding(Queue newsQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(newsQueue)
                .to(icyExchange)
                .with(NEWS_ROUTING_KEY);
    }

    @Bean
    public Binding eventsBinding(Queue eventsQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(eventsQueue)
                .to(icyExchange)
                .with(EVENTS_ROUTING_KEY);
    }

    // === BINDINGS RETOUR (bot → backend) ===
    @Bean
    public Binding newsDiscordLinkedBinding(Queue newsDiscordLinkedQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(newsDiscordLinkedQueue)
                .to(icyExchange)
                .with(NEWS_DISCORD_LINKED_KEY);
    }

    @Bean
    public Binding eventsDiscordLinkedBinding(Queue eventsDiscordLinkedQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(eventsDiscordLinkedQueue)
                .to(icyExchange)
                .with(EVENTS_DISCORD_LINKED_KEY);
    }

    @Bean
    public Binding eventsParticipationBinding(Queue eventsParticipationQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(eventsParticipationQueue)
                .to(icyExchange)
                .with(EVENTS_PARTICIPATION_KEY);
    }

    @Bean
    public Binding usersBinding(Queue usersQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(usersQueue)
                .to(icyExchange)
                .with(USERS_ROUTING_KEY);
    }

    // === CONVERTISSEUR JSON ===
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new JacksonJsonMessageConverter();
    }

    // === TEMPLATE RABBIT ===
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}
