import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/** BigInt do Postgres precisa virar número no JSON — senão o Express estoura. */
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(this: bigint) {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Soul ERP API em http://localhost:${port}/v1 (docs em /v1/docs)`);
}

void bootstrap();
