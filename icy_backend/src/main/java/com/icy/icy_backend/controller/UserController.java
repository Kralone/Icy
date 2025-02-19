package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.CreateUserRequest;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<MessageResponse<User>> getUserByDiscordId(@PathVariable Long discordId) {
        return userService.getUserByDiscordId(discordId);
    }

    @PostMapping("/create")
    public ResponseEntity<MessageResponse<User>>createUser(@RequestBody CreateUserRequest createUserRequest) {
        return userService.createUser(createUserRequest.getUsername(), createUserRequest.getDiscordId());
    }

    @DeleteMapping
    public ResponseEntity<MessageResponse<Void>> deleteUserByDiscordId(@RequestParam Long discordId) {
        return userService.deactivateUser(discordId);
    }
}
