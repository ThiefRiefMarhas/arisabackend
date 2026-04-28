import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated device from the request.
 * Usage: @CurrentDevice() device
 * Usage: @CurrentDevice('id') deviceId: string
 */
export const CurrentDevice = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const device = request.device;

    if (!device) return null;

    return data ? device[data] : device;
  },
);
