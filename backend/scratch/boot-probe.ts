import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
async function probe() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  console.log('BOOT_OK');
  await app.close();
  process.exit(0);
}
probe().catch((e) => {
  console.error('BOOT_FAIL', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
