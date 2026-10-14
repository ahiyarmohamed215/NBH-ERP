package com.nbh.erp.common.validation;

import com.nbh.erp.common.exception.BusinessException;
import org.springframework.util.StringUtils;
import java.util.Set;
import java.util.function.Predicate;

/** Shared lifecycle rules for inventory master records. */
public final class MasterRecordLifecycle {
    private MasterRecordLifecycle() {}

    public static String initialStatus(String requested) {
        String status = requested == null ? "ACTIVE" : requested;
        if (!Set.of("DRAFT", "ACTIVE").contains(status)) throw new BusinessException("New records must be draft or active");
        return status;
    }

    public static String targetStatus(String requested) {
        if (requested == null || !Set.of("DRAFT", "ACTIVE", "INACTIVE").contains(requested)) throw new BusinessException("Invalid record status");
        return requested;
    }

    public static String clean(String value) { return StringUtils.hasText(value) ? value.trim() : null; }

    public static void validate(String type, String status, String name, Object... inputs) {
        if (!"DRAFT".equals(status) && !StringUtils.hasText(name)) throw new BusinessException(type + " name is required before activation");
        if ("DRAFT".equals(status) && !StringUtils.hasText(name)) {
            for (Object input : inputs) if (input != null && StringUtils.hasText(input.toString())) return;
            throw new BusinessException("Fill at least one input before saving a draft");
        }
    }

    public static String code(String value, String prefix, long count, Predicate<String> exists) {
        if (StringUtils.hasText(value)) return value.trim().toUpperCase(java.util.Locale.ROOT);
        String code;
        do { code = String.format("%s-%05d", prefix, ++count); } while (exists.test(code));
        return code;
    }
}
