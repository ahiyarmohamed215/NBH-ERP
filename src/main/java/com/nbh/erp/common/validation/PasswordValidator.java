package com.nbh.erp.common.validation;

import com.nbh.erp.common.exception.BusinessException;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class PasswordValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 100;

    private static final Pattern HAS_LOWERCASE = Pattern.compile("[a-z]");
    private static final Pattern HAS_UPPERCASE = Pattern.compile("[A-Z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");
    private static final Pattern HAS_SPECIAL = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~`]");

    // Common breached or weak passwords frequently flagged by Google/Chrome
    private static final Set<String> BREACHED_OR_COMMON_PASSWORDS = Set.of(
            "password", "password123", "password1234", "password123!", "p@ssword", "p@ssword123",
            "12345678", "123456789", "1234567890", "12345678!",
            "admin123", "admin1234", "admin123!", "administrator",
            "qwerty123", "qwertyuiop", "welcome123", "welcome123!",
            "letmein123", "changeme123", "iloveyou123", "pass1234", "pass1234!",
            "monkey123", "dragon123", "master123", "sunshine123", "princess123"
    );

    private PasswordValidator() {
    }

    /**
     * Validates password against strong security standards and common breach patterns.
     * Throws BusinessException with specific guidance if validation fails.
     */
    public static void validate(String password, String username, String email) {
        if (password == null || password.isBlank()) {
            throw new BusinessException("Password is required.");
        }

        if (password.length() < MIN_LENGTH) {
            throw new BusinessException("Password must be at least " + MIN_LENGTH + " characters long.");
        }

        if (password.length() > MAX_LENGTH) {
            throw new BusinessException("Password cannot exceed " + MAX_LENGTH + " characters.");
        }

        if (!HAS_LOWERCASE.matcher(password).find()) {
            throw new BusinessException("Password must contain at least one lowercase letter (a-z).");
        }

        if (!HAS_UPPERCASE.matcher(password).find()) {
            throw new BusinessException("Password must contain at least one uppercase letter (A-Z).");
        }

        if (!HAS_DIGIT.matcher(password).find()) {
            throw new BusinessException("Password must contain at least one number (0-9).");
        }

        if (!HAS_SPECIAL.matcher(password).find()) {
            throw new BusinessException("Password must contain at least one special character (!@#$%^&*...).");
        }

        String lowerPassword = password.toLowerCase(Locale.ROOT);

        // Check if password contains the username
        if (username != null && username.trim().length() >= 3) {
            String lowerUsername = username.trim().toLowerCase(Locale.ROOT);
            if (lowerPassword.contains(lowerUsername)) {
                throw new BusinessException("Password cannot contain your username.");
            }
        }

        // Check if password contains the email handle (part before @)
        if (email != null && email.contains("@")) {
            String emailPrefix = email.split("@")[0].trim().toLowerCase(Locale.ROOT);
            if (emailPrefix.length() >= 3 && lowerPassword.contains(emailPrefix)) {
                throw new BusinessException("Password cannot contain parts of your email address.");
            }
        }

        // Check common breached passwords list
        if (BREACHED_OR_COMMON_PASSWORDS.contains(lowerPassword)) {
            throw new BusinessException("This password is commonly breached or too simple. Please choose a more secure, unique password.");
        }
    }

    /**
     * Checks if password meets the baseline complexity requirements.
     */
    public static boolean isStrong(String password) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            return false;
        }
        return HAS_LOWERCASE.matcher(password).find()
                && HAS_UPPERCASE.matcher(password).find()
                && HAS_DIGIT.matcher(password).find()
                && HAS_SPECIAL.matcher(password).find();
    }
}
