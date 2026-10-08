package com.nbh.erp;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.hibernate.cfg.Configuration;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
@EnabledIfSystemProperty(named="erp.exportSchema",matches="true")
class SchemaExportTest {
 @Test void exportMySqlSchema() throws Exception {
  java.nio.file.Files.createDirectories(java.nio.file.Path.of(".build"));
  java.nio.file.Files.deleteIfExists(java.nio.file.Path.of(".build/schema-mysql.sql"));
  var cfg=new Configuration();
  cfg.setProperty("hibernate.dialect","org.hibernate.dialect.MySQLDialect");
  cfg.setProperty("hibernate.boot.allow_jdbc_metadata_access","false");
  cfg.setProperty("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
  cfg.setProperty("jakarta.persistence.schema-generation.database.action","none");
  cfg.setProperty("jakarta.persistence.schema-generation.scripts.action","create");
  cfg.setProperty("jakarta.persistence.schema-generation.scripts.create-target",".build/schema-mysql.sql");
  var scanner=new ClassPathScanningCandidateComponentProvider(false);scanner.addIncludeFilter(new AnnotationTypeFilter(jakarta.persistence.Entity.class));
  var entities=scanner.findCandidateComponents("com.nbh.erp");
  org.junit.jupiter.api.Assertions.assertTrue(entities.size()>30,"All entities must be discovered");
  for(var entity:entities) cfg.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
  try(var factory=cfg.buildSessionFactory()) { org.junit.jupiter.api.Assertions.assertNotNull(factory); }
 }
}
