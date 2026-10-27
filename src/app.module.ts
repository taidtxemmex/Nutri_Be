import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/database/prisma.module';
import { CacheModule } from './core/cache/cache.module';
import { I18nModule } from './core/i18n/i18n.module';
import { I18nLocaleMiddleware } from './common/middlewares/i18n-locale.middleware';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { NutritionEngineModule } from './core/nutrition-engine/nutrition-engine.module';
import { MasterDataModule } from './modules/master-data.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { DishesModule } from './modules/dishes/dishes.module';
import { MealsModule } from './modules/meals/meals.module';
import { CoefficientsModule } from './modules/coefficients/coefficients.module';
import { EvidencesModule } from './modules/evidences/evidences.module';
import { MenusModule } from './modules/menus/menus.module';
import { MenuProposalsModule } from './modules/menu-proposals/menu-proposals.module';
import { NutritionLimitSetsModule } from './modules/nutrition-limit-sets/nutrition-limit-sets.module';
import { DailyIntakesModule } from './modules/daily-intakes/daily-intakes.module';
import { PatientsModule } from './modules/patients/patients.module';
import { IngredientProposalsModule } from './modules/ingredient-proposals/ingredient-proposals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    CacheModule,
    I18nModule,
    SecurityModule,
    NutritionEngineModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    PatientsModule,
    IngredientProposalsModule,
    MasterDataModule,
    IngredientsModule,
    DishesModule,
    MealsModule,
    CoefficientsModule,
    EvidencesModule,
    MenusModule,
    MenuProposalsModule,
    NutritionLimitSetsModule,
    DailyIntakesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nLocaleMiddleware).forRoutes('*');
  }
}
