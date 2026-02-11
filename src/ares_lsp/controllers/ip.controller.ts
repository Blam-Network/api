import {
  Controller,
  Get,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@Controller('/ip')
@ApiTags('Utilities')
export class IpController {
  @Get()
  @ApiOperation({ summary: 'Get the IP address of the requester' })
  getIp(@Req() req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    let ip: string | undefined;
    
    if (forwardedFor) {
      ip = typeof forwardedFor === 'string' 
        ? forwardedFor.split(',')[0].trim() 
        : forwardedFor[0];
    } else if (realIp) {
      ip = typeof realIp === 'string' ? realIp : realIp[0];
    } else {
      ip = req.ip || req.socket.remoteAddress || undefined;
    }
    
    if (ip === undefined) {
      throw new BadRequestException('Unable to determine IP address');
    }
    
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    
    return ip;
  }
}
