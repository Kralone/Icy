package com.icy.icy_backend.service.member;

import com.icy.icy_backend.service.operation.OperationLock;
import com.icy.icy_backend.controller.dto.member.MemberActivityDtos;
import com.icy.icy_backend.db.entity.member.MessageTemplate;
import com.icy.icy_backend.db.entity.user.Specialty;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.MessageTemplateRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

/** Modèles des messages privés (rappel, bienvenue, promotions) et leur personnalisation pour un membre. */
@Service
public class MessageTemplateService {
    /** Limite Discord d'un message, une fois {pseudo} et les autres champs remplacés. */
    public static final int BODY_LIMIT = 1900;
    private static final Pattern MEDIA_NAME = Pattern.compile("^[A-Za-z0-9._-]{1,200}$");

    private final MessageTemplateRepository templates;
    private final String imageBaseUrl;

    public MessageTemplateService(MessageTemplateRepository templates,
                                  @Value("${icy.image.base-url:http://localhost:8088/images/}") String imageBaseUrl) {
        this.templates = templates;
        this.imageBaseUrl = imageBaseUrl.endsWith("/") ? imageBaseUrl : imageBaseUrl + "/";
    }

    @Transactional(readOnly = true)
    public List<MemberActivityDtos.Template> list() {
        return templates.findAllByOrderBySortOrderAscLabelAsc().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public MessageTemplate get(String code) {
        return templates.findById(code == null ? "" : code)
                .orElseThrow(() -> new ResourceNotFoundException("Modèle de message introuvable : " + code));
    }

    @Transactional
    public MemberActivityDtos.Template update(String code, MemberActivityDtos.TemplateUpdate request, String author) {
        MessageTemplate template = get(code);
        template.setBody(validBody(request == null ? null : request.body()));
        template.setMediaFile(validMedia(request.mediaFile()));
        template.setUpdatedAt(LocalDateTime.now(OperationLock.ZONE));
        template.setUpdatedBy(author);
        return toDto(templates.save(template));
    }

    /** Remplace {pseudo}, {grade} et {pôle}. Le pôle d'un modèle de Spécialiste vient de son code (…_INDUSTRIE). */
    public static String render(String body, User user, String templateCode) {
        Specialty pole = user.getSpecialty();
        if (templateCode != null) {
            for (Specialty candidate : Specialty.values()) {
                if (templateCode.endsWith("_" + candidate.name())) pole = candidate;
            }
        }
        String poleLabel = MemberRanks.poleLabel(pole);
        return (body == null ? "" : body)
                .replace("{pseudo}", user.getUsername() == null ? "" : user.getUsername())
                .replace("{grade}", MemberRanks.label(MemberRanks.rank(user)))
                .replace("{pôle}", poleLabel)
                .replace("{pole}", poleLabel);
    }

    public String mediaUrl(String mediaFile) {
        return mediaFile == null ? null : imageBaseUrl + URLEncoder.encode(mediaFile, StandardCharsets.UTF_8);
    }

    public static String validBody(String body) {
        if (body == null || body.isBlank()) throw new BadRequestException("Le message est vide.");
        if (body.length() > BODY_LIMIT) {
            throw new BadRequestException("Le message dépasse " + BODY_LIMIT + " caractères : Discord le refuserait une fois le pseudo ajouté.");
        }
        return body.strip();
    }

    public static String validMedia(String mediaFile) {
        if (mediaFile == null || mediaFile.isBlank()) return null;
        String name = mediaFile.strip();
        if (!MEDIA_NAME.matcher(name).matches() || name.startsWith(".")) {
            throw new BadRequestException("Choisissez un fichier de la bibliothèque d'images.");
        }
        return name;
    }

    private MemberActivityDtos.Template toDto(MessageTemplate template) {
        return new MemberActivityDtos.Template(template.getCode(), template.getCategory().name(), template.getLabel(), template.getBody(),
                template.getMediaFile(), mediaUrl(template.getMediaFile()), template.getUpdatedAt(), template.getUpdatedBy());
    }
}
