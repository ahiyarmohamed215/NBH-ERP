package com.nbh.erp;

import com.nbh.erp.config.DataInitializer;
import com.nbh.erp.delivery.service.DeliveryRouteService;
import com.nbh.erp.delivery.service.VehicleService;
import com.nbh.erp.role.entity.Role;
import com.nbh.erp.role.repository.PermissionRepository;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Uses mocks only; no administrator is created in an application database. */
@ExtendWith(MockitoExtension.class) @MockitoSettings(strictness=Strictness.LENIENT)
class AdministratorBootstrapSecurityTest {
    @Mock PermissionRepository permissions;
    @Mock RoleRepository roles;
    @Mock UserRepository users;
    @Mock VehicleService vehicles;
    @Mock DeliveryRouteService routes;
    PasswordEncoder passwords;
    DataInitializer initializer;
    Map<String,Role> storedRoles;
    String bootstrapPassword;

    @BeforeEach void setup() {
        passwords=spy(new BCryptPasswordEncoder());
        initializer=new DataInitializer(permissions,roles,users,passwords,vehicles,routes,null);
        storedRoles=new HashMap<>();
        AtomicLong ids=new AtomicLong();
        when(permissions.findByName(anyString())).thenReturn(Optional.empty());
        when(permissions.save(any())).thenAnswer(i->i.getArgument(0));
        when(roles.findByName(anyString())).thenAnswer(i->Optional.ofNullable(storedRoles.get(i.getArgument(0))));
        when(roles.save(any())).thenAnswer(i->{Role r=i.getArgument(0);r.setId(ids.incrementAndGet());storedRoles.put(r.getName(),r);return r;});
        when(roles.findByIdForUpdate(anyLong())).thenAnswer(i->storedRoles.values().stream().filter(r->r.getId().equals(i.getArgument(0))).findFirst());
        bootstrapPassword="Q!7v"+UUID.randomUUID().toString().replace("-","");
        ReflectionTestUtils.setField(initializer,"adminUsername","admin");
        ReflectionTestUtils.setField(initializer,"adminEmail","owner@example.test");
        ReflectionTestUtils.setField(initializer,"adminPassword",bootstrapPassword);
    }
    void run(boolean enabled) {
        ReflectionTestUtils.setField(initializer,"initialAdminEnabled",enabled);
        initializer.run(new DefaultApplicationArguments());
    }

    @Test void disabledBootstrapNeverCreatesAUserEvenOnAnEmptyDatabase() {
        run(false);
        verify(users,never()).save(any());
        verify(passwords,never()).encode(any());
        verify(roles,never()).findByIdForUpdate(anyLong());
    }

    @Test void explicitlyEnabledFirstBootstrapAssignsBothRolesAndHashesThePassword() {
        run(true);
        var captured=ArgumentCaptor.forClass(User.class);
        verify(users).save(captured.capture());
        User created=captured.getValue();
        assertEquals("admin",created.getUsername());
        assertEquals("APPROVED",created.getApprovalStatus());
        assertTrue(created.getIsActive());
        assertNotEquals(bootstrapPassword,created.getPassword());
        assertTrue(passwords.matches(bootstrapPassword,created.getPassword()));
        assertEquals(Set.of("ROLE_ADMIN","ROLE_SUPER_ADMIN"),created.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toSet()));
        assertTrue(created.getRoles().stream().allMatch(r->r.getPermissions().size()==43));
        var order=inOrder(roles,users);
        order.verify(roles).findByIdForUpdate(anyLong());
        order.verify(users).count();
        order.verify(users).save(any());
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void existingAccountStateAndRemovedRolePermissionsAreNeverRestored(boolean enabled) {
        Role role=Role.builder().id(5L).name("ROLE_SUPER_ADMIN").status("INACTIVE").permissions(new HashSet<>()).build();
        storedRoles.put(role.getName(),role);
        User existing=User.builder().username("admin").isActive(false).approvalStatus("REJECTED").roles(new HashSet<>()).build();
        when(users.findByUsername("admin")).thenReturn(Optional.of(existing));
        when(users.count()).thenReturn(1L);
        ReflectionTestUtils.setField(initializer,"adminPassword",null);
        run(enabled);
        assertFalse(existing.getIsActive());
        assertEquals("REJECTED",existing.getApprovalStatus());
        assertTrue(existing.getRoles().isEmpty());
        assertTrue(role.getPermissions().isEmpty());
        assertEquals("INACTIVE",role.getStatus());
        verify(users,never()).save(any());
        verify(roles,never()).save(role);
        verify(passwords,never()).encode(any());
    }

    @Test void anyExistingAccountBlocksBootstrapOfADifferentName() {
        when(users.count()).thenReturn(1L);
        run(true);
        verify(users,never()).save(any());
        verify(passwords,never()).encode(any());
    }

    @ParameterizedTest @ValueSource(strings={"", "alllowercasepassword", "NOLOWERCASE123!", "NoDigitsHere!!!", "NoSymbolsHere123", "Admin!123456789", "Owner!123456789", "Abc1!xyz"})
    void enabledBootstrapRejectsWeakOrIdentityDerivedPasswords(String invalid) {
        ReflectionTestUtils.setField(initializer,"adminPassword",invalid);
        assertThrows(RuntimeException.class,()->run(true));
        verify(users,never()).save(any());
        verify(passwords,never()).encode(any());
    }
}
