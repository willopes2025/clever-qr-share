import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { expiresIn } from '../../common/auth/token-payload';
import { TenancyModule } from '../tenancy/tenancy.module';
import { AuthController } from './auth.controller';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TenancyModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'desenvolvimento-inseguro',
      signOptions: { expiresIn: expiresIn(process.env.JWT_ACCESS_TTL, '15m') },
    }),
  ],
  controllers: [AuthController, UserAdminController],
  providers: [AuthService, UserAdminService],
  exports: [AuthService],
})
export class IamModule {}
