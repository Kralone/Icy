package com.icy.icy_backend.security;

import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.user.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.FilterChain;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void skipsWhenNoAuthorizationHeader() throws Exception {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        UserService userService = Mockito.mock(UserService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtUtil, userService);

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = Mockito.mock(FilterChain.class);

        filter.doFilter(request, response, filterChain);
        verify(filterChain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void injectsAuthenticationForValidToken() throws Exception {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        UserService userService = Mockito.mock(UserService.class);
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtUtil, userService);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = Mockito.mock(FilterChain.class);

        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getSubjectFromToken("token")).thenReturn("alice");
        when(jwtUtil.extractRoles("token")).thenReturn(List.of("ADMIN"));

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername("alice");
        user.setPassword("secret");
        when(userService.getByUsername("alice")).thenReturn(user);

        filter.doFilter(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isInstanceOf(UserAuthDetails.class);
        verify(filterChain).doFilter(request, response);
    }
}
