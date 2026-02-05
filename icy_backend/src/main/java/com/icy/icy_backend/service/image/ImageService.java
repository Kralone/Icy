package com.icy.icy_backend.service.image;

import com.icy.icy_backend.db.entity.image.ImageCategory;
import com.icy.icy_backend.db.entity.image.ImageMetadata;
import com.icy.icy_backend.db.entity.image.ImageSubcategory;
import com.icy.icy_backend.db.entity.image.ImageTag;
import com.icy.icy_backend.db.repository.image.ImageCategoryRepository;
import com.icy.icy_backend.db.repository.image.ImageMetadataRepository;
import com.icy.icy_backend.db.repository.image.ImageSubcategoryRepository;
import com.icy.icy_backend.db.repository.image.ImageTagRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ImageService {

    private static final String DEFAULT_TAG_COLOR = "#22d3ee";

    private final Path root;
    private final ImageMetadataRepository repo;
    private final ImageTagRepository tagRepo;
    private final ImageCategoryRepository categoryRepo;
    private final ImageSubcategoryRepository subcategoryRepo;

    @Value("${icy.image.base-url:http://localhost:8081/images/}")
    private String imageBaseUrl;

    public ImageService(ImageMetadataRepository repo,
                        ImageTagRepository tagRepo,
                        ImageCategoryRepository categoryRepo,
                        ImageSubcategoryRepository subcategoryRepo,
                        @Value("${icy.image.path:images}") String imagePath) throws IOException {

        this.repo = repo;
        this.tagRepo = tagRepo;
        this.categoryRepo = categoryRepo;
        this.subcategoryRepo = subcategoryRepo;
        this.root = Paths.get(imagePath).toAbsolutePath().normalize();

        if (!Files.exists(root)) {
            Files.createDirectories(root);
            log.info("📁 Répertoire d’images créé : {}", root.toAbsolutePath());
        } else {
            log.info("📁 Utilisation du répertoire d’images : {}", root.toAbsolutePath());
        }
    }

    public ImageMetadata upload(MultipartFile file,
                                UUID uploaderId,
                                String uploadedBy,
                                List<String> tags,
                                String category,
                                String subcategory,
                                Map<String, String> tagColors) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Nom de fichier invalide.");
        }

        // 🔧 Nettoyage basique du nom (remplace espaces et caractères spéciaux)
        String safeName = originalFilename
                .replaceAll("\\s+", "_")      // espaces → underscores
                .replaceAll("[^a-zA-Z0-9._-]", ""); // supprime caractères interdits

        // 📁 Enregistre le fichier
        Path destination = root.resolve(safeName);
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        log.info("📸 Image uploadée sur disque : {}", destination);

        // 🌐 URL propre
        String url = imageBaseUrl + URLEncoder.encode(safeName, StandardCharsets.UTF_8);

        String safeCategory = normalize(category);
        String safeSubcategory = normalize(subcategory);
        upsertCategory(safeCategory);
        upsertSubcategory(safeCategory, safeSubcategory);

        List<String> safeTags = tags == null ? List.of() : tags;
        upsertTagColors(safeTags, tagColors);

        ImageMetadata meta = ImageMetadata.builder()
                .name(safeName)
                .url(url)
                .size(file.getSize())
                .uploadedAt(LocalDateTime.now())
                .uploaderId(uploaderId)
                .uploadedBy(uploadedBy)
                .category(safeCategory)
                .subcategory(safeSubcategory)
                .tags(safeTags)
                .build();

        return repo.save(meta);
    }


    public List<ImageMetadata> listAll() {
        return repo.findAll();
    }

    public List<String> listCategories() {
        return categoryRepo.findAll().stream()
                .map(ImageCategory::getName)
                .sorted(String::compareToIgnoreCase)
                .collect(Collectors.toList());
    }

    public List<String> listSubcategories(String category) {
        String safeCategory = normalize(category);
        if (safeCategory == null) {
            return List.of();
        }
        return subcategoryRepo.findByCategoryNameOrderByNameAsc(safeCategory).stream()
                .map(ImageSubcategory::getName)
                .collect(Collectors.toList());
    }

    public List<ImageTag> listTags() {
        return tagRepo.findAll();
    }

    public void upsertTagColors(Map<String, String> tagColors) {
        upsertTagColors(List.of(), tagColors);
    }

    private void upsertTagColors(List<String> tags, Map<String, String> tagColors) {
        if (tags == null) {
            tags = List.of();
        }
        if (tagColors != null) {
            for (Map.Entry<String, String> entry : tagColors.entrySet()) {
                String name = entry.getKey();
                String color = entry.getValue();
                if (name == null || name.isBlank() || color == null || color.isBlank()) {
                    continue;
                }
                tagRepo.save(ImageTag.builder().name(name).color(color).build());
            }
        }
        for (String tag : tags) {
            Optional<ImageTag> existing = tagRepo.findById(tag);
            if (existing.isEmpty()) {
                tagRepo.save(ImageTag.builder().name(tag).color(DEFAULT_TAG_COLOR).build());
            }
        }
    }

    public void createCategory(String name) {
        String safeName = normalize(name);
        if (safeName == null) {
            return;
        }
        if (!categoryRepo.existsById(safeName)) {
            categoryRepo.save(ImageCategory.builder().name(safeName).build());
        }
    }

    public void createSubcategory(String category, String subcategory) {
        String safeCategory = normalize(category);
        String safeSubcategory = normalize(subcategory);
        if (safeCategory == null || safeSubcategory == null) {
            return;
        }
        createCategory(safeCategory);
        if (!subcategoryRepo.existsByCategoryNameAndName(safeCategory, safeSubcategory)) {
            subcategoryRepo.save(ImageSubcategory.builder()
                    .categoryName(safeCategory)
                    .name(safeSubcategory)
                    .build());
        }
    }

    private void upsertCategory(String category) {
        if (category == null) {
            return;
        }
        createCategory(category);
    }

    private void upsertSubcategory(String category, String subcategory) {
        if (category == null || subcategory == null) {
            return;
        }
        createSubcategory(category, subcategory);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
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

    public ImageMetadata updateMetadata(UUID id,
                                        String category,
                                        String subcategory,
                                        List<String> tags,
                                        Map<String, String> tagColors) {
        ImageMetadata meta = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Image non trouvée : " + id));

        String safeCategory = normalize(category);
        String safeSubcategory = normalize(subcategory);
        upsertCategory(safeCategory);
        upsertSubcategory(safeCategory, safeSubcategory);

        List<String> safeTags = tags == null ? List.of() : tags;
        upsertTagColors(safeTags, tagColors);

        meta.setCategory(safeCategory);
        meta.setSubcategory(safeSubcategory);
        meta.setTags(safeTags);

        return repo.save(meta);
    }
}




