package com.icy.icy_backend.db.entity.user;

import java.util.Arrays;

public enum UserStatus {
    CONNECTE("connecte"),
    EN_JEU("enjeu"),
    ABSENT("absent"),
    INDISPONIBLE("indisponible"),
    HORS_LIGNE("horsligne");

    private final String apiValue;

    UserStatus(String apiValue) {
        this.apiValue = apiValue;
    }

    public String toApiValue() {
        return apiValue;
    }

    public static UserStatus fromApiValue(String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(status -> status.apiValue.equalsIgnoreCase(value) || status.name().equalsIgnoreCase(value))
                .findFirst()
                .orElse(null);
    }
}
