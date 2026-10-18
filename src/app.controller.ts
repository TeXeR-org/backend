import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';
import { readFileSync } from 'fs';
import { join } from 'path';

/** The running build's version, read once from package.json (dist sits beside it). */
const VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;
  } catch {
    return process.env.npm_package_version || 'unknown';
  }
})();

@Public()
@Controller()
export class AppController {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  /** What answers at the API's root: its name and version, and where to look next. */
  @Get()
  getRoot() {
    return {
      name: 'TeXeR API',
      status: 'ok',
      version: VERSION,
      health: '/health',
      ready: '/ready',
      docs: 'https://texer.org/docs/api',
    };
  }

  /** Liveness, for the platform's health check (railway.toml's healthcheckPath): 200 whenever the process runs, with whether the database answers in `status`. A deploy is not held back by a database blip; /ready is the check that fails without the database. */
  @Get('health')
  async getHealth() {
    const dbHealthy = await this.prismaService.healthCheck();
    const poolStats = this.prismaService.getPoolStats();
    const uptime = process.uptime();

    const status = {
      status: dbHealthy ? 'healthy' : 'degraded',
      version: VERSION,
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      database: dbHealthy ? 'connected' : 'unreachable',
      pool: poolStats,
      timestamp: new Date().toISOString(),
    };

    return status;
  }

  /**
   * RFC 9116: security vulnerability disclosure policy.
   * https://securitytxt.org/
   */
  @Get('.well-known/security.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  getSecurityTxt(): string {
    return [
      'Contact: mailto:security@texer.org',
      'Preferred-Languages: en',
      'Canonical: https://api.texer.org/.well-known/security.txt',
      `Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}`,
      'Policy: https://texer.org/security',
    ].join('\n');
  }
}
