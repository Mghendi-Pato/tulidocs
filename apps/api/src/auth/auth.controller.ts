import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { requestCountry } from '../common/request-country';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AnyAccount, CurrentUser, GUEST_COOKIE, GuestToken, Public } from '../common/decorators';
import { AuthUser } from '../common/types';
import { randomBytes } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';
import { setAuthCookie } from './cookie';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, LoginDto, ProfileDto, SignupDto } from './dto/auth.dto';
import { AUTH_COOKIE } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private appUrl() {
    return this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  private apiUrl() {
    return this.config.get<string>('API_PUBLIC_URL', `${this.appUrl()}/api`).replace(/\/$/, '');
  }

  /** Product name, and which sign-in options are on (public, no secrets) */
  @Public()
  @Get('config')
  configInfo() {
    return this.auth.config_();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @GuestToken() guest: string | null, @Res({ passthrough: true }) res: Response) {
    const { token, user, claimed } = await this.auth.login(dto.email, dto.password, guest);
    setAuthCookie(res, this.config, token, dto.remember !== false);
    if (guest) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return { user, claimed };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @GuestToken() guest: string | null, @Res({ passthrough: true }) res: Response) {
    const { token, user, claimed } = await this.auth.signup(dto, guest);
    setAuthCookie(res, this.config, token);
    if (guest) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return { user, claimed };
  }

  /** Step 1 of Google sign-in: redirect to Google's account chooser */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google')
  async google(@Query('next') next: string | undefined, @Query('country') country: string | undefined, @Req() req: Request, @Res() res: Response) {
    try {
      res.redirect(await this.auth.googleStart(next, requestCountry(req, country)));
    } catch {
      res.redirect(`${this.appUrl()}/login/?error=google_disabled`);
    }
  }

  /** Step 2: Google sends the user back here */
  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @GuestToken() guest: string | null,
    @Res() res: Response,
  ) {
    if (error || !code || !state) return res.redirect(`${this.appUrl()}/login/?error=${error === 'access_denied' ? 'google_cancelled' : 'google'}`);
    try {
      const { token, next } = await this.auth.googleCallback(code, state, guest);
      setAuthCookie(res, this.config, token);
      if (guest) res.clearCookie(GUEST_COOKIE, { path: '/' });
      return res.redirect(`${this.appUrl()}${next}`);
    } catch (e) {
      const code = (e as { response?: { code?: string } }).response?.code ?? 'google';
      return res.redirect(`${this.appUrl()}/login/?error=${encodeURIComponent(code.toLowerCase())}`);
    }
  }

  /** Step 1 of Sign in with Apple: redirect to Apple */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('apple')
  async apple(@Query('next') next: string | undefined, @Query('country') country: string | undefined, @Req() req: Request, @Res() res: Response) {
    try {
      res.redirect(await this.auth.appleStart(next, requestCountry(req, country)));
    } catch {
      res.redirect(`${this.appUrl()}/login/?error=apple_disabled`);
    }
  }

  /**
   * Step 2: Apple POSTs the result here (form_post). Cookies set to SameSite=Lax aren't sent on that
   * cross-site POST, so we park the result for a moment and continue with a normal GET (step 3).
   */
  @Public()
  @Post('apple/callback')
  async appleCallback(@Body() body: Record<string, string | undefined>, @Res() res: Response) {
    if (body.error || !body.code || !body.state) {
      return res.redirect(303, `${this.appUrl()}/login/?error=${body.error === 'user_cancelled_authorize' ? 'apple_cancelled' : 'apple'}`);
    }
    const k = randomBytes(18).toString('base64url');
    await this.redis.setJson(`apple-cb:${k}`, { code: body.code, state: body.state, user: body.user ?? null }, 120);
    return res.redirect(303, `${this.apiUrl()}/auth/apple/finish?k=${k}`);
  }

  /** Step 3: same-site GET — now the guest cookie is available to claim documents made before signing in */
  @Public()
  @Get('apple/finish')
  async appleFinish(@Query('k') k: string | undefined, @GuestToken() guest: string | null, @Res() res: Response) {
    const parked = k ? await this.redis.take<{ code: string; state: string; user: string | null }>(`apple-cb:${k}`) : null;
    if (!parked) return res.redirect(`${this.appUrl()}/login/?error=oauth_state`);
    try {
      const { token, next } = await this.auth.appleCallback(parked.code, parked.state, parked.user ?? undefined, guest);
      setAuthCookie(res, this.config, token);
      if (guest) res.clearCookie(GUEST_COOKIE, { path: '/' });
      return res.redirect(`${this.appUrl()}${next}`);
    } catch (e) {
      const code = (e as { response?: { code?: string } }).response?.code ?? 'apple';
      return res.redirect(`${this.appUrl()}/login/?error=${encodeURIComponent(code === 'OAUTH_FAILED' ? 'apple' : code.toLowerCase())}`);
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @AnyAccount()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @AnyAccount()
  @Patch('profile')
  profile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.auth.updateProfile(user, dto.name);
  }

  /** Change password (signed in). Other devices are signed out; this one gets a fresh session. */
  @AnyAccount()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password')
  @HttpCode(200)
  async password(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.auth.changePassword(user, dto);
    setAuthCookie(res, this.config, token);
    return { ok: true };
  }

  /** "Forgot password?" — emails a one-time link. Same answer whether or not the account exists. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  @Get('reset-password')
  checkReset(@Query('token') token: string) {
    return this.auth.checkResetToken(String(token ?? ''));
  }

  /** Sets the new password from the emailed link and signs the user in */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.resetPassword(dto.token, dto.password);
    setAuthCookie(res, this.config, token);
    return { user };
  }
}
