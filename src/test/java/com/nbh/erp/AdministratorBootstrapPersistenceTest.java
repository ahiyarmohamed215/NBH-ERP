package com.nbh.erp;

import com.nbh.erp.config.DataInitializer;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Bootstrap requires a genuinely empty database, independent of suite ordering. */
@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:administrator-bootstrap-test;MODE=MySQL;NON_KEYWORDS=YEAR;DB_CLOSE_DELAY=-1")
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
@Transactional
class AdministratorBootstrapPersistenceTest {
    @Autowired DataInitializer initializer;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder passwords;
    String raw;
    @BeforeEach void setup() {
        assertEquals(0,users.count());
        raw="Q!7v"+UUID.randomUUID().toString().replace("-","");
        ReflectionTestUtils.setField(initializer,"adminUsername","bootstrap-owner");
        ReflectionTestUtils.setField(initializer,"adminEmail","owner@example.test");
        ReflectionTestUtils.setField(initializer,"adminPassword",raw);
    }
    @AfterEach void restoreConfiguration() {
        ReflectionTestUtils.setField(initializer,"initialAdminEnabled",false);
        ReflectionTestUtils.setField(initializer,"adminPassword","");
        ReflectionTestUtils.setField(initializer,"adminUsername","admin");
        ReflectionTestUtils.setField(initializer,"adminEmail","admin@nbh.com");
    }
    void initialize(boolean enabled) {
        ReflectionTestUtils.setField(initializer,"initialAdminEnabled",enabled);
        initializer.run(new DefaultApplicationArguments());
    }
    @Test void firstBootstrapPersistsHashedAccountAndDoesNotRecreateOnSecondRun() {
        initialize(true);users.flush();
        User saved=users.findByUsername("bootstrap-owner").orElseThrow();
        String hash=saved.getPassword();
        assertTrue(passwords.matches(raw,hash));
        assertTrue(saved.getIsActive());assertEquals("APPROVED",saved.getApprovalStatus());
        assertEquals(Set.of("ROLE_ADMIN","ROLE_SUPER_ADMIN"),saved.getRoles().stream().map(r->r.getName()).collect(java.util.stream.Collectors.toSet()));
        assertTrue(saved.getRoles().stream().allMatch(r->r.getPermissions().size()==43));
        saved.setIsActive(false);saved.setApprovalStatus("REJECTED");saved.getRoles().clear();users.saveAndFlush(saved);
        initialize(true);users.flush();
        assertEquals(1,users.count());assertEquals(hash,saved.getPassword());
        assertFalse(saved.getIsActive());assertEquals("REJECTED",saved.getApprovalStatus());assertTrue(saved.getRoles().isEmpty());
    }
    @Test void normalStartupPreservesRemovedPermissionsAndDoesNotCreateAnAccount() {
        var admin=roles.findByName("ROLE_ADMIN").orElseThrow();
        admin.getPermissions().clear();admin.setStatus("INACTIVE");roles.saveAndFlush(admin);
        initialize(false);roles.flush();
        assertEquals(0,users.count());
        assertTrue(admin.getPermissions().isEmpty());assertEquals("INACTIVE",admin.getStatus());
    }
    @Test void softDeletedAccountStillPreventsBootstrap() {
        var saved=users.saveAndFlush(User.builder().username("old-owner").email("old@example.test")
                .fullName("Former owner").password(passwords.encode(raw)).isActive(false).approvalStatus("REJECTED")
                .roles(new HashSet<>()).build());
        saved.setDeletedAt(java.time.LocalDateTime.now());users.saveAndFlush(saved);
        initialize(true);
        assertEquals(1,users.count());
        assertTrue(users.findByUsername("bootstrap-owner").isEmpty());
        assertFalse(saved.getIsActive());
    }
}
