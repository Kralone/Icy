package com.icy.icy_backend.service.member;

import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/** Grades d'IceForge, du plus haut au plus bas, et leurs libellés dans les messages. */
public final class MemberRanks {
    public static final List<String> ORDER = List.of("ADMIN", "OFFICIER", "SPECIALISTE", "INGENIEUR", "ASSOCIE", "JUNIOR");
    private static final Map<String, String> ALIASES = Map.of("USER", "JUNIOR", "MEMBRE", "JUNIOR", "RECRUE", "JUNIOR");
    private static final Map<String, String> LABELS = Map.of(
            "ADMIN", "Directeur", "OFFICIER", "Officier", "SPECIALISTE", "Spécialiste",
            "INGENIEUR", "Ingénieur", "ASSOCIE", "Associé", "JUNIOR", "Junior");

    private MemberRanks() {
    }

    public static List<String> roleNames(User user) {
        return user.getRoles() == null ? List.of() : user.getRoles().stream()
                .map(role -> role.getRole() == null ? null : role.getRole().getName())
                .filter(Objects::nonNull)
                .toList();
    }

    /** Grade le plus élevé du membre ; Junior par défaut. */
    public static String rank(User user) {
        return roleNames(user).stream()
                .map(name -> name.toUpperCase(Locale.ROOT))
                .map(name -> ALIASES.getOrDefault(name, name))
                .filter(ORDER::contains)
                .min((left, right) -> Integer.compare(ORDER.indexOf(left), ORDER.indexOf(right)))
                .orElse("JUNIOR");
    }

    public static String label(String rank) {
        return LABELS.getOrDefault(rank, rank);
    }

    public static String poleLabel(Specialty pole) {
        if (pole == null) return "";
        String name = pole.name().toLowerCase(Locale.ROOT);
        return Character.toUpperCase(name.charAt(0)) + name.substring(1);
    }
}
