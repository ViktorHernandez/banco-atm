import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  const origenes = configService.get<string>('CORS_ORIGIN');

  app.enableCors({
    origin: origenes ? origenes.split(',').map((item) => item.trim()) : true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const configuracionSwagger = new DocumentBuilder()
    .setTitle('API Bancaria - Ecosistema Banco ATM')
    .setDescription(
      'API comun consumida por el ATM, la aplicacion movil y el portal web (RNF-01 / HU-BE-09)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documento = SwaggerModule.createDocument(app, configuracionSwagger);
  SwaggerModule.setup('docs', app, documento);

  if (configService.get<string>('SERVE_ATM') === 'true') {
    const rutaAtm = resolve(process.cwd(), '..', 'atm-client');
    if (existsSync(rutaAtm)) {
      app.useStaticAssets(rutaAtm, { prefix: '/atm' });
      logger.log(`Interfaz ATM servida desde ${rutaAtm} en /atm`);
    } else {
      logger.warn(`No se encontro la carpeta del ATM en ${rutaAtm}`);
    }
  }

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API escuchando en el puerto ${port}`);
  logger.log(`Documentacion disponible en /docs`);
}

bootstrap();
