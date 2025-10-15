package com.icy.icy_backend.exception.definition;

import org.springframework.http.HttpStatus;

/**
 * Exception levée lorsqu'un utilisateur tente d'accéder à une ressource
 * sans y être autorisé.
 */
public class ForbiddenException extends RuntimeException {

    private final HttpStatus status = HttpStatus.FORBIDDEN;

    public ForbiddenException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}
