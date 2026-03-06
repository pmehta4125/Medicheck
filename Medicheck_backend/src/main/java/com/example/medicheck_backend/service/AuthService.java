package com.example.medicheck_backend.service;

import com.example.medicheck_backend.model.User;
import com.example.medicheck_backend.repository.UserRepository;
import com.example.medicheck_backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class AuthService {

    @Autowired
    private UserRepository repo;

    @Autowired
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public Map<String, Object> signup(User user) {
        if (repo.findByEmail(user.getEmail()) != null) {
            return Map.of("error", "Email already exists");
        }

        user.setPassword(encoder.encode(user.getPassword()));
        repo.save(user);

        return Map.of("message", "Signup successful");
    }

    public Map<String, Object> login(String email, String password) {
        User user = repo.findByEmail(email);
        if (user == null) {
            return Map.of("error", "User not found");
        }

        if (!encoder.matches(password, user.getPassword())) {
            return Map.of("error", "Invalid password");
        }

        String token = jwtUtil.generateToken(email);
        return Map.of(
                "token", token,
                "email", email,
                "name", user.getName()
        );
    }
}