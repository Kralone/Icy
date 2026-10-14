package com.icy.icy_backend.websocket;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Map;
import java.util.UUID;

/**
 * Toute écriture réussie sur une opération (/api/operations/{id}/…) prévient les fiches ouvertes.
 * Les services ont déjà validé leur transaction quand la réponse est écrite : la relecture voit le changement.
 */
@Configuration
public class OperationLiveUpdateInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    /** Résolu à l'usage : un contexte de test réduit au web n'a pas ce service, l'intercepteur s'y efface. */
    private final ObjectProvider<OperationLiveUpdateService> liveUpdates;

    public OperationLiveUpdateInterceptor(ObjectProvider<OperationLiveUpdateService> liveUpdates) {
        this.liveUpdates = liveUpdates;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/operations/*", "/api/operations/*/**");
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
        if (exception != null || "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod())) return;
        if (response.getStatus() >= 400) return;
        Object variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (!(variables instanceof Map<?, ?> map) || !(map.get("id") instanceof String id)) return;
        OperationLiveUpdateService service = liveUpdates.getIfAvailable();
        if (service == null) return;
        try {
            service.changed(UUID.fromString(id));
        } catch (IllegalArgumentException ignored) {
            // Pas un identifiant d'opération : rien à signaler.
        }
    }
}
