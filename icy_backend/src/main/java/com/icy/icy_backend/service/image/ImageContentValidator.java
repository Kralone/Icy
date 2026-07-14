package com.icy.icy_backend.service.image;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class ImageContentValidator {
    private static final int SIGNATURE_LENGTH = 32;

    private ImageContentValidator() {
    }

    public static void validate(MultipartFile file,
                                String filename,
                                Map<String, Set<String>> allowedExtensions,
                                long maxFileSize) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Fichier vide.");
        }
        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("Fichier trop lourd.");
        }

        String contentType = file.getContentType();
        String normalizedType = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        Set<String> extensions = allowedExtensions.get(normalizedType);
        String normalizedName = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        if (extensions == null || extensions.stream().noneMatch(normalizedName::endsWith)) {
            throw new IllegalArgumentException("Format d'image non supporté ou extension incohérente.");
        }

        byte[] signature;
        try (var input = file.getInputStream()) {
            signature = input.readNBytes(SIGNATURE_LENGTH);
        }
        if (!matchesSignature(normalizedType, signature)) {
            throw new IllegalArgumentException("Le contenu du fichier ne correspond pas à une image valide.");
        }
    }

    private static boolean matchesSignature(String contentType, byte[] bytes) {
        return switch (contentType) {
            case "image/png" -> startsWith(bytes, new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
            case "image/jpeg", "image/jpg" -> startsWith(bytes, new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
            case "image/gif" -> startsWith(bytes, "GIF87a".getBytes(StandardCharsets.US_ASCII))
                    || startsWith(bytes, "GIF89a".getBytes(StandardCharsets.US_ASCII));
            case "image/webp" -> asciiEquals(bytes, 0, "RIFF") && asciiEquals(bytes, 8, "WEBP");
            case "image/avif" -> asciiEquals(bytes, 4, "ftyp")
                    && (asciiEquals(bytes, 8, "avif") || asciiEquals(bytes, 8, "avis"));
            default -> false;
        };
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static boolean asciiEquals(byte[] bytes, int offset, String expected) {
        byte[] value = expected.getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < offset + value.length) {
            return false;
        }
        for (int i = 0; i < value.length; i++) {
            if (bytes[offset + i] != value[i]) {
                return false;
            }
        }
        return true;
    }
}
