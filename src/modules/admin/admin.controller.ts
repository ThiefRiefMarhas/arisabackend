import {
  Controller, Get, Post, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/roles';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('bearer')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async dashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers(page, limit);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List all devices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listDevices(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listDevices(page, limit);
  }

  @Get('sync-jobs')
  @ApiOperation({ summary: 'List sync jobs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async listSyncJobs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.listSyncJobs(page, limit, status);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorType', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async queryLogs(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('actorId') actorId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.query({ action, actorType, actorId, page, limit });
  }

  @Post('devices/:id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a device' })
  async disableDevice(
    @Param('id') deviceId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.disableDevice(deviceId, adminId);
  }

  @Post('trigger-notification')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a push notification to a user' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'title', required: true })
  @ApiQuery({ name: 'body', required: true })
  @ApiQuery({ name: 'type', required: false, description: 'warning | weather | scan | system' })
  async triggerNotification(
    @Query('userId') userId: string,
    @Query('title') title: string,
    @Query('body') body: string,
    @Query('type') type?: string,
  ) {
    // Save to DB
    const notif = await this.notificationService.create({
      userId,
      title,
      body,
      type: type || 'system',
    });
    
    // Future: Call Firebase Cloud Messaging (FCM) or WebSocket push here
    // e.g., await this.fcmService.sendToUser(userId, { title, body, type });

    return {
      success: true,
      message: 'Notification triggered successfully',
      data: notif,
    };
  }
}
