import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupportedLocale, DEFAULT_LOCALE } from '../../core/i18n/i18n.service';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      locale?: SupportedLocale;
    }
  }
}

@Injectable()
export class I18nLocaleMiddleware implements NestMiddleware {
  private readonly supportedLocales: Set<string> = new Set(['vi', 'en', 'zh']);

  use(req: Request, res: Response, next: NextFunction) {
    // 1. Kiểm tra query param ?lang= (cho phép override nhanh khi test)
    const queryLang = typeof req.query?.lang === 'string' ? req.query.lang.toLowerCase() : '';
    if (this.supportedLocales.has(queryLang)) {
      req.locale = queryLang as SupportedLocale;
      res.setHeader('Content-Language', queryLang);
      return next();
    }

    // 2. Kiểm tra header Accept-Language
    const acceptLanguage = req.headers['accept-language'] || '';
    let chosenLocale: SupportedLocale = DEFAULT_LOCALE;

    if (acceptLanguage) {
      // Ví dụ: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6
      const segments = acceptLanguage.split(',');
      for (const segment of segments) {
        const langCode = segment.split(';')[0].trim().substring(0, 2).toLowerCase();
        if (this.supportedLocales.has(langCode)) {
          chosenLocale = langCode as SupportedLocale;
          break;
        }
      }
    }

    req.locale = chosenLocale;
    res.setHeader('Content-Language', chosenLocale);
    next();
  }
}
