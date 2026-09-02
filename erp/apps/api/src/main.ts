import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

/** BigInt do Postgres precisa virar número no JSON — senão o Express estoura. */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(this: bigint) {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true, credentials: true });
  // A validação de entrada é feita com os schemas Zod compartilhados com o PDV.

  const swagger = new DocumentBuilder()
    .setTitle('Soul ERP API')
    .setDescription('Frente de caixa, fiscal e performance do PDV')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, swagger));

  serveWebApps(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Soul ERP API em http://localhost:${port}/v1 (docs em /v1/docs)`);
}

/**
 * Em produção o mesmo processo serve a API e as duas aplicações web:
 *
 *   /        → retaguarda
 *   /pdv     → frente de caixa
 *   /v1      → API
 *
 * Um domínio, um contêiner, sem CORS entre as partes. Para um MVP com poucos
 * quiosques isso vale mais que separar em três serviços — e separar depois é
 * trocar o Dockerfile, não o código.
 */
function serveWebApps(app: NestExpressApplication): void {
  const publicDir = process.env.PUBLIC_DIR ?? join(__dirname, '..', 'public');
  if (!existsSync(publicDir)) return;

  const bundles = [
    { dir: join(publicDir, 'pdv'), prefix: '/pdv' },
    { dir: join(publicDir, 'web'), prefix: '/' },
  ].filter((bundle) => existsSync(bundle.dir));

  for (const bundle of bundles) {
    app.useStaticAssets(bundle.dir, { prefix: bundle.prefix, index: false });
  }

  // Rota de aplicação (/produtos, /pdv/qualquer-coisa) devolve o index.html
  // correspondente — sem isso, recarregar a página daria 404.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' || request.path.startsWith('/v1')) return next();

    const bundle = bundles.find((candidate) =>
      candidate.prefix === '/' ? true : request.path.startsWith(candidate.prefix),
    );
    if (!bundle) return next();

    return response.sendFile(join(bundle.dir, 'index.html'));
  });

  new Logger('Bootstrap').log(`Servindo ${bundles.length} aplicação(ões) web de ${publicDir}`);
}

void bootstrap();
