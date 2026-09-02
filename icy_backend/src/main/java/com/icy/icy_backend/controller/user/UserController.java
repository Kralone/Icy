package com.icy.icy_backend.controller.user;

import com.icy.icy_backend.controller.dto.user.CreateUserRequest;
import com.icy.icy_backend.controller.dto.user.UpdateUserRequest;
import com.icy.icy_backend.controller.dto.user.UpdateUserProfileRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserOnlineResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserProfileResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserQuickStatsResponseDTO;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.security.UserManagementPolicy;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.io.IOException;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    private final UserService userService;
    private final MessageService messageService;

    public UserController(UserService userService, MessageService messageService) {
        this.userService = userService;
        this.messageService = messageService;
    }

    @GetMapping("/{discordId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<User>> getUserByDiscordId(@PathVariable String discordId) {
        return userService.getUserByDiscordId(discordId);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/create")
    public ResponseEntity<MessageResponse<User>>createUser(@RequestBody CreateUserRequest createUserRequest) {
        UserManagementPolicy.assertCanManage(null, createUserRequest.getRole());
        return userService.createUser(createUserRequest.getUsername(), createUserRequest.getDiscordId(), createUserRequest.getRole());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/update")
    public ResponseEntity<MessageResponse<User>> updateUser(@RequestBody UpdateUserRequest request) {
        UserManagementPolicy.assertCanManage(userService.resolveUser(request.getId()), request.getRole());
        return userService.updateUser(request.getId(), request.getUsername(), request.getDiscordId(), request.getRole());
    }


    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/by-id")
    public ResponseEntity<MessageResponse<Void>> deleteUserById(@RequestParam UUID id) {
        User target = userService.resolveUser(id);
        UserManagementPolicy.assertCanManage(target, null);
        return userService.deactivateUser(target);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/by-discord")
    public ResponseEntity<MessageResponse<Void>> deleteUserByDiscordId(@RequestParam Long discordId) {
        User target = userService.resolveUser(discordId);
        UserManagementPolicy.assertCanManage(target, null);
        return userService.deactivateUser(target);
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<UserResponseDTO>>> getAllUsers() {
        return userService.getAllActiveUsers();
    }

    @GetMapping("/online")
    public ResponseEntity<MessageResponse<List<UserOnlineResponseDTO>>> getOnlineUsers() {
        return userService.getOnlineUsers();
    }

    @GetMapping("/me/profile")
    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> getMyProfile() {
        return userService.getCurrentUserProfile(AuthUtils.getCurrentUserId());
    }

    @GetMapping("/me/stats")
    public ResponseEntity<MessageResponse<UserQuickStatsResponseDTO>> getMyQuickStats() {
        return userService.getCurrentUserQuickStats(AuthUtils.getCurrentUserId());
    }

    @PatchMapping("/me/profile")
    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> updateMyProfile(@RequestBody UpdateUserProfileRequest request) {
        return userService.updateCurrentUserProfile(AuthUtils.getCurrentUserId(), request);
    }

    @PostMapping("/me/activity")
    public ResponseEntity<MessageResponse<Void>> touchMyActivity() {
        return userService.touchCurrentUserActivity(AuthUtils.getCurrentUserId());
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MessageResponse<UserProfileResponseDTO>> uploadAvatar(@RequestParam("file") MultipartFile file) throws IOException {
        try {
            return userService.updateUserAvatar(AuthUtils.getCurrentUserId(), file);
        } catch (IllegalArgumentException ex) {
            return messageService.buildResponse("user.avatar.invalid", null, ex.getMessage());
        }
    }
}






