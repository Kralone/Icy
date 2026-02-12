package com.icy.icy_backend.db.entity.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.icy.icy_backend.db.entity.ship.Ship;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.time.LocalDateTime;

@Entity
@Table(name = "users", schema = "core")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SQLRestriction( "active = true")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Column(nullable = false, unique = true)
    private String discordId;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.CONNECTE;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "favorite_ship_id")
    private Ship favoriteShip;

    @Column(nullable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserRole> roles = new HashSet<>();

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "pwd_reset", nullable = false)
    private Boolean pwdReset = false;

    public void assignDefaultRole(Role defaultRole) {
        UserRole userRole = new UserRole();
        userRole.setUser(this);
        userRole.setRole(defaultRole);
        this.roles.add(userRole);
    }
}






