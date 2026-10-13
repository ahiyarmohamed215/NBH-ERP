package com.nbh.erp.common.validation;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;
@Target({ElementType.FIELD,ElementType.PARAMETER,ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy=PhoneValidator.class)
public @interface ValidPhone {
 String message() default "Enter a valid contact number with its country calling code";
 Class<?>[] groups() default {};
 Class<? extends Payload>[] payload() default {};
}
