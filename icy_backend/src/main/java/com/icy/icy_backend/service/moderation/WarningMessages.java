package com.icy.icy_backend.service.moderation;

import com.icy.icy_backend.db.entity.moderation.MemberWarning;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Textes des messages privés de discipline. L'interface reprend la même formulation pour son aperçu :
 * une modification ici doit être reportée dans member-warnings.messages.ts.
 */
public final class WarningMessages {
    static final int AMBER = 0xFBBF24;
    static final int ORANGE = 0xFB923C;
    static final int RED = 0xF87171;
    static final int GREEN = 0x34D399;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH);
    private static final String FOOTER = "IceForge Industries · Direction";
    private static final String CONTACT = "Si tu veux en parler, contacte un officier ou la direction sur Discord.";

    private WarningMessages() {
    }

    /** 1er, 2e, 3e… */
    public static String ordinal(int rank) {
        return rank == 1 ? "1er" : rank + "e";
    }

    public static int color(int rank, int threshold) {
        if (rank >= threshold) return RED;
        if (rank == threshold - 1) return ORANGE;
        return AMBER;
    }

    /** Ce qui attend le membre après cet avertissement. */
    public static String consequence(int rank, int threshold) {
        if (rank >= threshold) {
            return "C'est ton " + ordinal(rank) + " avertissement : la direction va décider de ton exclusion de la corporation.";
        }
        if (rank == threshold - 1) {
            return "C'est ton " + ordinal(rank) + " avertissement. Au prochain, la direction décidera de ton exclusion de la corporation.";
        }
        return "C'est ton " + ordinal(rank) + " avertissement sur " + threshold + ". Au " + ordinal(threshold)
                + ", la direction décide de ton exclusion de la corporation.";
    }

    public static ModerationMessage warning(MemberWarning warning, int threshold) {
        String description = "La direction d'IceForge t'adresse un avertissement.\n\n"
                + "**Motif : " + warning.getCategory().label() + "**\n"
                + quote(warning.getReason()) + "\n\n"
                + consequence(warning.getRank(), threshold) + "\n\n"
                + CONTACT;
        return new ModerationMessage("⚠️ " + capitalize(ordinal(warning.getRank())) + " avertissement",
                description, color(warning.getRank(), threshold), FOOTER + " · " + date(warning.getCreatedAt()));
    }

    public static ModerationMessage revoked(MemberWarning warning, String reason, long remaining) {
        StringBuilder description = new StringBuilder("La direction a levé ton avertissement du ")
                .append(date(warning.getCreatedAt())).append(" (").append(warning.getCategory().label()).append(").");
        if (reason != null && !reason.isBlank()) description.append("\n\n").append(quote(reason));
        description.append("\n\n").append(remaining == 0
                ? "Tu n'as plus d'avertissement en cours."
                : "Il te reste " + remaining + " avertissement" + (remaining > 1 ? "s" : "") + " en cours.");
        return new ModerationMessage("✅ Avertissement levé", description.toString(), GREEN, FOOTER);
    }

    public static ModerationMessage excluded(long warnings, String note) {
        StringBuilder description = new StringBuilder("Après ").append(warnings)
                .append(" avertissements, la direction a décidé de t'exclure de la corporation IceForge. Ton accès au site est fermé.");
        if (note != null && !note.isBlank()) description.append("\n\n").append(quote(note));
        description.append("\n\nPour toute question, contacte la direction.");
        return new ModerationMessage("Exclusion de la corporation", description.toString(), RED, FOOTER);
    }

    public static ModerationMessage kept(long warnings, String note) {
        StringBuilder description = new StringBuilder("La direction a examiné tes ").append(warnings)
                .append(" avertissements et te laisse une dernière chance.");
        if (note != null && !note.isBlank()) description.append("\n\n").append(quote(note));
        description.append("\n\nUn nouvel avertissement relancera la décision d'exclusion.\n\n").append(CONTACT);
        return new ModerationMessage("Dernière chance", description.toString(), ORANGE, FOOTER);
    }

    /** Citation Discord sur chaque ligne, pour que le texte saisi reste distinct du message. */
    static String quote(String text) {
        return "> " + text.strip().replace("\n", "\n> ");
    }

    private static String date(LocalDateTime value) {
        return value == null ? "" : value.format(DATE);
    }

    private static String capitalize(String value) {
        return value.isEmpty() ? value : Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }
}
