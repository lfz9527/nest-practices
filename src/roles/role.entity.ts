import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'

// 角色对外暴露的简要信息（登录/用户查询返回）
export interface RoleInfo {
  id: number
  name: string
  roleKey: string
}

@Entity('roles')
@Unique(['roleKey', 'delFlag'])
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number

  @Column({ type: 'varchar', length: 30, default: '' })
  name!: string

  @Column({ type: 'varchar', length: 50, default: '' })
  roleKey!: string

  @Column({ type: 'tinyint', default: 0, comment: '角色状态: 0=正常 1=停用' })
  status!: number

  @Column({ type: 'int', default: 0, comment: '显示顺序' })
  sort!: number

  @Column({ type: 'varchar', length: 255, default: '' })
  remark!: string

  @Index()
  @Column({ type: 'tinyint', default: 0, comment: '删除标志: 0=存在 2=删除' })
  delFlag!: number

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date
}
