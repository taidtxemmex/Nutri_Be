import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type SupportedLocale = 'vi' | 'en' | 'zh';
export const DEFAULT_LOCALE: SupportedLocale = 'vi';

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly catalogs: Record<string, Record<string, string>> = {};

  constructor() {
    this.loadCatalogs();
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
  }

  /**
   * Dịch mã thông báo theo locale yêu cầu, tự động fallback về tiếng Việt
   */
  public translate(
    key: string,
    locale: string = DEFAULT_LOCALE,
    args?: Record<string, any>,
  ): string {
    if (!key) return '';

    // Xóa dấu ngoặc nhọn nếu key truyền dạng "{error.username.invalid}"
    const cleanKey = key.replace(/^\{|\}$/g, '').trim();
    const targetLocale = (
      ['vi', 'en', 'zh'].includes(locale) ? locale : DEFAULT_LOCALE
    ) as SupportedLocale;

    const currentCatalog = this.catalogs[targetLocale] || {};
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};

    let template = currentCatalog[cleanKey] || viCatalog[cleanKey] || cleanKey;

    if (args && typeof args === 'object') {
      for (const [param, val] of Object.entries(args)) {
        template = template.replace(new RegExp(`\\{${param}\\}`, 'g'), String(val));
      }
    }

    return template;
  }

  /**
   * Kiểm tra xem key có tồn tại trong từ điển không
   */
  public hasKey(key: string): boolean {
    const cleanKey = key.replace(/^\{|\}$/g, '').trim();
    const viCatalog = this.catalogs[DEFAULT_LOCALE] || {};
    return Boolean(viCatalog[cleanKey]);
  }

  public getSupportedLocales(): SupportedLocale[] {
    return ['vi', 'en', 'zh'];
  }
}
