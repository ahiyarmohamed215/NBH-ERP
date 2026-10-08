package com.nbh.erp.common.service;
import com.nbh.erp.common.entity.IdempotencyRecord;
import com.nbh.erp.common.repository.IdempotencyRepository;
import com.nbh.erp.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.web.context.request.*;
@Service @RequiredArgsConstructor
public class IdempotencyService {
 private final IdempotencyRepository repository;
 @Transactional(propagation=Propagation.MANDATORY)
 public IdempotencyRecord reserve(String operation,Object request) {
  if(!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) return null;
  String key=attributes.getRequest().getHeader("Idempotency-Key");
  if(key==null || key.isBlank()) return null;
  if(key.length()>128) throw new BusinessException("Idempotency key too long");
  String identity=hash(com.nbh.erp.security.SecurityUtils.getCurrentUsername().orElse("anonymous")+":"+operation+":"+key);
  String fingerprint=hash(request.toString());
  var existing=repository.findById(identity);
  if(existing.isPresent()) {
   if(!existing.get().getFingerprint().equals(fingerprint)) throw new BusinessException("Idempotency key already used for a different request");
   return existing.get();
  }
  var record=new IdempotencyRecord(); record.setRequestKey(identity); record.setFingerprint(fingerprint);
  return repository.saveAndFlush(record);
 }
 public <T> T complete(IdempotencyRecord record,Long id,T response) { if(record!=null) { record.setResourceId(id); repository.save(record); } return response; }
 private String hash(String value) { try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); } catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); } }
}
