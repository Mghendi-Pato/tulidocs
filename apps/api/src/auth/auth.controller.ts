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
import { ChangePasswordDto, DeleteAccountDto, ForgotPasswordDto, ResetPasswordDto, ResendVerificationDto, VerifyEmailDto, LoginDto, ProfileDto, SignupDto } from './dto/auth.dto';
import { AUTH_COOKIE } from './jwt.strategy';
import { DEVICE_COOKIE, LoginContext, LoginGuardService } from './login-guard.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly guard: LoginGuardService,
  ) {}

  private loginContext(req: Request): LoginContext {
    return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, deviceId: (req.cookies as Record<string, string> | undefined)?.[DEVICE_COOKIE] ?? null };
  }

  /** Remembers this browser for the user (new-device alert if it's unfamiliar) and keeps its id in a long-lived cookie. */
  private async noteDevice(req: Request, res: Response, user: { id: string; email: string; name: string | null }, method: 'password' | 'Google' | 'Apple', alert = true) {
    const id = await this.guard.noteSignIn(user, this.loginContext(req), method, alert);
    res.cookie(DEVICE_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: this.config.get('COOKIE_SECURE') === 'true', path: '/', maxAge: 400 * 24 * 3600 * 1000 });
  }

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
  async login(@Body() dto: LoginDto, @GuestToken() guest: string | null, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user, claimed } = await this.auth.login(dto.email, dto.password, guest, this.loginContext(req));
    setAuthCookie(res, this.config, token, dto.remember !== false);
    await this.noteDevice(req, res, user, 'password');
    if (guest) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return { user, claimed };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @GuestToken() guest: string | null, @Res({ passthrough: true }) res: Response) {
    // no session yet: the emailed link confirms the address and signs the user in
    const r = await this.auth.signup(dto, guest, dto.next);
    if (guest && r.claimed) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return r;
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error || !code || !state) return res.redirect(`${this.appUrl()}/login/?error=${error === 'access_denied' ? 'google_cancelled' : 'google'}`);
    try {
      const { token, next, user } = await this.auth.googleCallback(code, state, guest);
      setAuthCookie(res, this.config, token);
      await this.noteDevice(req, res, user, 'Google');
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
  async appleFinish(@Query('k') k: string | undefined, @GuestToken() guest: string | null, @Req() req: Request, @Res() res: Response) {
    const parked = k ? await this.redis.take<{ code: string; state: string; user: string | null }>(`apple-cb:${k}`) : null;
    if (!parked) return res.redirect(`${this.appUrl()}/login/?error=oauth_state`);
    try {
      const { token, next, user } = await this.auth.appleCallback(parked.code, parked.state, parked.user ?? undefined, guest);
      setAuthCookie(res, this.config, token);
      await this.noteDevice(req, res, user, 'Apple');
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
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // end the session on the server too, not just in this browser
    await this.auth.revokeSession((req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE]);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** "Log out everywhere": signs out every other device and browser. This one gets a fresh session and stays in. */
  @AnyAccount()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const { token } = await this.auth.logoutEverywhere(user);
    setAuthCookie(res, this.config, token);
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

  /** Delete account, step 1 (signed in): emails a confirmation link */
  @AnyAccount()
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @Post('delete-account/request')
  @HttpCode(200)
  requestDeletion(@CurrentUser() user: AuthUser) {
    return this.auth.requestAccountDeletion(user);
  }

  /** The confirmation page checks its link first */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  @Get('delete-account')
  checkDeletion(@Query('token') token: string | undefined) {
    return this.auth.checkAccountDeletion(String(token ?? ''));
  }

  /** Step 2: the emailed link confirms it — the account is closed and this browser signed out */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @Post('delete-account')
  @HttpCode(200)
  async confirmDeletion(@Body() dto: DeleteAccountDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.confirmAccountDeletion(dto.token);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return r;
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
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.resetPassword(dto.token, dto.password);
    setAuthCookie(res, this.config, token);
    await this.noteDevice(req, res, user, 'password', false);
    return { user };
  }

  /** Confirms the address from the emailed link and signs the user in */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 15 * 60_000 } })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user, next } = await this.auth.verifyEmail(dto.token);
    setAuthCookie(res, this.config, token);
    await this.noteDevice(req, res, user, 'password', false);
    return { user, next };
  }

  /** Re-sends the confirmation link (from the sign-up and sign-in screens). Same answer for every address. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }
}
