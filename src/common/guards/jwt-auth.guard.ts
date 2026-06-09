import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCode } from '../constants/error-codes';

/**
 * Verifies Supabase JWT from Authorization header.
 * Attaches the internal User record to request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];

    try {
      // Check cache first to avoid Supabase rate limits on concurrent requests
      const cacheKey = `auth_user:${token}`;
      let cachedUserId = await this.redisService.get(cacheKey);

      let authUserId = cachedUserId;

      if (!authUserId) {
        // Verify token via Supabase — this also checks session validity
        const {
          data: { user },
          error,
        } = await this.supabaseService.getClient().auth.getUser(token);

        if (error || !user) {
          throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_INVALID);
        }
        
        authUserId = user.id;
        // Cache the valid token for 5 minutes to handle concurrent bursts
        await this.redisService.set(cacheKey, authUserId, 300);
      }

      // Get our internal user record
      const dbUser = await this.prismaService.user.findUnique({
        where: { supabaseId: authUserId },
      });

      if (!dbUser) {
        throw new UnauthorizedException(ErrorCode.AUTH_USER_NOT_FOUND);
      }

      if (dbUser.status !== 'ACTIVE') {
        throw new ForbiddenException(ErrorCode.AUTH_ACCOUNT_SUSPENDED);
      }

      // Attach user to request for downstream use
      request.user = dbUser;
      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`JWT verification failed: ${error.message}`);
      throw new UnauthorizedException(ErrorCode.AUTH_TOKEN_INVALID);
    }
  }
}
