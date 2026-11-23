package com.icy.icy_backend.controller.dto.pole;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class PoleDtos {
    private PoleDtos() {
    }

    /** Un pôle et ses Spécialistes référents. */
    public record Pole(String key, List<Specialist> specialists) {
    }

    public record Specialist(UUID id, String username, String avatarUrl) {
    }

    /**
     * Accueil d'un pôle. canManage dit si le membre connecté gère ce pôle ;
     * activity est vide pour un pôle qui n'a pas encore d'activité à montrer.
     */
    public record Home(String key, List<Specialist> specialists, boolean canManage,
                       List<Stat> stats, List<Activity> activity, List<Agenda> agenda, List<Goal> goals, List<News> news) {
    }

    /** Objectif principal rattaché au pôle. current et target cumulent ses étapes quand il en a. */
    public record Goal(Long id, String name, long current, long target, boolean completed) {
    }

    /** Événement ou opération à venir rattaché au pôle. kind vaut EVENT ou OPERATION ; imageUrl peut manquer. */
    public record Agenda(UUID id, String kind, String title, String type, String imageUrl,
                         LocalDateTime startDateTime, LocalDateTime endDateTime) {
    }

    /** Un chiffre du pôle ; le libellé est porté par l'interface, à partir de key. */
    public record Stat(String key, long value) {
    }

    /** Une activité récente du pôle. kind donne sa nature (MINING_SHEET, SALVAGE_SHEET, EVENT, OPERATION), id l'objet à ouvrir ; status ne vaut que pour une fiche. */
    public record Activity(String kind, UUID id, String name, LocalDate date, String status) {
    }

    public record News(Long id, String title, String content, String authorName,
                       LocalDateTime createdAt, LocalDateTime updatedAt) {
    }

    public record NewsRequest(String title, String content) {
    }
}
