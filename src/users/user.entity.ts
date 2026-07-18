import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm'

@Entity('users')
@Unique(['email', 'delFlag'])
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number

  @Column({ type: 'varchar', length: 30, default: '' })
  nickname: string

  @Column({ type: 'varchar', length: 100, default: '' })
  email: string

  @Column({
    type: 'tinyint',
    default: 2,
    comment: '用户性别: 0=男 1=女 2=未知',
  })
  gender: number

  @Column({ type: 'varchar', length: 255, default: '' })
  avatar: string

  @Column({ type: 'varchar', length: 255, default: '' })
  password: string

  @Column({ type: 'tinyint', default: 0, comment: '账号状态: 0=正常 1=停用' })
  status: number

  @Index()
  @Column({ type: 'tinyint', default: 0, comment: '删除标志: 0=存在 2=删除' })
  delFlag: number

  @Column({ type: 'varchar', length: 45, default: '' })
  lastLoginIp: string

  @Column({ type: 'datetime', nullable: true })
  lastLoginTime: Date | null

  @Column({ type: 'varchar', length: 255, default: '' })
  remark: string

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date
}
