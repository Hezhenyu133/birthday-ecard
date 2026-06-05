// 公共类型定义

// 分页响应（employees 和 records 共用）
export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
