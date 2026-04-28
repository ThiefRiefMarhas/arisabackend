import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  actorType: 'USER' | 'DEVICE' | 'SYSTEM';
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget — never blocks caller.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorType: entry.actorType,
          actorId: entry.actorId,
          targetType: entry.targetType || null,
          targetId: entry.targetId || null,
          metadata: (entry.metadata as any) || null,
          ipAddress: entry.ipAddress || null,
        },
      });
    } catch (error) {
      // Audit logging should never crash the app
      this.logger.error(`Audit log failed: ${error.message}`);
    }
  }

  /**
   * Query audit logs (admin only).
   */
  async query(filters: {
    action?: string;
    actorType?: string;
    actorId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);

    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.actorType) where.actorType = filters.actorType;
    if (filters.actorId) where.actorId = filters.actorId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
