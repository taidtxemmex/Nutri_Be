import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type SupportedLocale = 'vi' | 'en' | 'zh';
export const DEFAULT_LOCALE: SupportedLocale = 'vi';

export interface TranslateParamDto {
  key: string;
  locale?: string;
  args?: Record<string, any>;
}

export interface TranslateConstraintParamDto {
  code: string;
  field: string;
  locale?: string;
  args?: Record<string, any>;
}

export interface TranslateFieldParamDto {
  field: string;
  locale?: string;
}

export interface TranslateTextOrKeyParamDto {
  textOrKey: string;
  locale?: string;
  args?: Record<string, any>;
}

interface DynamicPattern {
  regex: RegExp;
  translate: (match: RegExpMatchArray, locale: SupportedLocale) => string;
}

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly catalogs: Record<string, Record<string, string>> = {};
  private readonly viToKeyMap: Map<string, string> = new Map();
  private readonly dynamicPatterns: DynamicPattern[] = [];

  constructor() {
    this.loadCatalogs();
    this.initDynamicPatterns();
  }

  private loadCatalogs(): void {
    const locales: SupportedLocale[] = ['vi', 'en', 'zh'];
    const candidates = [
      path.resolve(__dirname, '../../i18n'),
      path.resolve(process.cwd(), 'src', 'i18n'),
      path.resolve(process.cwd(), 'dist', 'src', 'i18n'),
    ];

    let foundDir = '';
    for (const dir of candidates) {
      if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'vi.json'))) {
        foundDir = dir;
        break;
      }
    }

    for (const loc of locales) {
      if (foundDir) {
        try {
          const filePath = path.join(foundDir, `${loc}.json`);
          if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            this.catalogs[loc] = JSON.parse(raw);
          }
        } catch (err: any) {
          this.logger.warn(`Không thể nạp catalog ${loc}: ${err?.message}`);
        }
      }
      if (!this.catalogs[loc]) {
        this.catalogs[loc] = {};
      }
    }

    // Xây dựng bản đồ ánh xạ đảo ngược từ văn bản tiếng Việt sang key
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};
    for (const [k, v] of Object.entries(viCatalog)) {
      if (typeof v === 'string') {
        const normalized = v.trim().toLowerCase();
        if (!this.viToKeyMap.has(normalized)) {
          this.viToKeyMap.set(normalized, k);
        }
      }
    }
  }

  private initDynamicPatterns(): void {
    this.dynamicPatterns.push(
      // 1. Gói cước "CODE" không tồn tại
      {
        regex: /^Gói cước (?:có ID )?["']?([^"']+)["']? không tồn tại$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Package "${m[1]}" does not exist`;
          if (locale === 'zh') return `套餐 "${m[1]}" 不存在`;
          return `Gói cước "${m[1]}" không tồn tại`;
        },
      },
      // 2. Gói cước "CODE" hiện không khả dụng để đăng ký
      {
        regex: /^Gói cước ["']?([^"']+)["']? hiện không khả dụng để đăng ký$/i,
        translate: (m, locale) => {
          if (locale === 'en')
            return `Package "${m[1]}" is currently not available for subscription`;
          if (locale === 'zh') return `套餐 "${m[1]}" 当前不可订阅`;
          return `Gói cước "${m[1]}" hiện không khả dụng để đăng ký`;
        },
      },
      // 3. Mã gói cước "CODE" đã tồn tại trên hệ thống
      {
        regex: /^Mã gói cước ["']?([^"']+)["']? đã tồn tại trên hệ thống$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Package code "${m[1]}" already exists in the system`;
          if (locale === 'zh') return `套餐编码 "${m[1]}" 已存在于系统中`;
          return `Mã gói cước "${m[1]}" đã tồn tại trên hệ thống`;
        },
      },
      // 4. Yêu cầu thanh toán ID "ID" không tồn tại
      {
        regex: /^Yêu cầu thanh toán (?:ID )?["']?([^"']+)["']? không tồn tại$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Payment request ID "${m[1]}" does not exist`;
          if (locale === 'zh') return `支付请求 ID "${m[1]}" 不存在`;
          return `Yêu cầu thanh toán ID "${m[1]}" không tồn tại`;
        },
      },
      // 5. Không tìm thấy bệnh nhân với ID X
      {
        regex: /^Không tìm thấy bệnh nhân (?:với|có) ID ["']?([^"']+)["']?$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Patient with ID "${m[1]}" not found`;
          if (locale === 'zh') return `未找到 ID 为 "${m[1]}" 的患者`;
          return `Không tìm thấy bệnh nhân với ID "${m[1]}"`;
        },
      },
      // 6. Không tìm thấy nguyên liệu có ID X
      {
        regex: /^Không tìm thấy nguyên liệu (?:với|có) ID ["']?([^"']+)["']?$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Ingredient with ID "${m[1]}" not found`;
          if (locale === 'zh') return `未找到 ID 为 "${m[1]}" 的原料`;
          return `Không tìm thấy nguyên liệu có ID "${m[1]}"`;
        },
      },
      // 7. Không tìm thấy tập tin yêu cầu: X
      {
        regex: /^Không tìm thấy tập tin yêu cầu:\s*(.+)$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Requested file not found: ${m[1]}`;
          if (locale === 'zh') return `未找到请求的文件：${m[1]}`;
          return `Không tìm thấy tập tin yêu cầu: ${m[1]}`;
        },
      },
      // 8. Bạn đã thực hiện quá nhiều yêu cầu... Vui lòng thử lại sau X giây
      {
        regex: /Vui lòng thử lại sau (\d+) giây/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Too many requests. Please try again after ${m[1]} seconds.`;
          if (locale === 'zh') return `请求过多，请在 ${m[1]} 秒后重试。`;
          return `Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau ${m[1]} giây.`;
        },
      },
      // 9. Dữ liệu bị trùng lặp ở trường: X
      {
        regex: /^Dữ liệu bị trùng lặp ở trường:\s*(.+)$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Duplicate data in field: ${m[1]}`;
          if (locale === 'zh') return `字段数据重复：${m[1]}`;
          return `Dữ liệu bị trùng lặp ở trường: ${m[1]}`;
        },
      },
      // 10. Lỗi truy vấn cơ sở dữ liệu [Prisma X]
      {
        regex: /^Lỗi truy vấn cơ sở dữ liệu \[Prisma (.+)\]$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Database query error [Prisma ${m[1]}]`;
          if (locale === 'zh') return `数据库查询错误 [Prisma ${m[1]}]`;
          return `Lỗi truy vấn cơ sở dữ liệu [Prisma ${m[1]}]`;
        },
      },
      // 11. Class-validator: X should not be empty
      {
        regex: /^(\w+) should not be empty$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isNotEmpty', locale, args: { field } });
        },
      },
      // 12. Class-validator: X must be a string
      {
        regex: /^(\w+) must be a string$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isString', locale, args: { field } });
        },
      },
      // 13. Class-validator: X must be an integer number
      {
        regex: /^(\w+) must be an integer number$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isInt', locale, args: { field } });
        },
      },
      // 14. Class-validator: X must be a number
      {
        regex: /^(\w+) must be a number/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isNumber', locale, args: { field } });
        },
      },
      // 15. Class-validator: X must be a boolean value
      {
        regex: /^(\w+) must be a boolean value$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isBoolean', locale, args: { field } });
        },
      },
      // 16. Class-validator: X must be an email
      {
        regex: /^(\w+) must be an email$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({ key: 'validation.isEmail', locale, args: { field } });
        },
      },
      // 17. Class-validator: X must be longer than or equal to Y characters
      {
        regex: /^(\w+) must be longer than or equal to (\d+) characters$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({
            key: 'validation.minLength',
            locale,
            args: { field, min: m[2] },
          });
        },
      },
      // 18. Class-validator: X must be shorter than or equal to Y characters
      {
        regex: /^(\w+) must be shorter than or equal to (\d+) characters$/i,
        translate: (m, locale) => {
          const field = this.translateField({ field: m[1], locale });
          return this.translate({
            key: 'validation.maxLength',
            locale,
            args: { field, max: m[2] },
          });
        },
      },
      // 19. Password min length: Mật khẩu (phải có) tối thiểu X ký tự
      {
        regex: /^Mật khẩu (?:phải có )?tối thiểu (\d+) ký tự$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Password must be at least ${m[1]} characters`;
          if (locale === 'zh') return `密码 必须至少为 ${m[1]} 个字符`;
          return `Mật khẩu tối thiểu ${m[1]} ký tự`;
        },
      },
      // 20. Chỉ cho phép import tối đa N dòng mỗi lần / bệnh nhân / file ...
      {
        regex: /^Chỉ cho phép import tối đa (\d+)\s*(.*)$/i,
        translate: (m, locale) => {
          const count = m[1];
          const suffix = (m[2] || '').trim();
          if (locale === 'en') {
            if (/bệnh nhân/i.test(suffix)) {
              return `Only up to ${count} patients per file are allowed to import`;
            }
            return `Only up to ${count} rows per import are allowed`;
          }
          if (locale === 'zh') {
            if (/bệnh nhân/i.test(suffix)) {
              return `单次导入最多仅允许 ${count} 名患者`;
            }
            return `单次导入最多仅允许 ${count} 行`;
          }
          return `Chỉ cho phép import tối đa ${count} ${suffix || 'dòng mỗi lần'}`;
        },
      },
      // 21. Các tài khoản sau đã tồn tại trong hệ thống: ...
      {
        regex: /^Các tài khoản sau đã tồn tại trong hệ thống:\s*(.+)$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `The following accounts already exist in the system: ${m[1]}`;
          if (locale === 'zh') return `以下账户已存在于系统中：${m[1]}`;
          return `Các tài khoản sau đã tồn tại trong hệ thống: ${m[1]}`;
        },
      },
      // 22. Xóa thành công MODEL id: ID
      {
        regex: /^Xóa thành công (\w+) id:\s*(.+)$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Successfully deleted ${m[1]} ID: ${m[2]}`;
          if (locale === 'zh') return `成功删除 ${m[1]} ID：${m[2]}`;
          return `Xóa thành công ${m[1]} id: ${m[2]}`;
        },
      },
      // 23. Nhập thành công N món ăn vào hệ thống
      {
        regex: /^Nhập thành công (\d+) món ăn vào hệ thống$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Successfully imported ${m[1]} dishes into the system`;
          if (locale === 'zh') return `成功导入 ${m[1]} 道菜品到系统中`;
          return `Nhập thành công ${m[1]} món ăn vào hệ thống`;
        },
      },
      // 24. Đã xóa nguyên liệu thành công (ID: ...)
      {
        regex: /^Đã xóa nguyên liệu thành công \(ID:\s*(.+)\)$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Successfully deleted ingredient (ID: ${m[1]})`;
          if (locale === 'zh') return `成功删除原料 (ID: ${m[1]})`;
          return `Đã xóa nguyên liệu thành công (ID: ${m[1]})`;
        },
      },
      // 25. Nhập thành công khẩu phần 24h gồm N bữa ăn và M nguyên liệu vào hồ sơ bệnh nhân
      {
        regex:
          /^Nhập thành công khẩu phần 24h gồm (\d+) bữa ăn và (\d+) nguyên liệu vào hồ sơ bệnh nhân$/i,
        translate: (m, locale) => {
          if (locale === 'en')
            return `Successfully imported 24-hour dietary intake record with ${m[1]} meals and ${m[2]} ingredients into patient profile`;
          if (locale === 'zh')
            return `成功将包含 ${m[1]} 次进餐和 ${m[2]} 种原料的 24小时膳食摄入调查记录导入患者病历档案`;
          return `Nhập thành công khẩu phần 24h gồm ${m[1]} bữa ăn và ${m[2]} nguyên liệu vào hồ sơ bệnh nhân`;
        },
      },
      // 26. Tham số ID "..." không phải là số nguyên dương hợp lệ
      {
        regex: /^Tham số ID "([^"]+)" không phải là số nguyên dương hợp lệ$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `ID parameter "${m[1]}" is not a valid positive integer`;
          if (locale === 'zh') return `ID 参数 "${m[1]}" 不是有效的正整数`;
          return `Tham số ID "${m[1]}" không phải là số nguyên dương hợp lệ`;
        },
      },
      // 27. Tham số ID "..." không thể ép kiểu BigInt
      {
        regex: /^Tham số ID "([^"]+)" không thể ép kiểu BigInt$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `ID parameter "${m[1]}" cannot be cast to BigInt`;
          if (locale === 'zh') return `ID 参数 "${m[1]}" 无法转换为 BigInt`;
          return `Tham số ID "${m[1]}" không thể ép kiểu BigInt`;
        },
      },
      // 28. Prisma model '...' không tồn tại hoặc không hợp lệ
      {
        regex: /^Prisma model '([^']+)' không tồn tại hoặc không hợp lệ$/i,
        translate: (m, locale) => {
          if (locale === 'en') return `Prisma model '${m[1]}' does not exist or is invalid`;
          if (locale === 'zh') return `Prisma 模型 '${m[1]}' 不存在或无效`;
          return `Prisma model '${m[1]}' không tồn tại hoặc không hợp lệ`;
        },
      },
    );
  }

  private interpolate(template: string, args?: Record<string, any>): string {
    if (!args || typeof args !== 'object') return template;
    let res = template;
    for (const [param, val] of Object.entries(args)) {
      res = res.replace(new RegExp(`\\{${param}\\}`, 'g'), String(val));
    }
    return res;
  }

  /**
   * Dịch mã thông báo theo locale yêu cầu, tự động fallback về tiếng Việt
   */
  public translate(
    paramOrKey: TranslateParamDto | string,
    legacyLocale: string = DEFAULT_LOCALE,
    legacyArgs?: Record<string, any>,
  ): string {
    let key: string;
    let locale: string;
    let args: Record<string, any> | undefined;

    if (paramOrKey && typeof paramOrKey === 'object' && 'key' in paramOrKey) {
      key = paramOrKey.key;
      locale = paramOrKey.locale || DEFAULT_LOCALE;
      args = paramOrKey.args;
    } else {
      key = paramOrKey as string;
      locale = legacyLocale;
      args = legacyArgs;
    }

    if (!key) return '';

    // Xóa dấu ngoặc nhọn nếu key truyền dạng "{error.username.invalid}"
    const cleanKey = key.replace(/^\{|\}$/g, '').trim();
    const targetLocale = (
      ['vi', 'en', 'zh'].includes(locale) ? locale : DEFAULT_LOCALE
    ) as SupportedLocale;

    const currentCatalog = this.catalogs[targetLocale] || {};
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};

    let template = currentCatalog[cleanKey] || viCatalog[cleanKey];

    if (!template) {
      // Thử tra qua reverse mapping nếu key truyền vào thực chất là văn bản tiếng Việt
      const normalized = cleanKey.toLowerCase();
      const mappedKey = this.viToKeyMap.get(normalized) || this.viToKeyMap.get(cleanKey);
      if (mappedKey && currentCatalog[mappedKey]) {
        template = currentCatalog[mappedKey];
      }
    }

    if (!template) {
      template = cleanKey;
    }

    return this.interpolate(template, args);
  }

  /**
   * Dịch thông minh một key, chuỗi tiếng Việt hoặc dynamic text sang ngôn ngữ yêu cầu
   */
  public translateTextOrKey(
    paramOrText: TranslateTextOrKeyParamDto | string,
    legacyLocale: string = DEFAULT_LOCALE,
    legacyArgs?: Record<string, any>,
  ): string {
    let textOrKey: string;
    let locale: string;
    let args: Record<string, any> | undefined;

    if (paramOrText && typeof paramOrText === 'object' && 'textOrKey' in paramOrText) {
      textOrKey = paramOrText.textOrKey;
      locale = paramOrText.locale || DEFAULT_LOCALE;
      args = paramOrText.args;
    } else {
      textOrKey = paramOrText as string;
      locale = legacyLocale;
      args = legacyArgs;
    }

    if (!textOrKey || typeof textOrKey !== 'string') return '';

    const targetLocale = (
      ['vi', 'en', 'zh'].includes(locale) ? locale : DEFAULT_LOCALE
    ) as SupportedLocale;

    const clean = textOrKey.replace(/^\{|\}$/g, '').trim();

    // 1. Kiểm tra trực tiếp trong catalog theo key hoặc text
    const currentCatalog = this.catalogs[targetLocale] || {};
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};

    if (currentCatalog[clean]) {
      return this.interpolate(currentCatalog[clean], args);
    }

    // 2. Tra cứu qua reverse map nếu text gốc là tiếng Việt
    const normalized = clean.toLowerCase();
    const mappedKey = this.viToKeyMap.get(normalized) || this.viToKeyMap.get(clean);
    if (mappedKey) {
      const template = currentCatalog[mappedKey] || viCatalog[mappedKey];
      if (template) {
        return this.interpolate(template, args);
      }
    }

    // 3. Tra cứu qua dynamic pattern regex
    for (const pattern of this.dynamicPatterns) {
      const match = clean.match(pattern.regex);
      if (match) {
        return pattern.translate(match, targetLocale);
      }
    }

    // 4. Fallback về từ điển tiếng Việt hoặc giữ nguyên text gốc
    if (viCatalog[clean]) {
      return this.interpolate(viCatalog[clean], args);
    }

    return clean;
  }

  /**
   * Dịch tên trường sang tên thân thiện theo ngôn ngữ
   */
  public translateField({ field, locale = DEFAULT_LOCALE }: TranslateFieldParamDto): string {
    const targetLocale = (
      ['vi', 'en', 'zh'].includes(locale) ? locale : DEFAULT_LOCALE
    ) as SupportedLocale;

    if (!field) return '';

    // Lấy phần tên thuộc tính cuối cùng (nếu dạng nested: patient.dateOfBirth -> dateOfBirth)
    const leaf = field.includes('.') ? field.split('.').pop()! : field;
    const lowerLeaf = leaf.charAt(0).toLowerCase() + leaf.slice(1);
    const fieldKey = `field.${leaf}`;
    const lowerFieldKey = `field.${lowerLeaf}`;

    if (this.catalogs[targetLocale]?.[fieldKey]) {
      return this.catalogs[targetLocale][fieldKey];
    }
    if (this.catalogs[targetLocale]?.[lowerFieldKey]) {
      return this.catalogs[targetLocale][lowerFieldKey];
    }
    if (this.catalogs[DEFAULT_LOCALE]?.[fieldKey]) {
      return this.catalogs[DEFAULT_LOCALE][fieldKey];
    }
    if (this.catalogs[DEFAULT_LOCALE]?.[lowerFieldKey]) {
      return this.catalogs[DEFAULT_LOCALE][lowerFieldKey];
    }

    // Fallback: Chuyển camelCase hoặc snake_case thành chữ đọc được
    return leaf
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim();
  }

  /**
   * Dịch mã ràng buộc validation (ví dụ: ISNOTEMPTY, MINLENGTH) kèm tên trường thân thiện
   */
  public translateValidationConstraint({
    code,
    field,
    locale = DEFAULT_LOCALE,
    args = {},
  }: TranslateConstraintParamDto): string {
    const targetLocale = (
      ['vi', 'en', 'zh'].includes(locale) ? locale : DEFAULT_LOCALE
    ) as SupportedLocale;

    const friendlyField = this.translateField({ field, locale: targetLocale });
    const normalizedCode = (code || '').toUpperCase().replace(/[^A-Z]/g, '');

    const constraintKeyMap: Record<string, string> = {
      ISNOTEMPTY: 'validation.isNotEmpty',
      ISSTRING: 'validation.isString',
      ISNUMBER: 'validation.isNumber',
      ISINT: 'validation.isInt',
      ISBOOLEAN: 'validation.isBoolean',
      ISEMAIL: 'validation.isEmail',
      MINLENGTH: 'validation.minLength',
      MAXLENGTH: 'validation.maxLength',
      MIN: 'validation.min',
      MAX: 'validation.max',
      ISENUM: 'validation.isEnum',
      ISARRAY: 'validation.isArray',
      ARRAYNOTEMPTY: 'validation.arrayNotEmpty',
      ISDATESTRING: 'validation.isDateString',
      ISPOSITIVE: 'validation.isPositive',
      MATCHES: 'validation.matches',
    };

    const key = constraintKeyMap[normalizedCode];
    if (key && this.hasKey(key)) {
      return this.translate({
        key,
        locale: targetLocale,
        args: { field: friendlyField, ...args },
      });
    }

    // Default fallback if no specific constraint template
    if (targetLocale === 'en') return `${friendlyField} is invalid`;
    if (targetLocale === 'zh') return `${friendlyField} 无效`;
    return `${friendlyField} không hợp lệ`;
  }

  /**
   * Kiểm tra xem key có tồn tại trong từ điển không
   */
  public hasKey(key: string): boolean {
    if (!key) return false;
    const cleanKey = key.replace(/^\{|\}$/g, '').trim();
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};
    if (Boolean(viCatalog[cleanKey])) return true;
    const normalized = cleanKey.toLowerCase();
    return this.viToKeyMap.has(normalized);
  }

  public getSupportedLocales(): SupportedLocale[] {
    return ['vi', 'en', 'zh'];
  }
}
