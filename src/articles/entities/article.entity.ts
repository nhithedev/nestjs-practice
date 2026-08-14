import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Attachment } from '../../attachments/entities/attachment.entity';
import { User } from '../../users/entities/user.entity';
import { Tag } from './tag.entity';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 255 })
  slug!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: User;

  // Chưa có endpoint upload cover ở pull 4 — xem PULL4_PLAN.md mục 3.
  // Cột và relation được chuẩn bị sẵn, giá trị mặc định null.
  @Column({ name: 'cover_attachment_id', type: 'uuid', nullable: true })
  coverAttachmentId!: string | null;

  @ManyToOne(() => Attachment, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'cover_attachment_id' })
  coverAttachment!: Attachment | null;

  // KHÔNG đặt eager:true cho tags — ManyToMany eager dễ gây duplicate row khi
  // ArticlesService dùng QueryBuilder tự viết (cần cho filter tag/author/favorited
  // ở List/Feed). ArticlesService PHẢI tự leftJoinAndSelect('article.tags', 'tags')
  // (hoặc { relations: ['tags'] } khi dùng findOne đơn giản) ở MỌI query trả về
  // article — nếu quên, article.tags sẽ là undefined và fromEntity() sẽ âm thầm
  // trả tagList: [] dù bài viết thực sự có tag.
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
