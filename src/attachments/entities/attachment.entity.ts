import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('attachments')
@Index(['attachableType', 'attachableId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attachable_type', type: 'varchar', length: 100 })
  attachableType!: string;

  @Column({ name: 'attachable_id', type: 'uuid' })
  attachableId!: string;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100 })
  fileType!: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize!: number;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
