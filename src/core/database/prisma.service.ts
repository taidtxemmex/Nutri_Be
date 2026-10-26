import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export const SOFT_DELETE_MODELS = [
  'nguoi_dung',
  'ho_so_ca_nhan',
  'benh_nhan',
  'mon_an',
  'nguyen_lieu',
  'thuc_don',
  'goi',
];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL || 'mysql://dangtai:12345678@127.0.0.1:3306/dinhduong';
    const adapter = new PrismaMariaDb(url);

    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    // Fix BigInt serialization in JSON responses
    (BigInt.prototype as any).toJSON = function () {
      return this.toString();
    };

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // Prisma 7 Client Extensions ($extends) replacing removed $use middleware
    const extended = this.$extends({
      query: {
        $allModels: {
          async delete({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              return (self as any)[model].update({
                ...args,
                data: {
                  deleted_at: new Date(),
                  ...(model === 'nguoi_dung' ? { active: false } : {}),
                },
              });
            }
            return query(args);
          },
          async deleteMany({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              return (self as any)[model].updateMany({
                where: args?.where,
                data: {
                  deleted_at: new Date(),
                  ...(model === 'nguoi_dung' ? { active: false } : {}),
                },
              });
            }
            return query(args);
          },
          async findMany({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              args.where = { ...args.where };
              if (args.where.deleted_at === undefined) {
                args.where.deleted_at = null;
              }
            }
            return query(args);
          },
          async findFirst({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              args.where = { ...args.where };
              if (args.where.deleted_at === undefined) {
                args.where.deleted_at = null;
              }
            }
            return query(args);
          },
          async findUnique({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            const result = await query(args);
            if (result && SOFT_DELETE_MODELS.includes(model) && (result as any).deleted_at) {
              return null;
            }
            return result;
          },
          async count({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              args.where = { ...args.where };
              if (args.where.deleted_at === undefined) {
                args.where.deleted_at = null;
              }
            }
            return query(args);
          },
          async aggregate({
            model,
            args,
            query,
          }: {
            model: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (SOFT_DELETE_MODELS.includes(model)) {
              args.where = { ...args.where };
              if (args.where.deleted_at === undefined) {
                args.where.deleted_at = null;
              }
            }
            return query(args);
          },
        },
      },
    });

    (extended as any).onModuleInit = async () => {
      await (self as any).$connect();
    };
    (extended as any).onModuleDestroy = async () => {
      await (self as any).$disconnect();
    };

    return extended as any;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
