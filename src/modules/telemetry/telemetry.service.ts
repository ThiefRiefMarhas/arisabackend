import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async push(deviceId: string, data: any) {
    const record = await this.prisma.telemetry.create({
      data: {
        deviceId,
        cpuTemp: data.cpuTemp,
        cpuUsage: data.cpuUsage,
        ramUsage: data.ramUsage,
        diskUsage: data.diskUsage,
        uptime: data.uptime,
        networkStatus: data.networkStatus,
        batteryStatus: data.batteryStatus,
        metadata: data.metadata || null,
      },
    });
    return { id: record.id, createdAt: record.createdAt };
  }

  async getHistory(deviceId: string, userId: string, limit: number = 50) {
    // Verify user owns device
    const ownership = await this.prisma.userDevice.findFirst({
      where: { deviceId, userId, revokedAt: null },
    });
    if (!ownership) {
      throw new ForbiddenException(ErrorCode.DATA_OWNERSHIP_DENIED);
    }

    return this.prisma.telemetry.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      select: {
        id: true,
        cpuTemp: true,
        cpuUsage: true,
        ramUsage: true,
        diskUsage: true,
        uptime: true,
        networkStatus: true,
        createdAt: true,
      },
    });
  }
}
