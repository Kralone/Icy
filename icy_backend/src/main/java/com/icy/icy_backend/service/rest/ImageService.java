package com.icy.icy_backend.service.rest;

import com.icy.icy_backend.db.entity.ImageMetadata;
import com.icy.icy_backend.db.repository.ImageMetadataRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class ImageService {

    private final Path root;
    private final ImageMetadataRepository repo;

    @Value("${icy.image.base-url:http://localhost:8081/images/}")
    private String imageBaseUrl;

    public ImageService(ImageMetadataRepository repo,
                        @Value("${icy.image.path:images}") String imagePath) throws IOException {

        this.repo = repo;
        this.root = Paths.get(imagePath).toAbsolutePath().normalize();

        if (!Files.exists(root)) {
            Files.createDirectories(root);
            log.info("📁 Répertoire d’images créé : {}", root.toAbsolutePath());
        } else {
            log.info("📁 Utilisation du répertoire d’images : {}", root.toAbsolutePath());
        }
    }

    public ImageMetadata upload(MultipartFile file, UUID uploaderId, String uploadedBy) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Nom de fichier invalide.");
        }

        Path destination = root.resolve(filename);
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        log.info("📸 Image uploadée sur disque : {}", destination);

        ImageMetadata meta = ImageMetadata.builder()
                .name(filename)
                .url(imageBaseUrl + filename)
                .size(file.getSize())
                .uploadedAt(LocalDateTime.now())
                .uploaderId(uploaderId)
                .uploadedBy(uploadedBy)
                .build();

        return repo.save(meta);
    }

    public List<ImageMetadata> listAll() {
        return repo.findAll();
    }

    public Resource getImage(String filename) {
        try {
            Path file = root.resolve(filename);
            Resource resource = new UrlResource(file.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Image non trouvée : " + filename);
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("Image non trouvée : " + filename);
        }
    }

    public void delete(String filename) throws IOException {
        ImageMetadata meta = repo.findByName(filename)
                .orElseThrow(() -> new ResourceNotFoundException("Image non trouvée : " + filename));

        Path file = root.resolve(filename);
        if (Files.exists(file)) {
            Files.delete(file);
            log.info("🗑️ Fichier supprimé : {}", filename);
        }

        repo.delete(meta);
        log.info("🧹 Métadonnée supprimée : {}", meta.getId());
    }
}
