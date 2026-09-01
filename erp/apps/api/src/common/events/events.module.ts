import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from './domain-events';

/** Global: qualquer módulo publica e assina sem precisar importar o vizinho. */
@Global()
@Module({ providers: [DomainEventBus], exports: [DomainEventBus] })
export class EventsModule {}
