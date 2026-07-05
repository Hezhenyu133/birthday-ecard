import request from './request'

export interface OperationLog {
  id: number
  admin_id: number | null
  admin_name: string
  admin_username: string
  action: string
  model: string
  model_id: number | null
  details: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface OperationLogQuery {
  page?: number
  pageSize?: number
  action?: string
  model?: string
  admin_id?: number
  startDate?: string
  endDate?: string
}

export interface OperationLogStats {
  action_stats: { action: string; count: number }[]
  model_stats: { model: string; count: number }[]
  today_count: number
  total_count: number
}

// 获取操作日志列表
export const getOperationLogs = (params?: OperationLogQuery): Promise<{
  list: OperationLog[]
  total: number
  page: number
  pageSize: number
}> => {
  return request.get('/operation-logs', { params })
}

// 获取操作日志统计
export const getOperationLogStats = (): Promise<OperationLogStats> => {
  return request.get('/operation-logs/stats')
}

// 清理过期日志
export const cleanupOperationLogs = (): Promise<{ deleted_count: number }> => {
  return request.delete('/operation-logs/cleanup')
}
