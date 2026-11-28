package com.icy.icy_backend.security.companion;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Réglages de l'émetteur de jetons d'Icy Companion (OAuth2, connexion par navigateur avec PKCE).
 * <p>
 * Désactivé par défaut : tant que {@code enabled} vaut false, aucune adresse /api/oauth2/** n'existe et la
 * connexion du site reste exactement celle d'aujourd'hui (jetons HS256 de {@code JwtUtil}).
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "icy.companion-auth")
public class CompanionAuthProperties {

    /** Identifiant du client OAuth2 de l'application de bureau, et audience de ses jetons. */
    public static final String APP_CLIENT_ID = "icy-companion";
    /** Identifiant du client OAuth2 du service compagnon quand il appelle IceForge pour son propre compte. */
    public static final String SERVICE_CLIENT_ID = "icy-companion-service";
    /** Droit accordé au service compagnon sur /api/companion/**. */
    public static final String SERVICE_SCOPE = "iceforge.companion";

    private boolean enabled = false;

    /** Valeur du claim {@code iss}, vérifiée par le service compagnon. */
    private String issuer = "https://iceforge.fr";

    /**
     * Clé privée RSA de signature, au format PEM PKCS#8 (« BEGIN PRIVATE KEY »), rangée dans Vault.
     * Vide : une clé jetable est générée au démarrage (développement seulement, les jetons meurent au redémarrage).
     */
    private String signingKey = "";

    /** Identifiant de la clé ({@code kid}), à changer à chaque renouvellement de clé. */
    private String keyId = "iceforge-companion-1";

    /** Secret du client {@link #SERVICE_CLIENT_ID} (en clair, il est haché au démarrage). Vide : client désactivé. */
    private String serviceClientSecret = "";

    /** Durée de vie d'un jeton d'accès de l'app : la fenêtre maximale d'un membre exclu sans message RabbitMQ. */
    private Duration accessTokenTtl = Duration.ofMinutes(5);

    /** Durée de vie d'un refresh token de l'app, renouvelé (et remplacé) à chaque usage. */
    private Duration refreshTokenTtl = Duration.ofDays(7);

    /** Jeton d'accès du service compagnon. */
    private Duration serviceTokenTtl = Duration.ofMinutes(10);

    /**
     * Adresses de retour autorisées pour l'app. Pour une adresse de boucle locale (127.0.0.1), le port est
     * libre : l'app choisit un port au hasard à chaque connexion (RFC 8252).
     */
    private List<String> redirectUris = new ArrayList<>(List.of("http://127.0.0.1/callback"));
}
