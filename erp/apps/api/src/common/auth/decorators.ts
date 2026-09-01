import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { requireContext, type RequestContext } from '../tenancy/request-context';

export const PUBLIC_KEY = 'auth:public';
export const PERMISSIONS_KEY = 'auth:permissions';
export const FEATURE_KEY = 'auth:feature';

/** Rota aberta (login, health). Tudo o mais exige token. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Exige uma permissão do papel do usuário, verificada no servidor. */
export const RequiresPermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Exige que a feature esteja liberada no plano contratado pelo tenant. */
export const RequiresFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);

export const Ctx = createParamDecorator((_: unknown, __: ExecutionContext): RequestContext => requireContext());
