package com.icy.icy_backend.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    // === CONSTANTES GÉNÉRIQUES ===
    public static final String EXCHANGE = "icy.exchange";
    public static final String NEWS_QUEUE = "news.queue";
    public static final String NEWS_ROUTING_KEY = "news.created";


    public static final String DISCORD_QUEUE = "discord.event.queue";
    public static final String DISCORD_ROUTING_KEY = "news.discordLinked";

    // === CONFIG EXCHANGE / QUEUE ===
    @Bean
    public TopicExchange icyExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    public Queue newsQueue() {
        return new Queue(NEWS_QUEUE, true);
    }

    @Bean
    public Queue discordEventQueue() {
        return new Queue(DISCORD_QUEUE, true);
    }


    @Bean
    public Binding newsBinding(Queue newsQueue, TopicExchange icyExchange) {
        return BindingBuilder.bind(newsQueue).to(icyExchange).with(NEWS_ROUTING_KEY);
    }

    @Bean
    public Binding discordEventBinding(Queue discordEventQueue, TopicExchange icyExchange) {
        return BindingBuilder
                .bind(discordEventQueue)
                .to(icyExchange)
                .with(DISCORD_ROUTING_KEY);
    }

    // === CONVERTISSEUR JSON ===
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    // === TEMPLATE RABBIT ===
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}
