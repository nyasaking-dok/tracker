import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Plaspy-mimic REST API')
    .setDescription(
      'NestJS backend mimicking the Plaspy satellite tracking platform REST API. ' +
        'Authenticate via POST /api/Auth/Token, then use the Bearer token. ' +
        'Every response is wrapped in the Plaspy envelope: ' +
        '{ success, error, apiUsage, apiDailyUsage, ...payload }.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Ingest-Key', in: 'header' }, 'X-Ingest-Key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port);
  console.log(`Plaspy-mimic server running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}
bootstrap();
