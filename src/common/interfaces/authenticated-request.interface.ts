import { Request } from 'express';

/**
 * Extended request interface with authenticated user and device info.
 * Populated by JwtAuthGuard or DeviceAuthGuard.
 */
export interface AuthenticatedRequest extends Request {
  requestId: string;
  user?: {
    id: string;
    supabaseId: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
  };
  device?: {
    id: string;
    deviceSerial: string;
    deviceName: string;
    status: string;
    pairingStatus: string;
  };
}
