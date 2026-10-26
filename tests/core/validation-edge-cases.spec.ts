import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';
import { BasePaginationQueryDto } from '../../src/common/dto/base-pagination-query.dto';
import { ProfileFilterDto } from '../../src/modules/profiles/dto/profile-filter.dto';

describe('ValidationEdgeCases & Anti-OOM Bounding', () => {
  describe('RegisterDto Validation', () => {
    it('should fail when password is less than 8 characters', async () => {
      const dto = plainToInstance(RegisterDto, {
        username: 'valid_user',
        password: 'P@1ss', // 5 chars
        fullName: 'Nguyen Van A',
        email: 'test@example.com',
        phone: '0987654321',
        gender: 'NAM',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when password lacks special characters or numbers', async () => {
      const dto = plainToInstance(RegisterDto, {
        username: 'valid_user',
        password: 'PasswordOnlyNoNum',
        fullName: 'Nguyen Van A',
        email: 'test@example.com',
        phone: '0987654321',
        gender: 'NAM',
      });

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === 'password');
      expect(passwordError).toBeDefined();
    });

    it('should fail when email format is invalid', async () => {
      const invalidEmails = [
        'invalid-email',
        'missing-at-domain.com',
        '@nodomain.com',
        'spaces in@email.com',
      ];

      for (const email of invalidEmails) {
        const dto = plainToInstance(RegisterDto, {
          username: 'valid_user',
          password: 'P@ssword123!',
          fullName: 'Nguyen Van A',
          email,
          phone: '0987654321',
          gender: 'NAM',
        });

        const errors = await validate(dto);
        const emailError = errors.find((e) => e.property === 'email');
        expect(emailError).toBeDefined();
      }
    });

    it('should fail when username contains invalid special characters', async () => {
      const invalidUsernames = [
        'user@123',
        'user<script>',
        'usr!#',
        'user name',
        'abc', // < 4 chars
        'a'.repeat(35), // > 30 chars
      ];

      for (const username of invalidUsernames) {
        const dto = plainToInstance(RegisterDto, {
          username,
          password: 'P@ssword123!',
          fullName: 'Nguyen Van A',
          email: 'test@example.com',
          phone: '0987654321',
          gender: 'NAM',
        });

        const errors = await validate(dto);
        const usernameError = errors.find((e) => e.property === 'username');
        expect(usernameError).toBeDefined();
      }
    });

    it('should pass with valid username, password, email and phone', async () => {
      const dto = plainToInstance(RegisterDto, {
        username: 'bs_minhtri.99',
        password: 'P@ssword123!',
        fullName: 'Bác sĩ Minh Trí',
        email: 'bsminhtri@gmail.com',
        phone: '0987654321',
        gender: 'NAM',
        dob: '1990-05-15',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Anti-OOM Pagination Bounding', () => {
    it('should clamp limit = 999999 to 100 in BasePaginationQueryDto', () => {
      const dto = plainToInstance(BasePaginationQueryDto, {
        page: '1',
        limit: '999999',
      });

      expect(dto.limit).toBe(100);
      expect(dto.limit).toBeLessThanOrEqual(100);
    });

    it('should normalize negative page and limit in BasePaginationQueryDto', () => {
      const dto = plainToInstance(BasePaginationQueryDto, {
        page: '-5',
        limit: '0',
      });

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });

    it('should clamp size = 999999 to 100 in ProfileFilterDto', () => {
      const dto = plainToInstance(ProfileFilterDto, {
        page: 0,
        size: 999999,
      });

      expect(dto.size).toBe(100);
      expect(dto.size).toBeLessThanOrEqual(100);
    });

    it('should handle size alias from legacy FE in BasePaginationQueryDto', () => {
      const dto = plainToInstance(BasePaginationQueryDto, {
        size: '500',
      });

      expect(dto.limit).toBe(100);
    });
  });
});
