// File: scripts/repro_phase6_analytics.ts
// Reproduction script for Phase 6 AI Monitoring endpoints
// This script tests the current state before implementation

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';

const logger = new Logger('ReproPhase6Analytics');

async function testAnalyticsEndpoint() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);

  logger.log('=== Testing T036: Analytics Summary ===');
  try {
    const result = await aiService.getAnalyticsSummary();
    logger.log('✓ PASS: getAnalyticsSummary() exists and returned results');
    // logger.debug(JSON.stringify(result, null, 2));
  } catch (error: any) {
    logger.error(
      '✗ FAIL: getAnalyticsSummary() threw an error:',
      error.message
    );
    process.exit(1);
  }

  logger.log('\n=== Testing T037: Single Audit Log Delete ===');
  try {
    const result = await aiService.deleteAuditLogByPublicId('test-uuid', 1);
    logger.log('✓ PASS: deleteAuditLogByPublicId() exists');
  } catch (error: any) {
    // It might throw NotFound if test-uuid doesn't exist, which is also a form of existence proof
    if (
      error.message.includes('not found') ||
      error.message.includes('NotFound')
    ) {
      logger.log(
        '✓ PASS: deleteAuditLogByPublicId() exists (returned NotFound as expected)'
      );
    } else {
      logger.error(
        '✗ FAIL: deleteAuditLogByPublicId() threw unexpected error:',
        error.message
      );
      process.exit(1);
    }
  }

  await app.close();
  logger.log('\n=== Reproduction Script Complete ===');
  logger.log('Both methods are verified to exist.');
}

testAnalyticsEndpoint().catch((error) => {
  logger.error('Script failed:', error);
  process.exit(1);
});
