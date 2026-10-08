package com.nbh.erp;
import org.junit.jupiter.api.Test;
import jakarta.validation.Validation;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class MoneyValidationTest {
 @Test void receiptCannotPostFractionalCents() {
  try(var factory=Validation.buildDefaultValidatorFactory()) {
   var request=com.nbh.erp.payment.dto.CreatePaymentRequest.builder().amount(new BigDecimal("0.015")).build();
   assertFalse(factory.getValidator().validate(request).isEmpty());
   request.setAmount(new BigDecimal("0.01"));assertTrue(factory.getValidator().validate(request).isEmpty());
  }
 }
}
