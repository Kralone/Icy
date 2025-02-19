package com.icy.icy_backend.service.rest;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import java.text.MessageFormat;

import java.util.Locale;

@Service
public class MessageService {

    private final MessageSource messageSource;

    public MessageService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }


    private String getMessage(String key, Object... args) {
        String template = messageSource.getMessage(key, null, Locale.getDefault());
        return MessageFormat.format(template, args);
    }

    private int getHttpCode(String key) {
        return Integer.parseInt(getMessage(key));
    }

    private int getErrorCode(String key) {
        return Integer.parseInt(getMessage(key));
    }

    private HttpStatus getHttpStatus(String key) {
        return HttpStatus.valueOf(getHttpCode(key));
    }

    /**
     * Génère une réponse avec un message par défaut depuis `messages.properties`.
     */
    public <T> ResponseEntity<MessageResponse<T>> buildResponse(String baseKey, T data) {
        return buildResponse(baseKey, data, null); // Appelle la méthode avec un message personnalisé à `null`
    }

    /**
     * Génère une réponse avec un message personnalisé si fourni, sinon utilise le message par défaut.
     */
    public <T> ResponseEntity<MessageResponse<T>> buildResponse(String baseKey, T data, Object... args) {
        HttpStatus status = getHttpStatus(baseKey + ".http");
        int errorCode = Integer.parseInt(getMessage(baseKey + ".code"));

        // Utilise le message personnalisé si fourni, sinon récupère et formate le message par défaut
        String messageText = getMessage(baseKey + ".message", args);

        MessageResponse<T> response = new MessageResponse<>(
                status,
                getMessage(baseKey + ".title"),
                messageText,
                errorCode,
                data
        );

        return ResponseEntity.status(status).body(response);
    }

}
