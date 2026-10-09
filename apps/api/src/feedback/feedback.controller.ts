import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { OptionalUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CreateFeedbackDto, FeedbackCommentDto, FeedbackListQueryDto, FeedbackReactDto, FeedbackStatusDto } from './feedback.dto';
import { Actor, FeedbackService } from './feedback.service';

/** Anonymous voter id — one vote per idea per browser for visitors without an account */
const VOTER_COOKIE = 'nv_fb';

/** Public feedback board — open to everyone; moderation checks the session in the service */
@Public()
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly config: ConfigService,
  ) {}

  private visitor(req: Request) {
    const v = (req as Request & { cookies?: Record<string, string> }).cookies?.[VOTER_COOKIE];
    return v && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
  }

  /** Reads the voter cookie, issuing one when a visitor first votes / posts */
  private actor(user: AuthUser | null, req: Request, res?: Response): Actor {
    let visitor = this.visitor(req);
    if (!user && !visitor && res) {
      visitor = randomBytes(18).toString('base64url');
      res.cookie(VOTER_COOKIE, visitor, { httpOnly: true, sameSite: 'lax', secure: this.config.get('COOKIE_SECURE') === 'true', path: '/', maxAge: 400 * 86_400_000 });
    }
    return { user, visitor };
  }

  @Get()
  list(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Query() q: FeedbackListQueryDto) {
    return this.feedback.list(this.actor(user, req), q);
  }

  @Get(':id')
  get(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.get(this.actor(user, req), id);
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post()
  create(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(this.actor(user, req, res), dto);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/vote')
  vote(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Res({ passthrough: true }) res: Response, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackReactDto) {
    return this.feedback.react(this.actor(user, req, res), id, dto.value);
  }

  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post(':id/comments')
  comment(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackCommentDto) {
    return this.feedback.comment(this.actor(user, req), id, dto);
  }

  @Patch(':id/status')
  status(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackStatusDto) {
    return this.feedback.setStatus(this.actor(user, req), id, dto.status);
  }

  @Delete(':id')
  remove(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.remove(this.actor(user, req), id);
  }

  @Delete(':id/comments/:commentId')
  removeComment(@OptionalUser() user: AuthUser | null, @Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.feedback.removeComment(this.actor(user, req), id, commentId);
  }
}
