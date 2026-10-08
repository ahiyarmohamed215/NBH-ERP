package com.nbh.erp.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
@Configuration
public class BusinessTimeConfig {
 public BusinessTimeConfig(@Value("${app.business-timezone:Asia/Colombo}") String zone) { java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(java.time.ZoneId.of(zone))); }
}
