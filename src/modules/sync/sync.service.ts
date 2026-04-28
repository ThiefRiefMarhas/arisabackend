import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncPushDto, SyncBatchDto, SyncAckDto } from './dto';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Push a single sync item from device to cloud.
   * IDEMPOTENT: if requestId already exists, return existing job.
   */
  async push(dto: SyncPushDto, deviceId: string) {
    // Idempotency check
    const existing = await this.prisma.syncJob.findUnique({
      where: { requestId: dto.requestId },
    });

    if (existing) {
      this.logger.log(`Duplicate sync push ignored: ${dto.requestId}`);
      return {
        jobId: existing.id,
        requestId: existing.requestId,
        status: existing.status,
        duplicate: true,
      };
    }

    // Validate device-user ownership
    await this.validateDeviceOwnership(deviceId, dto.userId);

    // Create sync job (processing inline since BullMQ requires Redis)
    const syncJob = await this.prisma.syncJob.create({
      data: {
        requestId: dto.requestId,
        deviceId,
        userId: dto.userId,
        payloadType: dto.eventType,
        payloadRaw: dto.payload as any,
        status: 'PENDING',
      },
    });

    // Process immediately (in production with Redis, this would be queued via BullMQ)
    await this.processJob(syncJob.id);

    return {
      jobId: syncJob.id,
      requestId: syncJob.requestId,
      status: 'SYNCED',
      duplicate: false,
    };
  }

  /**
   * Push a batch of sync items.
   */
  async pushBatch(dto: SyncBatchDto, deviceId: string) {
    if (dto.items.length > 100) {
      throw new BadRequestException(ErrorCode.SYNC_BATCH_TOO_LARGE);
    }

    const results: any[] = [];
    let accepted = 0;
    let skipped = 0;

    for (const item of dto.items) {
      try {
        const result = await this.push(item, deviceId);
        results.push({
          requestId: item.requestId,
          jobId: result.jobId,
          status: result.duplicate ? 'SKIPPED' : 'ACCEPTED',
        });
        if (result.duplicate) skipped++;
        else accepted++;
      } catch (error) {
        results.push({
          requestId: item.requestId,
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    return { accepted, skipped, failed: results.length - accepted - skipped, results };
  }

  /**
   * Get sync job status.
   */
  async getJobStatus(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        requestId: true,
        status: true,
        payloadType: true,
        retryCount: true,
        errorMessage: true,
        processedAt: true,
        createdAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException(ErrorCode.SYNC_JOB_NOT_FOUND);
    }

    return job;
  }

  /**
   * Acknowledge synced items — mark as fully processed.
   */
  async acknowledge(dto: SyncAckDto) {
    const result = await this.prisma.syncJob.updateMany({
      where: {
        id: { in: dto.jobIds },
        status: 'SYNCED',
      },
      data: {
        status: 'SYNCED', // Already synced — just confirm
      },
    });

    return { acknowledged: result.count };
  }

  /**
   * Pull updates from cloud (Cloud → Pi direction).
   */
  async pull(since: string, limit: number = 50, userId?: string) {
    const sinceDate = new Date(since);

    const items = await this.prisma.coreData.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        ...(userId && { userId }),
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        dataType: true,
        dataJson: true,
        version: true,
        source: true,
        updatedAt: true,
      },
    });

    const cursor =
      items.length > 0
        ? items[items.length - 1].updatedAt.toISOString()
        : since;

    return {
      items,
      cursor,
      count: items.length,
    };
  }

  /**
   * Process a sync job — write to core_data.
   * In production, this runs in BullMQ worker.
   */
  private async processJob(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return;

    try {
      // Update job to PROCESSING
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING' },
      });

      // Check for conflict (existing data with same requestId as eventId)
      const existing = await this.prisma.coreData.findUnique({
        where: { eventId: job.requestId },
      });

      if (existing) {
        // LWW conflict resolution: keep cloud version if newer
        if (existing.version >= (job.payloadRaw as any)?.version || 1) {
          // Cloud wins — skip
          await this.prisma.syncJob.update({
            where: { id: jobId },
            data: {
              status: 'SYNCED',
              processedAt: new Date(),
            },
          });
          return;
        }

        // Pi has newer version — update
        await this.prisma.coreData.update({
          where: { id: existing.id },
          data: {
            dataJson: job.payloadRaw as any,
            version: (job.payloadRaw as any)?.version || 1,
            source: 'edge',
          },
        });
      } else {
        // No conflict — create new record
        await this.prisma.coreData.create({
          data: {
            userId: job.userId,
            deviceId: job.deviceId,
            dataType: job.payloadType,
            dataJson: job.payloadRaw as any,
            version: (job.payloadRaw as any)?.version || 1,
            source: 'edge',
            eventId: job.requestId,
          },
        });
      }

      // Mark job as synced
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'SYNCED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          retryCount: { increment: 1 },
        },
      });
    }
  }

  /**
   * Validate that device is owned by the specified user.
   */
  private async validateDeviceOwnership(
    deviceId: string,
    userId: string,
  ) {
    const ownership = await this.prisma.userDevice.findFirst({
      where: {
        deviceId,
        userId,
        revokedAt: null,
      },
    });

    if (!ownership) {
      throw new BadRequestException(ErrorCode.SYNC_OWNERSHIP_MISMATCH);
    }
  }
}
