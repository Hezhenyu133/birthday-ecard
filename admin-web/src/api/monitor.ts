import request from './request'

export interface SystemHealth {
  sender_service: string
  monitor_service: string
  database: string
  last_heartbeat: string
}

export interface SystemStats {
  send_stats: { total: number; success: number; failed: number; success_rate: number }
  template_usage: { template_name: string; count: number }[]
  today_count: number
  level_stats: { level: string; count: number }[]
}

export const getSystemHealth = () => request.get<SystemHealth>('/monitor/status')
export const getSystemStats = () => request.get<SystemStats>('/monitor/stats')
