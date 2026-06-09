import request from './request'
import type { Blessing } from './blessings'

// 模板信息接口
export interface Template {
  id?: number
  name: string
  description?: string
  match_gender?: 'male' | 'female' | 'all'
  match_age_min?: number | null
  match_age_max?: number | null
  match_interests?: string | null
  html_content: string
  default_blessing_id?: number | null
  default_blessing?: Blessing | null
  preview_image?: string | null
  is_active?: number
  created_at?: string
  updated_at?: string
}

// 获取模板列表
export const getTemplateList = (params?: { is_active?: number }): Promise<Template[]> => {
  return request.get('/templates', { params })
}

// 获取模板详情
export const getTemplateDetail = (id: number): Promise<Template> => {
  return request.get(`/templates/${id}`)
}

// 新增模板
export const createTemplate = (data: Template): Promise<Template> => {
  return request.post('/templates', data)
}

// 修改模板
export const updateTemplate = (id: number, data: Template): Promise<Template> => {
  return request.put(`/templates/${id}`, data)
}

// 删除模板
export const deleteTemplate = (id: number) => {
  return request.delete(`/templates/${id}`)
}

// 预览模板（返回 HTML 字符串，响应拦截器已处理非 JSON 响应）
export const previewTemplate = (id: number): Promise<string> => {
  return request.get(`/templates/${id}/preview`)
}

// 回填：为未匹配祝福语的模板自动分配通用祝福语
export const backfillBlessings = (): Promise<{ updated: number }> => {
  return request.post('/templates/backfill-blessings')
}