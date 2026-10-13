package com.nbh.erp;
import com.nbh.erp.user.entity.User;
import com.nbh.erp.user.dto.UserDto;
import com.nbh.erp.user.dto.CreateUserRequest;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.user.service.UserService;
import com.nbh.erp.role.repository.RoleRepository;
import com.nbh.erp.audit.service.AuditLogService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserStaffCodeTest {
 @Test void legacyAndExistingStaffCodesAreConsistentInDtos(){
  var user=User.builder().id(7L).employeeCode(null).build();
  assertEquals("EMP-0007",UserDto.from(user).getEmployeeCode());
  user.setEmployeeCode("   ");assertEquals("EMP-0007",UserDto.from(user).getEmployeeCode());
  user.setEmployeeCode("STAFF-007");assertEquals("STAFF-007",UserDto.from(user).getEmployeeCode());
  assertNull(User.builder().build().getEmployeeCode());
 }
 @Test void newlyCreatedStaffReceiveAPersistedIdBasedCode(){
  var repo=mock(UserRepository.class);var encoder=mock(PasswordEncoder.class);
  when(repo.save(any(User.class))).thenAnswer(invocation->{User user=invocation.getArgument(0);user.setId(27L);return user;});
  when(encoder.encode("secret")).thenReturn("encoded");
  var service=new UserService(repo,mock(RoleRepository.class),encoder,mock(AuditLogService.class));
  var request=new CreateUserRequest();request.setUsername("staff");request.setPassword("secret");request.setEmail("staff@example.com");request.setFullName("Test staff");request.setRoles(java.util.Set.of());
  assertEquals("EMP-0027",service.createUser(request).getEmployeeCode());
  verify(repo,times(2)).save(argThat(user->"EMP-0027".equals(user.getEmployeeCode())));
 }
}
