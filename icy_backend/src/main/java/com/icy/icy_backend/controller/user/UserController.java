package com.icy.icy_backend.controller.user;

import com.icy.icy_backend.controller.dto.user.CreateUserRequest;
import com.icy.icy_backend.controller.dto.user.UpdateUserRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.user.UserResponseDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.user.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{discordId}")
    public ResponseEntity<MessageResponse<User>> getUserByDiscordId(@PathVariable String discordId) {
        return userService.getUserByDiscordId(discordId);
    }

    @PostMapping("/create")
    public ResponseEntity<MessageResponse<User>>createUser(@RequestBody CreateUserRequest createUserRequest) {
        return userService.createUser(createUserRequest.getUsername(), createUserRequest.getDiscordId(), createUserRequest.getRole());
    }

    @PutMapping("/update")
    public ResponseEntity<MessageResponse<User>> updateUser(@RequestBody UpdateUserRequest request) {
        return userService.updateUser(request.getId(), request.getUsername(), request.getDiscordId(), request.getRole());
    }


    @DeleteMapping("/by-id")
    public ResponseEntity<MessageResponse<Void>> deleteUserById(@RequestParam UUID id) {
        return userService.deactivateUser(userService.resolveUser(id));
    }

    @DeleteMapping("/by-discord")
    public ResponseEntity<MessageResponse<Void>> deleteUserByDiscordId(@RequestParam Long discordId) {
        return userService.deactivateUser(userService.resolveUser(discordId));
    }

    @GetMapping("/all")
    public ResponseEntity<MessageResponse<List<UserResponseDTO>>> getAllUsers() {
        return userService.getAllActiveUsers();
    }
}






