import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../constants/error-codes';
import * as bcrypt from 'bcrypt';

/**
 * Verifies device identity via X-Device-Token + X-Device-Serial headers.
 * Attaches the Device record to request.device.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  private readonly logger = new Logger(DeviceAuthGuard.name);

  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceToken = request.headers['x-device-token'] as string;
    const deviceSerial = request.headers['x-device-serial'] as string;

    if (!deviceToken) {
      throw new UnauthorizedException(ErrorCode.DEVICE_TOKEN_MISSING);
    }

    if (!deviceSerial) {
      throw new UnauthorizedException(ErrorCode.DEVICE_SERIAL_MISSING);
    }

    const device = await this.prismaService.device.findUnique({
      where: { deviceSerial },
      include: {
        owners: {
          where: { revokedAt: null },
          select: { userId: true },
        },
      },
    });

    if (!device) {
      throw new UnauthorizedException(ErrorCode.DEVICE_NOT_FOUND);
    }

    if (device.status !== 'ACTIVE') {
      throw new ForbiddenException(ErrorCode.DEVICE_DISABLED);
    }

    // Verify token hash
    const isValid = await bcrypt.compare(deviceToken, device.tokenHash);
    if (!isValid) {
      this.logger.warn(
        `Invalid device token attempt for serial: ${deviceSerial}`,
      );
      throw new UnauthorizedException(ErrorCode.DEVICE_TOKEN_INVALID);
    }

    // Update last seen (fire and forget)
    this.prismaService.device
      .update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});

    // Attach device + owner info to request
    request.device = {
      id: device.id,
      deviceSerial: device.deviceSerial,
      deviceName: device.deviceName,
      status: device.status,
      pairingStatus: device.pairingStatus,
      ownerIds: device.owners.map((o) => o.userId),
    };

    return true;
  }
}
