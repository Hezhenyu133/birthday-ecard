import request from './request'

export interface Blessing {
  id?: number
  content: string
  match_gender?: 'male' | 'female' | 'all'
  match_age_min?: number | null
  match_age_max?: number | null
  is_active?: boolean
  template_count?: number
  created_at?: string
  updated_at?: string
}

export const getBlessingList = (params?: { is_active?: number }): Promise<Blessing[]> => {
  return request.get('/blessings', { params })
}

export const getBlessingDetail = (id: number): Promise<Blessing> => {
  return request.get(`/blessings/${id}`)
}

export const createBlessing = (data: Blessing): Promise<Blessing> => {
  return request.post('/blessings', data)
}

export const updateBlessing = (id: number, data: Blessing): Promise<Blessing> => {
  return request.put(`/blessings/${id}`, data)
}

export const deleteBlessing = (id: number) => {
  return request.delete(`/blessings/${id}`)
}
