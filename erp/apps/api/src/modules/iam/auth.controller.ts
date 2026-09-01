import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { AuthService } from './auth.service';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const terminalSchema = z.object({ deviceToken: z.string().min(10) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>) {
    return this.auth.loginWithPassword(body.email, body.password);
  }

  @Public()
  @Post('terminal')
  terminal(@Body(new ZodValidationPipe(terminalSchema)) body: z.infer<typeof terminalSchema>) {
    return this.auth.authenticateTerminal(body.deviceToken);
  }
}
