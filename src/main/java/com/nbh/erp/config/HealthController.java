package com.nbh.erp.config;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import javax.sql.DataSource;
import java.util.Map;
@RestController
public class HealthController {
 private final DataSource datasource;
 public HealthController(DataSource datasource) { this.datasource=datasource; }
 @GetMapping("/health/live") public Map<String,String> live() { return Map.of("status","UP"); }
 @GetMapping("/health/ready") public ResponseEntity<Map<String,String>> ready() {
  try(var c=datasource.getConnection()) { if(c.isValid(2)) return ResponseEntity.ok(live()); } catch(Exception ignored) {}
  return ResponseEntity.status(503).body(Map.of("status","DOWN"));
 }
}
