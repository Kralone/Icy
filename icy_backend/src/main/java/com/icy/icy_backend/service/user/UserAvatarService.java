package com.icy.icy_backend.service.user;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.image.ImageService;
import com.icy.icy_backend.service.image.ImageContentValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class UserAvatarService {
    private static final long MAX_FILE_SIZE = 2_000_000;
    private static final Map<String, Set<String>> ALLOWED_EXTENSIONS = Map.of(
            "image/jpeg", Set.of(".jpg", ".jpeg"),
            "image/jpg", Set.of(".jpg", ".jpeg"),
            "image/png", Set.of(".png"),
            "image/webp", Set.of(".webp")
    );

    private final Path avatarRoot;
    private final String baseUrl;
    private final ImageService imageService;

    public UserAvatarService(@Value("${icy.image.path:images}") String imagePath,
                             @Value("${icy.image.base-url:http://localhost:8081/images/}") String imageBaseUrl,
                             ImageService imageService) throws IOException {
        this.avatarRoot = Paths.get(imagePath, "avatars").toAbsolutePath().normalize();
        this.baseUrl = ensureTrailingSlash(imageBaseUrl) + "avatars/";
        this.imageService = imageService;

        if (!Files.exists(avatarRoot)) {
            Files.createDirectories(avatarRoot);
            log.info("📁 Répertoire d’avatars créé : {}", avatarRoot.toAbsolutePath());
        } else {
            log.info("📁 Utilisation du répertoire d’avatars : {}", avatarRoot.toAbsolutePath());
        }
    }

    public String storeAvatar(User user, MultipartFile file) throws IOException {
        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT);
        Set<String> extensions = ALLOWED_EXTENSIONS.get(contentType);
        if (extensions == null) {
            throw new IllegalArgumentException("Format d'image non supporte.");
        }
        String extension = switch (contentType) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> throw new IllegalArgumentException("Format d'image non supporte.");
        };
        String validationName = user.getId() + extension;
        ImageContentValidator.validate(file, validationName, ALLOWED_EXTENSIONS, MAX_FILE_SIZE);

        String filename = validationName;
        Path destination = avatarRoot.resolve(filename);

        deletePreviousAvatar(user, filename);

        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        log.info("🧊 Avatar enregistre : {}", destination);

        String url = baseUrl + URLEncoder.encode(filename, StandardCharsets.UTF_8);
        imageService.registerExistingImage(
                "avatars/" + filename,
                url,
                file.getSize(),
                user.getId(),
                user.getUsername(),
                List.of("avatar"),
                "Avatar",
                null,
                Map.of()
        );

        return url;
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
        imageService.deleteMetadataIfExists("avatars/" + existingFilename);
    }

    private String ensureTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.endsWith("/") ? value : value + "/";
    }
}
