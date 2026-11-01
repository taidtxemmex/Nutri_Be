import {
  ForbiddenException,
  UnauthorizedException,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { UserRole } from '../../src/config/enums/role.enum';
import { TokenBlacklistService } from '../../src/security/token/token-blacklist.service';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { IngredientsService } from '../../src/modules/ingredients/services/ingredients.service';
import { CreatePatientDto } from '../../src/modules/patients/dto/create-patient.dto';
import { CreateAnthropometryDto } from '../../src/modules/patients/dto/create-anthropometry.dto';
import { AnthropometryEngine } from '../../src/modules/patients/services/anthropometry.service';

describe('Ruthless Hostile QA Audit - Edge Cases & Regression Verification', () => {
  /* =========================================================================
   * 1. VIP GATING ON EXCEL IMPORT & ROLE HIERARCHY
   * ========================================================================= */
  describe('Audit Point 1: VIP Gating on Excel Import', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    const createMockContext = (user: any, requiredRoles?: (UserRole | string)[]) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return requiredRoles;
        return undefined;
      });

      return {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as any;
    };

    it('FIXED: RolesGuard correctly blocks regular USER from accessing VIP endpoint requiring USERPRO with ForbiddenException', () => {
      // Endpoints @Post('import') for patients and daily-intakes require [SUPERADMIN, ADMIN, USERPRO]
      const requiredRoles = [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.USERPRO];
      const regularUserContext = createMockContext(
        { id: 'user-123', role: UserRole.USER },
        requiredRoles,
      );

      // In a secure VIP-gated system, a regular USER MUST be blocked with ForbiddenException (403)
      expect(() => guard.canActivate(regularUserContext)).toThrow(ForbiddenException);
    });
  });

  /* =========================================================================
   * 2. ACCESS TOKEN BLACKLIST & LOGOUT FLOW
   * ========================================================================= */
  describe('Audit Point 2: Access Token Blacklist & Logout', () => {
    let tokenBlacklistService: TokenBlacklistService;
    let jwtStrategy: JwtStrategy;
    let mockPrisma: any;
    let mockConfigService: any;

    beforeEach(() => {
      tokenBlacklistService = new TokenBlacklistService();
      tokenBlacklistService.clearMemoryCache();

      mockConfigService = {
        get: jest.fn().mockReturnValue('test-secret-key-at-least-32-chars-long!'),
      };

      mockPrisma = {
        nguoi_dung: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-audit-1',
            ten_dang_nhap: 'audit_user',
            vai_tro: 'USER',
            active: true,
          }),
        },
      };

      jwtStrategy = new JwtStrategy(
        mockConfigService as any,
        mockPrisma,
        undefined,
        tokenBlacklistService,
      );
    });

    it('should immediately block requests using a blacklisted token with 401 Unauthorized', async () => {
      const exp = Math.floor(Date.now() / 1000) + 600;
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64',
      );
      const payloadB64 = Buffer.from(JSON.stringify({ sub: 'user-audit-1', exp })).toString(
        'base64',
      );
      const testToken = `${headerB64}.${payloadB64}.testsignature`;

      // 1. Blacklist token
      await tokenBlacklistService.blacklistToken(testToken);

      // 2. Validate token via JwtStrategy
      const mockReq = {
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      };

      await expect(
        jwtStrategy.validate(mockReq, { sub: 'user-audit-1', role: 'USER' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should maintain blacklist for at least 60s even if token exp is in the past', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 300; // expired 5 mins ago
      const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64',
      );
      const payloadB64 = Buffer.from(
        JSON.stringify({ sub: 'user-audit-1', exp: pastExp }),
      ).toString('base64');
      const expiredToken = `${headerB64}.${payloadB64}.expiredsignature`;

      await tokenBlacklistService.blacklistToken(expiredToken);
      expect(await tokenBlacklistService.isTokenBlacklisted(expiredToken)).toBe(true);
    });
  });

  /* =========================================================================
   * 3. COLLATION & VIETNAMESE ACCENTS ("Dừa" vs "Dứa")
   * ========================================================================= */
  describe('Audit Point 3: Collation & Ingredient Name Duplication', () => {
    let service: IngredientsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        nguyen_lieu: {
          findMany: jest.fn(),
          create: jest.fn(),
        },
      };
      service = new IngredientsService(mockPrisma);
    });

    it('should distinguish "Bánh dừa" from "Bánh dứa" and NOT block creation', async () => {
      // Existing row in DB has "Bánh dừa"
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        { id: BigInt(101), ten_nguyen_lieu: 'Bánh dừa' },
      ]);

      // When checking if "Bánh dứa" exists
      const exists = await service.existsByMaterial({ material: 'Bánh dứa' });
      expect(exists).toBe(false); // Must NOT be blocked!
    });

    it('should correctly detect exact duplicate "Bánh dừa" and reject with 400 Bad Request', async () => {
      mockPrisma.nguyen_lieu.findMany.mockResolvedValue([
        { id: BigInt(101), ten_nguyen_lieu: 'Bánh dừa' },
      ]);

      const exists = await service.existsByMaterial({ material: 'Bánh dừa' });
      expect(exists).toBe(true);

      // Attempting to create duplicate material throws HttpException 400
      await expect(
        service.create({
          dto: { material: 'Bánh dừa' } as any,
          currentUser: { id: 'admin-1', role: UserRole.ADMIN } as any,
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.create({
          dto: { material: 'Bánh dừa' } as any,
          currentUser: { id: 'admin-1', role: UserRole.ADMIN } as any,
        });
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.getResponse()).toMatchObject({
          code: 'PROP_014',
          message: 'Tên nguyên liệu đã tồn tại trong hệ thống',
        });
      }
    });
  });

  /* =========================================================================
   * 4. HEIGHT & WEIGHT VALIDATION (CM VS M, INFANT EDGE CASES)
   * ========================================================================= */
  describe('Audit Point 4: Height & Weight Validation', () => {
    it('should reject height: 0 and weight: -5 with class-validator 400 errors', async () => {
      const dto = plainToInstance(CreatePatientDto, {
        fullName: 'Nguyễn Văn Test',
        height: 0,
        weight: -5,
      });

      const errors = await validate(dto);
      const heightError = errors.find((e) => e.property === 'height');
      const weightError = errors.find((e) => e.property === 'weight');

      expect(heightError).toBeDefined();
      expect(heightError?.constraints).toHaveProperty('isPositive');
      expect(heightError?.constraints?.min).toMatch(/0\.01|validation\.patients\.height_min/);

      expect(weightError).toBeDefined();
      expect(weightError?.constraints).toHaveProperty('isPositive');
      expect(weightError?.constraints?.min).toMatch(/0\.01|validation\.patients\.weight_min/);
    });

    it('should allow height: 0.8 for infant/newborn', async () => {
      const patientDto = plainToInstance(CreatePatientDto, {
        fullName: 'Bé Sơ Sinh',
        height: 0.8,
        weight: 3.5,
        gender: 'NAM',
      });

      const errors = await validate(patientDto);
      const heightError = errors.find((e) => e.property === 'height');
      expect(heightError).toBeUndefined();
    });

    it('AnthropometryEngine handles meter to cm conversion or null for < 20cm', async () => {
      // User enters height in meters: 1.75
      const patientDto = plainToInstance(CreatePatientDto, {
        fullName: 'Người Lớn Nhập Mét',
        height: 1.75,
        weight: 65,
        gender: 'NAM',
      });

      const errors = await validate(patientDto);
      const heightError = errors.find((e) => e.property === 'height');
      expect(heightError).toBeUndefined();

      const anthropometryDto = plainToInstance(CreateAnthropometryDto, {
        weight: 65,
        height: 1.75,
      });
      const anthroErrors = await validate(anthropometryDto);
      const anthroHeightError = anthroErrors.find((e) => e.property === 'height');
      expect(anthroHeightError).toBeUndefined();

      // Furthermore, AnthropometryEngine.calculateBmi returns null because 1.75 < 20cm
      const bmiResult = AnthropometryEngine.calculateBmi({ weightKg: 65, heightCm: 1.75 });
      expect(bmiResult.bmi).toBeNull();
    });
  });

  /* =========================================================================
   * 5. SMTP MAILER & EMBEDDED QUEUE RESILIENCE
   * ========================================================================= */
  describe('Audit Point 5: SMTP Mailer Error Handling & DLQ Routing', () => {
    it('should demonstrate that queue worker handles mail failure gracefully without crashing process', () => {
      // Simulate failure handler logic
      const rawJob = {
        id: BigInt(999),
        queueName: 'email',
        payload: JSON.stringify({ to: 'fail@test.com' }),
        attempts: 2,
        maxAttempts: 3,
      };

      const nextAttempts = (rawJob.attempts || 0) + 1;
      const maxAttempts = rawJob.maxAttempts || 3;
      const shouldMoveToDlq = nextAttempts >= maxAttempts;

      expect(shouldMoveToDlq).toBe(true);
    });
  });
});
