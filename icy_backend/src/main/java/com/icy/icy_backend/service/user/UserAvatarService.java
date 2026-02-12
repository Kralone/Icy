package com.icy.icy_backend.service.user;

import com.icy.icy_backend.db.entity.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Map;

@Slf4j
@Service
public class UserAvatarService {
    private static final long MAX_FILE_SIZE = 1_000_000;
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/jpg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp"
    );

    private final Path avatarRoot;
    private final String baseUrl;

    public UserAvatarService(@Value("${icy.image.path:images}") String imagePath,
                             @Value("${icy.image.base-url:http://localhost:8081/images/}") String imageBaseUrl) throws IOException {
        this.avatarRoot = Paths.get(imagePath, "avatars").toAbsolutePath().normalize();
        this.baseUrl = ensureTrailingSlash(imageBaseUrl) + "avatars/";

        if (!Files.exists(avatarRoot)) {
            Files.createDirectories(avatarRoot);
            log.info("📁 Répertoire d’avatars créé : {}", avatarRoot.toAbsolutePath());
        } else {
            log.info("📁 Utilisation du répertoire d’avatars : {}", avatarRoot.toAbsolutePath());
        }
    }

    public String storeAvatar(User user, MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Fichier trop lourd (max 1 Mo).");
        }

        String contentType = file.getContentType();
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) {
            throw new IllegalArgumentException("Format d'image non supporte.");
        }

        String filename = user.getId() + extension;
        Path destination = avatarRoot.resolve(filename);

        deletePreviousAvatar(user, filename);

        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        log.info("🧊 Avatar enregistre : {}", destination);

        return baseUrl + URLEncoder.encode(filename, StandardCharsets.UTF_8);
    }

    private void deletePreviousAvatar(User user, String newFilename) throws IOException {
        String existingUrl = user.getAvatarUrl();
        if (existingUrl == null || existingUrl.isBlank()) {
            return;
        }
        int idx = existingUrl.lastIndexOf('/');
        String existingFilename = idx >= 0 ? existingUrl.substring(idx + 1) : existingUrl;
        if (existingFilename.isBlank() || existingFilename.equals(newFilename)) {
            return;
        }
        Path existingPath = avatarRoot.resolve(existingFilename);
        if (Files.exists(existingPath)) {
            Files.delete(existingPath);
            log.info("🗑️ Ancien avatar supprime : {}", existingFilename);
        }
    }

    private String ensureTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.endsWith("/") ? value : value + "/";
    }
}
