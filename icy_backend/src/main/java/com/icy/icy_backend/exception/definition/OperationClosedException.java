package com.icy.icy_backend.exception.definition;

/** L'heure de fin d'une opération publiée est passée : son organisation n'est plus modifiable. */
public class OperationClosedException extends RuntimeException {
    public OperationClosedException(String message) {
        super(message);
    }
}
