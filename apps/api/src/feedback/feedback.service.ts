import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { FeedbackStatus, Prisma } from '@prisma/client';
import { Paginated } from '../common/dto/pagination.dto';
import { NotFound } from '../common/errors';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto, FeedbackCommentDto, FeedbackListQueryDto } from './feedback.dto';

const POST_SELECT = {
  id: true, title: true, body: true, category: true, status: true, authorName: true, authorId: true,
  voteCount: true, downCount: true, commentCount: true, createdAt: true,
} satisfies Prisma.FeedbackPostSelect;

/** Who is acting: the signed-in account (if any) and the visitor id from the nv_fb cookie */
export interface Actor {
  user: AuthUser | null;
  visitor: string | null;
}

/**
 * Public feedback board: anyone can read, post ideas, like / dislike (one per account or browser)
 * and add to an idea. PRIVATE posts go to the team only; platform admins set the status and moderate.
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private need(user: AuthUser | null): AuthUser {
    if (!user) throw new UnauthorizedException({ code: 'SIGN_IN', message: 'Sign in to do that' });
    return user;
  }

  private isAdmin(user: AuthUser | null) {
    return user?.role === 'SYSTEM_ADMIN';
  }

  private voterKey(a: Actor) {
    return a.user ? `u:${a.user.id}` : a.visitor ? `v:${a.visitor}` : null;
  }

  private spam(website?: string) {
    if (website) throw new BadRequestException({ code: 'SPAM', message: 'Something went wrong — please try again' });
  }

  /** "Wanjiru · Savanna Creative Studio" — first name plus business, never the email */
  private async displayName(a: Actor, given?: string) {
    const user = a.user;
    if (!user) return given?.trim() || 'Anonymous';
    if (this.isAdmin(user)) return 'tuli team';
    const org = user.organizationId ? await this.prisma.organization.findUnique({ where: { id: user.organizationId }, select: { name: true } }) : null;
    const first = user.name.split(/\s+/)[0] || 'Someone';
    return org ? `${first} · ${org.name}` : first;
  }

  /** The voter's reaction per post: 1 (like) or -1 (dislike) */
  private async reactions(a: Actor, postIds: string[]) {
    const key = this.voterKey(a);
    if (!key || !postIds.length) return new Map<string, number>();
    const votes = await this.prisma.feedbackVote.findMany({ where: { voterKey: key, postId: { in: postIds } }, select: { postId: true, value: true } });
    return new Map(votes.map((v) => [v.postId, v.value]));
  }

  /** Private messages are for the team only (and their author) */
  private visibleWhere(a: Actor): Prisma.FeedbackPostWhereInput {
    if (this.isAdmin(a.user)) return {};
    return { category: { not: 'PRIVATE' } };
  }

  async list(a: Actor, q: FeedbackListQueryDto) {
    const where: Prisma.FeedbackPostWhereInput = { ...this.visibleWhere(a) };
    if (q.status) where.status = q.status;
    else where.status = { not: 'DECLINED' }; // declined ideas only show when asked for
    if (q.category && (q.category !== 'PRIVATE' || this.isAdmin(a.user))) where.category = q.category;
    if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }];
    const orderBy: Prisma.FeedbackPostOrderByWithRelationInput[] = q.sort === 'new' ? [{ createdAt: 'desc' }] : [{ voteCount: 'desc' }, { createdAt: 'desc' }];

    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.feedbackPost.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        // the latest contributions, shown under each idea
        select: { ...POST_SELECT, comments: { orderBy: { createdAt: 'desc' }, take: 2, select: { id: true, authorName: true, isTeam: true, body: true, createdAt: true } } },
      }),
      this.prisma.feedbackPost.count({ where }),
      this.prisma.feedbackPost.groupBy({ by: ['status'], where: this.visibleWhere(a), orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    const mine = await this.reactions(a, rows.map((r) => r.id));
    const page = Paginated.of(
      rows.map(({ authorId, comments, ...r }) => ({ ...r, myVote: mine.get(r.id) ?? 0, mine: !!a.user && authorId === a.user.id, recent: comments.reverse() })),
      total,
      q.page,
      q.pageSize,
    );
    const statusCounts = Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) as Partial<Record<FeedbackStatus, number>>;
    return Object.assign(page, { meta: { ...page.meta, statusCounts } });
  }

  async get(a: Actor, id: string) {
    const post = await this.prisma.feedbackPost.findUnique({
      where: { id },
      select: { ...POST_SELECT, comments: { orderBy: { createdAt: 'asc' }, select: { id: true, authorName: true, authorId: true, isTeam: true, body: true, createdAt: true } } },
    });
    if (!post) throw new NotFound('Post');
    if (post.category === 'PRIVATE' && !this.isAdmin(a.user) && !(a.user && post.authorId === a.user.id)) throw new NotFound('Post');
    const mineVote = await this.reactions(a, [id]);
    const { authorId, comments, ...rest } = post;
    return {
      ...rest,
      myVote: mineVote.get(id) ?? 0,
      mine: !!a.user && authorId === a.user.id,
      comments: comments.map(({ authorId: c, ...x }) => ({ ...x, mine: !!a.user && c === a.user.id })),
    };
  }

  /** Anyone can post — accounts under their name, visitors under the name they give (or "Guest") */
  async create(a: Actor, dto: CreateFeedbackDto) {
    this.spam(dto.website);
    const key = this.voterKey(a);
    const post = await this.prisma.feedbackPost.create({
      data: {
        title: dto.title,
        body: dto.body,
        category: dto.category ?? 'FEATURE',
        authorId: a.user?.id ?? null,
        authorName: await this.displayName(a, dto.name),
        // a public idea starts with its author's like
        ...(dto.category !== 'PRIVATE' ? { voteCount: 1, ...(key ? { votes: { create: { voterKey: key, userId: a.user?.id ?? null, value: 1 } } } : {}) } : {}),
      },
    });
    // a visitor's private message can't be read back — just confirm it was sent
    if (post.category === 'PRIVATE' && !a.user) return { id: post.id, category: post.category, private: true };
    return this.get(a, post.id);
  }

  /** Like / dislike — one per account or browser; voting the other way switches it (likes cancel dislikes and vice versa) */
  async react(a: Actor, id: string, value: 1 | -1) {
    const key = this.voterKey(a);
    if (!key) throw new BadRequestException({ code: 'NO_VOTER', message: 'Please enable cookies to vote' });
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.feedbackPost.findUnique({ where: { id }, select: { id: true, category: true } });
      if (!post || (post.category === 'PRIVATE' && !this.isAdmin(a.user))) throw new NotFound('Post');
      const where = { postId_voterKey: { postId: id, voterKey: key } };
      const existing = await tx.feedbackVote.findUnique({ where });
      const inc = { up: 0, down: 0 };
      const bump = (v: number, by: number) => (v === 1 ? (inc.up += by) : (inc.down += by));
      const myVote = value as number;
      if (existing?.value === value) {
        // already voted this way — nothing changes (switch by voting the other way)
        const cur = await tx.feedbackPost.findUniqueOrThrow({ where: { id }, select: { voteCount: true, downCount: true } });
        return { myVote, voteCount: cur.voteCount, downCount: cur.downCount };
      } else if (existing) {
        await tx.feedbackVote.update({ where, data: { value } });
        bump(existing.value, -1);
        bump(value, 1);
      } else {
        await tx.feedbackVote.create({ data: { postId: id, voterKey: key, userId: a.user?.id ?? null, value } });
        bump(value, 1);
      }
      const updated = await tx.feedbackPost.update({
        where: { id },
        data: { voteCount: { increment: inc.up }, downCount: { increment: inc.down } },
        select: { voteCount: true, downCount: true },
      });
      return { myVote, voteCount: updated.voteCount, downCount: updated.downCount };
    });
  }

  /** Add to an idea — open to everyone, like posting */
  async comment(a: Actor, id: string, dto: FeedbackCommentDto) {
    this.spam(dto.website);
    const authorName = await this.displayName(a, dto.name);
    await this.prisma.$transaction(async (tx) => {
      const post = await tx.feedbackPost.findUnique({ where: { id }, select: { id: true, category: true, authorId: true } });
      if (!post || (post.category === 'PRIVATE' && !this.isAdmin(a.user) && !(a.user && post.authorId === a.user.id))) throw new NotFound('Post');
      await tx.feedbackComment.create({ data: { postId: id, authorId: a.user?.id ?? null, authorName, isTeam: this.isAdmin(a.user), body: dto.body } });
      await tx.feedbackPost.update({ where: { id }, data: { commentCount: { increment: 1 } } });
    });
    return this.get(a, id);
  }

  async setStatus(a: Actor, id: string, status: FeedbackStatus) {
    const user = this.need(a.user);
    if (!this.isAdmin(user)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the tuli team can change the status' });
    await this.prisma.feedbackPost.update({ where: { id }, data: { status } }).catch(() => {
      throw new NotFound('Post');
    });
    return this.get(a, id);
  }

  /** Authors can delete their own post or comment; platform admins can delete anything */
  async remove(a: Actor, id: string) {
    const user = this.need(a.user);
    const post = await this.prisma.feedbackPost.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) throw new NotFound('Post');
    if (!this.isAdmin(user) && post.authorId !== user.id) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only delete your own posts' });
    await this.prisma.feedbackPost.delete({ where: { id } });
    return { ok: true };
  }

  async removeComment(a: Actor, id: string, commentId: string) {
    const user = this.need(a.user);
    const c = await this.prisma.feedbackComment.findFirst({ where: { id: commentId, postId: id }, select: { authorId: true } });
    if (!c) throw new NotFound('Comment');
    if (!this.isAdmin(user) && c.authorId !== user.id) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You can only delete your own comments' });
    await this.prisma.$transaction([
      this.prisma.feedbackComment.delete({ where: { id: commentId } }),
      this.prisma.feedbackPost.update({ where: { id }, data: { commentCount: { decrement: 1 } } }),
    ]);
    return this.get(a, id);
  }
}
