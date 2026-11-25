package com.icy.icy_backend.exception.definition;

/** La ressource est encore référencée ailleurs : la suppression est refusée (HTTP 409). */
public class ResourceInUseException extends RuntimeException {
    public ResourceInUseException(String message) {
        super(message);
    }
}
