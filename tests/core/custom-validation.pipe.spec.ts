import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomValidationPipe } from '../../src/common/pipes/custom-validation.pipe';
import { I18nService } from '../../src/core/i18n/i18n.service';

class TestChildDto {
  @IsString()
  @IsNotEmpty({ message: 'validation.common.name_required' })
  childName: string;
}

class TestSampleDto {
  @IsString()
  @IsNotEmpty({ message: 'validation.user.username_required' })
  username: string;

  @IsInt({ message: 'validation.common.age_must_be_int' })
  @Min(1, { message: 'validation.common.age_min_1' })
  @Type(() => Number)
  age: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestChildDto)
  child?: TestChildDto;
}

describe('CustomValidationPipe - Whitelist Stripping & Transformation', () => {
  let pipe: CustomValidationPipe;
  let mockI18nService: Partial<I18nService>;

  beforeEach(() => {
    mockI18nService = {
      hasKey: jest.fn((key: string) => {
        const dict: Record<string, string> = {
          'validation.user.username_required': 'Tên đăng nhập không được để trống',
          'validation.common.age_must_be_int': 'Tuổi phải là số nguyên',
          'validation.common.age_min_1': 'Tuổi phải lớn hơn hoặc bằng 1',
          'validation.common.name_required': 'Tên con không được để trống',
        };
        return key in dict;
      }),
      translate: jest.fn((key: string) => {
        const dict: Record<string, string> = {
          'validation.user.username_required': 'Tên đăng nhập không được để trống',
          'validation.common.age_must_be_int': 'Tuổi phải là số nguyên',
          'validation.common.age_min_1': 'Tuổi phải lớn hơn hoặc bằng 1',
          'validation.common.name_required': 'Tên con không được để trống',
        };
        return dict[key] || key;
      }),
    };

    pipe = new CustomValidationPipe(mockI18nService as I18nService);
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: TestSampleDto,
    data: '',
  };

  it('should automatically strip non-whitelisted extra parameters (whitelist: true)', async () => {
    const rawPayload = {
      username: 'doctor_who',
      age: 35,
      // Extraneous hacker/tampering fields
      hackerField: 'MALICIOUS_DATA',
      isAdmin: true,
      role: 'ADMIN',
      unknown_sql: "1' OR '1'='1",
    };

    const transformed = (await pipe.transform(rawPayload, metadata)) as TestSampleDto;

    expect(transformed).toBeInstanceOf(TestSampleDto);
    expect(transformed.username).toBe('doctor_who');
    expect(transformed.age).toBe(35);

    // Assert that extra fields are completely stripped out
    expect((transformed as any).hackerField).toBeUndefined();
    expect((transformed as any).isAdmin).toBeUndefined();
    expect((transformed as any).role).toBeUndefined();
    expect((transformed as any).unknown_sql).toBeUndefined();
  });

  it('should transform types automatically (transform: true)', async () => {
    const rawPayload = {
      username: 'doctor_tran',
      age: '42', // String number should be transformed to number
    };

    const transformed = (await pipe.transform(rawPayload, metadata)) as TestSampleDto;

    expect(transformed.age).toBe(42);
    expect(typeof transformed.age).toBe('number');
  });

  it('should reject invalid payload and translate error message via I18nService', async () => {
    const invalidPayload = {
      username: '',
      age: 0,
    };

    await expect(pipe.transform(invalidPayload, metadata)).rejects.toThrow(BadRequestException);

    try {
      await pipe.transform(invalidPayload, metadata);
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.code).toBe('VALIDATION_FAILED');
      expect(Array.isArray(response.details)).toBe(true);

      const usernameErr = response.details.find((d: any) => d.field === 'username');
      expect(usernameErr).toBeDefined();
      expect(usernameErr.message).toBe('Tên đăng nhập không được để trống');
      expect(usernameErr.key).toBe('validation.user.username_required');

      const ageErr = response.details.find((d: any) => d.field === 'age');
      expect(ageErr).toBeDefined();
    }
  });

  it('should flatten nested children validation errors correctly', async () => {
    const nestedInvalidPayload = {
      username: 'valid_user',
      age: 25,
      child: {
        childName: '', // empty name triggers validation error
      },
    };

    try {
      await pipe.transform(nestedInvalidPayload, metadata);
      fail('Expected BadRequestException');
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.code).toBe('VALIDATION_FAILED');

      const childErr = response.details.find((d: any) => d.field === 'child.childName');
      expect(childErr).toBeDefined();
      expect(childErr.message).toBe('Tên con không được để trống');
    }
  });
});
