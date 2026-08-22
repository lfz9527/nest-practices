import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class QueryRolesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为 1' })
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页条数必须是整数' })
  @Min(1, { message: '每页条数最小为 1' })
  @Max(100, { message: '每页条数最大为 100' })
  pageSize = 10

  @IsOptional()
  name?: string

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1], { message: '状态只能为 0 或 1' })
  status?: number
}
