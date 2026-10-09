package com.nbh.erp.common.handler;

import com.nbh.erp.common.dto.ApiResponse;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.exception.DuplicateResourceException;
import com.nbh.erp.common.exception.InsufficientStockException;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.config.RequestIdFilter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFound(ResourceNotFoundException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Resource not found: {}", reqId, ex.getMessage());
        String userMsg = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage()
                : "The requested information could not be found.";
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(userMsg, "NOT_FOUND", reqId));
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiResponse<Void>> handleRouteNotFound(Exception ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Endpoint not found: {}", reqId, ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("The requested information could not be found.", "NOT_FOUND", reqId));
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiResponse<Void>> handleInsufficientStock(InsufficientStockException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Stock constraint violation: {}", reqId, ex.getMessage());
        String msg = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage()
                : "Insufficient stock available for this operation.";
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.error(msg, "INSUFFICIENT_STOCK", reqId));
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateResource(DuplicateResourceException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Duplicate resource: {}", reqId, ex.getMessage());
        String msg = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage()
                : "The record already exists. Please verify and try again.";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(msg, "DUPLICATE_RESOURCE", reqId));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Business rule error: {}", reqId, ex.getMessage());
        String msg = (ex.getMessage() != null && !ex.getMessage().isBlank())
                ? ex.getMessage()
                : "Unable to process this request. Please review the details and try again.";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(msg, "BUSINESS_RULE_VIOLATION", reqId));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Authentication failure: {}", reqId, ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Invalid username or password", "INVALID_CREDENTIALS", reqId));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Access denied: {}", reqId, ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("You don't have permission to perform this action.", "FORBIDDEN", reqId));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        List<String> errors = new ArrayList<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.add(error.getField() + ": " + error.getDefaultMessage());
        }
        log.warn("[{}] Validation error: {}", reqId, errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Please check the highlighted fields and try again.", "VALIDATION_ERROR", reqId, errors));
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolation(jakarta.validation.ConstraintViolationException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        List<String> errors = new ArrayList<>();
        ex.getConstraintViolations().forEach(cv -> errors.add(cv.getMessage()));
        log.warn("[{}] Constraint violations: {}", reqId, errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Please check the highlighted fields and try again.", "VALIDATION_ERROR", reqId, errors));
    }

    @ExceptionHandler({
            org.springframework.dao.OptimisticLockingFailureException.class,
            org.springframework.dao.PessimisticLockingFailureException.class,
            org.springframework.dao.DataIntegrityViolationException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleConflict(Exception ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.error("[{}] Database constraint or lock conflict: {}", reqId, ex.getMessage(), ex);

        String msg = "The record has been modified or already exists. Please refresh and try again.";
        if (ex instanceof org.springframework.dao.DataIntegrityViolationException dive) {
            String rootMsg = dive.getMostSpecificCause() != null ? dive.getMostSpecificCause().getMessage() : dive.getMessage();
            if (rootMsg != null) {
                String lower = rootMsg.toLowerCase();
                if (lower.contains("ukr43af9ap4edm43mmtq01oddj6") || lower.contains("users.username") || lower.contains("username")) {
                    msg = "Username is already registered. Please choose another username or sign in.";
                } else if (lower.contains("uk6dotkott2kjsp8vw4d0m25fb7") || lower.contains("users.email") || lower.contains("email")) {
                    msg = "Email address is already registered. Please use another email or sign in.";
                }
            }
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(msg, "CONFLICT", reqId));
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            ArithmeticException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleInvalidInput(Exception ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] Invalid input values: {}", reqId, ex.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Invalid request data. Please check your inputs and try again.", "BAD_REQUEST", reqId));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.warn("[{}] HTTP method not supported: {}", reqId, ex.getMethod());
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error("The requested operation is not supported.", "METHOD_NOT_ALLOWED", reqId));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        String reqId = RequestIdFilter.getCurrentRequestId();
        log.error("[{}] Unhandled server exception: {}", reqId, ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Something went wrong. Please try again.", "INTERNAL_SERVER_ERROR", reqId));
    }
}
