import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';

import { Attachment } from '../attachments/entities/attachment.entity';
import { UserFollow } from './entities/user-follow.entity';
import { User } from './entities/user.entity';

export interface CreateUserData {
  email: string;
  password: string; // already hashed
  name?: string;
}

export interface UpdateUserData {
  name?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const PUBLIC_AVATAR_PREFIX = '/uploads/avatars';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    @InjectRepository(UserFollow)
    private readonly followsRepository: Repository<UserFollow>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async getProfile(userId: string, viewerId?: string): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(this.translate('users.USER_NOT_FOUND'));
    }

    return this.toProfile(user, viewerId);
  }

  async updateProfile(
    userId: string,
    data: UpdateUserData,
    avatarFile?: Express.Multer.File,
  ): Promise<UserProfile> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.translate('users.USER_NOT_FOUND'));
    }

    const nextName = data.name?.trim();

    if (nextName !== undefined) {
      user.name = nextName || null;
    }

    const previousAvatar = await this.attachmentsRepository.findOne({
      where: { attachableType: 'user', attachableId: user.id },
    });

    if (avatarFile) {
      this.assertAvatarFile(avatarFile);

      const createdAvatar = await this.attachmentsRepository.save(
        this.attachmentsRepository.create({
          attachableType: 'user',
          attachableId: user.id,
          url: `${PUBLIC_AVATAR_PREFIX}/${avatarFile.filename}`,
          fileName: avatarFile.originalname,
          fileType: avatarFile.mimetype,
          fileSize: avatarFile.size,
        }),
      );

      user.avatarAttachmentId = createdAvatar.id;
    }

    await this.usersRepository.save(user);

    if (avatarFile && previousAvatar) {
      await this.removeAttachment(previousAvatar);
    }

    return this.getProfile(user.id, user.id);
  }

  async followUser(
    followerId: string,
    followingId: string,
  ): Promise<UserProfile> {
    if (followerId === followingId) {
      throw new BadRequestException(this.translate('users.CANNOT_FOLLOW_SELF'));
    }

    const targetUser = await this.usersRepository.findOne({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException(this.translate('users.USER_NOT_FOUND'));
    }

    const existingFollow = await this.followsRepository.findOne({
      where: { followerId, followingId },
    });

    if (!existingFollow) {
      await this.followsRepository.save(
        this.followsRepository.create({ followerId, followingId }),
      );
    }

    return this.getProfile(followingId, followerId);
  }

  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<UserProfile> {
    if (followerId === followingId) {
      throw new BadRequestException(
        this.translate('users.CANNOT_UNFOLLOW_SELF'),
      );
    }

    const targetUser = await this.usersRepository.findOne({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException(this.translate('users.USER_NOT_FOUND'));
    }

    await this.followsRepository.delete({ followerId, followingId });

    return this.getProfile(followingId, followerId);
  }

  private async toProfile(user: User, viewerId?: string): Promise<UserProfile> {
    const [followersCount, followingCount, isFollowing] = await Promise.all([
      this.followsRepository.count({ where: { followingId: user.id } }),
      this.followsRepository.count({ where: { followerId: user.id } }),
      viewerId
        ? this.followsRepository.exists({
            where: { followerId: viewerId, followingId: user.id },
          })
        : Promise.resolve(false),
    ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarAttachment?.url ?? null,
      followersCount,
      followingCount,
      isFollowing,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertAvatarFile(file: Express.Multer.File): void {
    if (!ALLOWED_AVATAR_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        this.translate('users.AVATAR_INVALID_TYPE'),
      );
    }
  }

  private async removeAttachment(attachment: Attachment): Promise<void> {
    const filePath = join(process.cwd(), 'public', attachment.url);

    await this.attachmentsRepository.delete({ id: attachment.id });

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  private translate(key: string): string {
    return I18nContext.current()?.t(key) ?? key;
  }
}
