package com.icy.icy_backend.service.image;

import com.icy.icy_backend.db.entity.image.ImageCategory;
import com.icy.icy_backend.db.entity.image.ImageMetadata;
import com.icy.icy_backend.db.entity.image.ImageSubcategory;
import com.icy.icy_backend.db.repository.image.ImageCategoryRepository;
import com.icy.icy_backend.db.repository.image.ImageMetadataRepository;
import com.icy.icy_backend.db.repository.image.ImageSubcategoryRepository;
import com.icy.icy_backend.db.repository.image.ImageTagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ImageServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void uploadStoresFileAndMetadata() throws Exception {
        ImageMetadataRepository repo = Mockito.mock(ImageMetadataRepository.class);
        ImageTagRepository tagRepo = Mockito.mock(ImageTagRepository.class);
        ImageCategoryRepository categoryRepo = Mockito.mock(ImageCategoryRepository.class);
        ImageSubcategoryRepository subcategoryRepo = Mockito.mock(ImageSubcategoryRepository.class);

        when(repo.save(any(ImageMetadata.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(categoryRepo.existsById("cat")).thenReturn(false);
        when(subcategoryRepo.existsByCategoryNameAndName("cat", "sub")).thenReturn(false);

        ImageService service = new ImageService(repo, tagRepo, categoryRepo, subcategoryRepo, tempDir.toString());

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test.png",
                "image/png",
                "data".getBytes()
        );

        ImageMetadata saved = service.upload(
                file,
                UUID.randomUUID(),
                "alice",
                List.of("tag1"),
                "cat",
                "sub",
                null
        );

        assertThat(saved.getName()).isEqualTo("test.png");
        assertThat(saved.getCategory()).isEqualTo("cat");
        assertThat(saved.getSubcategory()).isEqualTo("sub");
    }

    @Test
    void listSubcategoriesReturnsEmptyForBlankCategory() throws Exception {
        ImageMetadataRepository repo = Mockito.mock(ImageMetadataRepository.class);
        ImageTagRepository tagRepo = Mockito.mock(ImageTagRepository.class);
        ImageCategoryRepository categoryRepo = Mockito.mock(ImageCategoryRepository.class);
        ImageSubcategoryRepository subcategoryRepo = Mockito.mock(ImageSubcategoryRepository.class);

        ImageService service = new ImageService(repo, tagRepo, categoryRepo, subcategoryRepo, tempDir.toString());

        assertThat(service.listSubcategories(" ")).isEmpty();
        assertThat(service.listSubcategories(null)).isEmpty();
    }
}
