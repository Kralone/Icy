package com.icy.icy_backend.controller.dto.response;

import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

import java.time.Instant;

@Getter
@Setter
public class MessageResponse<T> {
    // ✅ Retourne le bon statut HTTP
    private HttpStatus httpStatus; // ✅ Le vrai statut HTTP de la réponse
    private String title;
    private int httpCode;
    private String timestamp;
    private MessageDetail messageDetail;
    private int code;
    private int type;
    private T data;

    public MessageResponse(HttpStatus httpStatus, String title, String message, int code, T data) {
        this.httpStatus = httpStatus; // ✅ On stocke directement le bon statut HTTP
        this.httpCode = httpStatus.value();
        this.timestamp = Instant.now().toString();
        this.messageDetail = new MessageDetail(title, message);
        this.code = code;
        this.type = code / 1000; // ✅ Déduction automatique du type
        this.data = data;
    }

    private static class MessageDetail {
        private String title;
        private String message;

        public MessageDetail(String title, String message) {
            this.title = title;
            this.message = message;
        }

        public String getTitle() {
            return title;
        }

        public String getMessage() {
            return message;
        }
    }
}
