import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const THROTTLE_EXCEL_EXPORT_KEY = 'throttle_excel_export';

export interface ThrottleExcelOptions {
  maxConcurrent?: number;
}

/**
 * Decorator giới hạn số lượng tác vụ export Excel chạy đồng thời
 * Mặc định: tối đa 2 tác vụ đồng thời để bảo vệ CPU & RAM trên VPS 1 Core 2GB
 */
export const ThrottleExcelExport = (options?: ThrottleExcelOptions) =>
  SetMetadata(THROTTLE_EXCEL_EXPORT_KEY, options || { maxConcurrent: 2 });

@Injectable()
export class ExcelThrottleGuard implements CanActivate {
  private static activeJobs = 0;
  private readonly reflector = new Reflector();

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<ThrottleExcelOptions>(
      THROTTLE_EXCEL_EXPORT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const maxConcurrent = options.maxConcurrent ?? 2;

    if (ExcelThrottleGuard.activeJobs >= maxConcurrent) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message:
            'Hệ thống đang xử lý giới hạn tác vụ xuất báo cáo đồng thời. Vui lòng thử lại sau giây lát.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    ExcelThrottleGuard.activeJobs++;

    const response = context.switchToHttp().getResponse();
    if (response && typeof response.once === 'function') {
      const release = () => {
        if (ExcelThrottleGuard.activeJobs > 0) {
          ExcelThrottleGuard.activeJobs--;
        }
      };
      response.once('finish', release);
      response.once('close', release);
      response.once('error', release);
    }

    return true;
  }

  public static getActiveJobs(): number {
    return this.activeJobs;
  }

  public static resetActiveJobs(): void {
    this.activeJobs = 0;
  }
}
