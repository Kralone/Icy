package com.icy.icy_backend.websocket;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Map;

/**
 * Toute écriture réussie sur SC World Events (événement, type, participation) prévient les pages ouvertes.
 * Le message ne porte rien d'autre que l'heure : chaque page relit ce que son lecteur a le droit de voir.
 * Les services ont déjà validé leur transaction quand la réponse est écrite : la relecture voit le changement.
 */
@Configuration
public class ScWorldEventLiveUpdateInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    static final String DESTINATION = "/topic/sc-world-events";
    /** Résolu à l'usage : un contexte de test réduit au web n'a pas de courtier STOMP, l'intercepteur s'y efface. */
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplate;

    public ScWorldEventLiveUpdateInterceptor(ObjectProvider<SimpMessagingTemplate> messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/sc-world-events", "/api/sc-world-events/**",
                "/api/sc-world-event-types", "/api/sc-world-event-types/**");
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        if (exception != null || response.getStatus() >= 400) return;
        String method = request.getMethod();
        if ("GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method)) return;
        SimpMessagingTemplate template = messagingTemplate.getIfAvailable();
        if (template == null) return;
        template.convertAndSend(DESTINATION, (Object) Map.of("timestamp", System.currentTimeMillis()));
    }
}
