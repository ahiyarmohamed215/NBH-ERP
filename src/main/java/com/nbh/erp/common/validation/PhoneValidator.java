package com.nbh.erp.common.validation;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.nbh.erp.common.exception.BusinessException;
public class PhoneValidator implements ConstraintValidator<ValidPhone,String> {
 private static final PhoneNumberUtil PHONES=PhoneNumberUtil.getInstance();
 public boolean isValid(String value,ConstraintValidatorContext context) {
  if(value==null || value.isBlank())return true;
  if(value.length()>30 || !value.matches("[+0-9().\\s-]+"))return false;
  try {return PHONES.isValidNumber(PHONES.parse(value,"LK"));}catch(Exception error){return false;}
 }
 public static String normalize(String value) {
  if(value==null || value.isBlank())return null;
  if(!new PhoneValidator().isValid(value,null))throw new BusinessException("Enter a valid contact number for its country");
  try {return PHONES.format(PHONES.parse(value,"LK"),PhoneNumberUtil.PhoneNumberFormat.E164);}catch(Exception error){throw new BusinessException("Enter a valid contact number");}
 }
}
