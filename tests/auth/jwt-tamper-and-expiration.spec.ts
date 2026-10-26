import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { JwtPayload } from '../../src/modules/auth/interfaces/jwt-payload.interface';

describe('JWT Tampering, Expiration & Claims Parity', () => {
  const secretKey = 'super-secret-production-key-strictly-secured-12345';
  const wrongSecretKey = 'attacker-tampered-secret-key-99999';

  let jwtService: JwtService;
  let jwtStrategy: JwtStrategy;

  beforeEach(() => {
    jwtService = new JwtService({
      secret: secretKey,
    });

    const mockConfigService: any = {
      get: jest.fn((key: string, defaultVal: string) => {
        if (key === 'JWT_SECRET') return secretKey;
        return defaultVal;
      }),
    };

    jwtStrategy = new JwtStrategy(mockConfigService);
  });

  const validPayload: JwtPayload = {
    sub: '852bb071-7057-41ec-b08e-cbb39e246ea4',
    userId: '852bb071-7057-41ec-b08e-cbb39e246ea4',
    preferred_username: 'bs_minhtri',
    username: 'bs_minhtri',
    email: 'bsminhtri@gmail.com',
    role: 'USER',
    roles: ['USER'],
    realm_access: {
      roles: ['USER'],
    },
    family_name: 'Nguyễn',
    given_name: 'Minh Trí',
    keycloakUserId: '852bb071-7057-41ec-b08e-cbb39e246ea4',
  };

  it('should accept a valid signature and extract standard NutriFE claims', async () => {
    const token = jwtService.sign(validPayload, { expiresIn: '15m' });
    const verified = jwtService.verify(token, { secret: secretKey });

    expect(verified.sub).toBe(validPayload.sub);
    expect(verified.userId).toBe(validPayload.userId);
    expect(verified.preferred_username).toBe('bs_minhtri');
    expect(verified.realm_access.roles).toContain('USER');
    expect(verified.family_name).toBe('Nguyễn');
    expect(verified.given_name).toBe('Minh Trí');

    const validatedUser = await jwtStrategy.validate(verified);
    expect(validatedUser.id).toBe(validPayload.sub);
    expect(validatedUser.username).toBe('bs_minhtri');
  });

  it('should reject a token with tampered payload', () => {
    const validToken = jwtService.sign(validPayload, { expiresIn: '15m' });
    const parts = validToken.split('.');

    // Tamper the payload: change role from USER to ADMIN
    const originalPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    originalPayload.role = 'ADMIN';
    originalPayload.roles = ['ADMIN'];
    originalPayload.realm_access.roles = ['ADMIN'];

    const tamperedPayloadB64 = Buffer.from(JSON.stringify(originalPayload)).toString('base64');
    const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    expect(() => {
      jwtService.verify(tamperedToken, { secret: secretKey });
    }).toThrow();
  });

  it('should reject a token signed with an invalid/attacker secret', () => {
    const attackerJwtService = new JwtService({ secret: wrongSecretKey });
    const attackerToken = attackerJwtService.sign(validPayload, { expiresIn: '15m' });

    expect(() => {
      jwtService.verify(attackerToken, { secret: secretKey });
    }).toThrow();
  });

  it('should reject an expired token with TokenExpiredError', async () => {
    const expiredToken = jwtService.sign(validPayload, { expiresIn: '-1s' });

    expect(() => {
      jwtService.verify(expiredToken, { secret: secretKey });
    }).toThrow('jwt expired');
  });

  it('should reject malformed or non-JWT tokens', () => {
    const malformedTokens = [
      'not.a.valid.jwt.token',
      'gibberish-string',
      'header.only',
      '',
    ];

    for (const token of malformedTokens) {
      expect(() => {
        jwtService.verify(token, { secret: secretKey });
      }).toThrow();
    }
  });

  it('should reject invalid payload structure in JwtStrategy.validate', async () => {
    const invalidPayload: any = {
      // Missing sub and userId
      email: 'missing@user.com',
    };

    await expect(jwtStrategy.validate(invalidPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
