import request from './request'
import type { PageResponse } from './types'

// 发送记录接口
export interface SendRecord {
  id?: number
  employee_id: number
  template_id: number
  card_url: string
  card_id?: string
  send_status: 'pending' | 'success' | 'failed'
  send_time?: string
  error_message?: string | null
  created_at?: string
  employee?: {
    name: string
    phone: string
    department?: string
  }
  template?: {
    name: string
  }
}

// 分页查询参数
export interface RecordQueryParams {
  page?: number
  pageSize?: number
  employeeId?: number
  status?: 'pending' | 'success' | 'failed'
  startDate?: string
  endDate?: string
}

// 获取发送记录列表（分页）
export const getRecordList = (params: RecordQueryParams): Promise<PageResponse<SendRecord>> => {
  return request.get('/records', { params })
}

// 获取统计数据
export interface RecordStats {
  total: number
  success: number
  failed: number
  pending: number
  success_rate: number
}

export const getRecordStats = (): Promise<RecordStats> => {
  return request.get('/records/stats')
}

// 测试发送
export const testSend = (employeeId: number) => {
  return request.post(`/records/test-send/${employeeId}`)
}

// 删除发送记录
export const deleteRecord = (id: number) => {
  return request.delete(`/records/${id}`)
}

// 月度统计
export interface MonthlyStatItem {
  month: string
  total: number
  success: number
  failed: number
}

export const getMonthlyStats = (): Promise<{ monthly: MonthlyStatItem[] }> => {
  return request.get('/records/monthly-stats')
}
