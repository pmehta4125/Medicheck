package com.example.medicheck_backend.service;

import com.example.medicheck_backend.model.User;
import com.example.medicheck_backend.repository.UserRepository;
import com.example.medicheck_backend.security.JwtUtil;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserRepository repo;

    @Autowired
    private JwtUtil jwtUtil;

    @Value("${google.client-id}")
    private String googleClientId;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public Map<String, Object> signup(User user) {
        if (user.getEmail() == null || user.getPassword() == null || user.getName() == null) {
            return Map.of("error", "Name, email, and password are required");
        }

        String normalizedEmail = user.getEmail().trim().toLowerCase();

        if (repo.findByEmailIgnoreCase(normalizedEmail) != null) {
            return Map.of("error", "Email already exists");
        }

        user.setEmail(normalizedEmail);
        user.setPassword(encoder.encode(user.getPassword()));
        repo.save(user);

        return Map.of("message", "Signup successful");
    }

    public Map<String, Object> login(String email, String password) {
        if (email == null || password == null) {
            return Map.of("error", "Email and password are required");
        }

        User user = repo.findByEmailIgnoreCase(email.trim());
        if (user == null) {
            return Map.of("error", "User not found");
        }

        boolean passwordMatches = false;

        // Support legacy plaintext rows and migrate them on successful login.
        if (user.getPassword() != null && user.getPassword().startsWith("$2")) {
            passwordMatches = encoder.matches(password, user.getPassword());
        } else if (user.getPassword() != null && user.getPassword().equals(password)) {
            passwordMatches = true;
            user.setPassword(encoder.encode(password));
            repo.save(user);
        }

        if (!passwordMatches) {
            return Map.of("error", "Invalid password");
        }

        String token = jwtUtil.generateToken(user.getEmail());
        return Map.of(
                "token", token,
                "email", user.getEmail(),
                "name", user.getName()
        );
    }

    public Map<String, Object> googleLogin(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            return Map.of("error", "Google token is required");
        }

        if (googleClientId == null || googleClientId.isBlank() || googleClientId.contains("REPLACE_WITH")) {
            return Map.of("error", "Google login is not configured on server");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    JacksonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken googleIdToken = verifier.verify(idToken);
            if (googleIdToken == null) {
                return Map.of("error", "Invalid Google token");
            }

            GoogleIdToken.Payload payload = googleIdToken.getPayload();
            String email = payload.getEmail();
            if (email == null || email.isBlank()) {
                return Map.of("error", "Google account email is unavailable");
            }

            String normalizedEmail = email.trim().toLowerCase();
            String name = (String) payload.get("name");

            User user = repo.findByEmailIgnoreCase(normalizedEmail);
            if (user == null) {
                user = new User();
                user.setEmail(normalizedEmail);
                user.setName(name != null && !name.isBlank() ? name : "Google User");
                user.setPassword(encoder.encode(UUID.randomUUID().toString()));
                repo.save(user);
            } else if ((user.getName() == null || user.getName().isBlank()) && name != null && !name.isBlank()) {
                user.setName(name);
                repo.save(user);
            }

            String token = jwtUtil.generateToken(user.getEmail());
            return Map.of(
                    "token", token,
                    "email", user.getEmail(),
                    "name", user.getName()
            );
        } catch (GeneralSecurityException | IOException | IllegalArgumentException e) {
            return Map.of("error", "Unable to verify Google token");
        }
    }
}