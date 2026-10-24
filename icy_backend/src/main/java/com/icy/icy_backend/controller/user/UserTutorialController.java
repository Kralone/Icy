package com.icy.icy_backend.controller.user;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserTutorialDTO;
import com.icy.icy_backend.controller.dto.user.UpdateUserTutorialRequest;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.user.UserTutorialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Tutoriels d'interface déjà vus par le joueur connecté. */
@RestController
@RequestMapping("/api/users/me/tutorials")
public class UserTutorialController {
    private final UserTutorialService userTutorialService;

    public UserTutorialController(UserTutorialService userTutorialService) {
        this.userTutorialService = userTutorialService;
    }

    @GetMapping
    public ResponseEntity<MessageResponse<List<UserTutorialDTO>>> getMyTutorials() {
        return userTutorialService.getTutorials(AuthUtils.getCurrentUserId());
    }

    @PutMapping("/{tutorialId}")
    public ResponseEntity<MessageResponse<UserTutorialDTO>> saveMyTutorial(@PathVariable String tutorialId, @RequestBody UpdateUserTutorialRequest request) {
        return userTutorialService.saveTutorial(AuthUtils.getCurrentUserId(), tutorialId, request);
    }
}
