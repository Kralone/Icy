package com.icy.icy_backend.service.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserTutorialDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserTutorialRequest;
import com.icy.icy_backend.db.entity.user.UserTutorial;
import com.icy.icy_backend.db.entity.user.UserTutorialStatus;
import com.icy.icy_backend.db.entity.user.id.UserTutorialId;
import com.icy.icy_backend.db.repository.user.UserTutorialRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class UserTutorialService {
    private static final Pattern TUTORIAL_ID = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final int MAX_TUTORIAL_ID_LENGTH = 64;
    private static final int MAX_VERSION = 1000;

    private final UserTutorialRepository userTutorialRepository;
    private final MessageService messageService;

    public UserTutorialService(UserTutorialRepository userTutorialRepository, MessageService messageService) {
        this.userTutorialRepository = userTutorialRepository;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UserTutorialDTO>>> getTutorials(UUID userId) {
        List<UserTutorialDTO> tutorials = userTutorialRepository.findByUserIdOrderByTutorialIdAsc(userId).stream()
                .map(UserTutorialDTO::from)
                .toList();
        return messageService.buildResponse("user.tutorial.list", tutorials);
    }

    @Transactional
    public ResponseEntity<MessageResponse<UserTutorialDTO>> saveTutorial(UUID userId, String tutorialId, UpdateUserTutorialRequest request) {
        if (tutorialId == null || tutorialId.length() > MAX_TUTORIAL_ID_LENGTH || !TUTORIAL_ID.matcher(tutorialId).matches()) {
            return messageService.buildResponse("user.tutorial.invalid", null, "identifiant de tutoriel inconnu");
        }
        if (request == null || request.getVersion() == null || request.getVersion() < 1 || request.getVersion() > MAX_VERSION) {
            return messageService.buildResponse("user.tutorial.invalid", null, "version invalide");
        }
        UserTutorialStatus status = parseStatus(request.getStatus());
        if (status == null) {
            return messageService.buildResponse("user.tutorial.invalid", null, "statut invalide");
        }

        UserTutorial tutorial = userTutorialRepository.findById(new UserTutorialId(userId, tutorialId))
                .orElseGet(() -> {
                    UserTutorial created = new UserTutorial();
                    created.setUserId(userId);
                    created.setTutorialId(tutorialId);
                    return created;
                });
        tutorial.setVersion(request.getVersion());
        tutorial.setStatus(status);
        tutorial.setUpdatedAt(LocalDateTime.now());
        return messageService.buildResponse("user.tutorial.saved", UserTutorialDTO.from(userTutorialRepository.save(tutorial)));
    }

    private static UserTutorialStatus parseStatus(String value) {
        if (value == null) return null;
        for (UserTutorialStatus status : UserTutorialStatus.values()) {
            if (status.name().equals(value)) return status;
        }
        return null;
    }
}
