import request from './request'
import type { PageResponse } from './types'

// 员工信息接口
export interface Employee {
  id?: number
  name: string
  gender: 'male' | 'female'
  birthday: string
  phone: string
  department?: string
  department_id?: number | null
  department_code?: string
  level?: 'management' | 'manager' | 'employee'
  position?: string
  default_template_id?: number | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

// 分页查询参数
export interface EmployeeQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  department?: string
  departmentId?: number
  level?: string
  is_active?: number
}

// 获取员工列表（分页）
export const getEmployeeList = (params: EmployeeQueryParams): Promise<PageResponse<Employee>> => {
  return request.get('/employees', { params })
}

// 获取员工详情
export const getEmployeeDetail = (id: number): Promise<Employee> => {
  return request.get(`/employees/${id}`)
}

// 新增员工
export const createEmployee = (data: Employee): Promise<Employee> => {
  return request.post('/employees', data)
}

// 修改员工信息
export const updateEmployee = (id: number, data: Employee): Promise<Employee> => {
  return request.put(`/employees/${id}`, data)
}

// 删除员工
export const deleteEmployee = (id: number) => {
  return request.delete(`/employees/${id}`)
}

// Excel批量导入（400验证错误已在拦截器中特殊处理，透传给调用方）
export const importEmployees = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/employees/import', formData)
}

// 获取今天生日的员工
export const getTodayBirthdayEmployees = (): Promise<Employee[]> => {
  return request.get('/employees/today-birthday')
}

// 生成员工贺卡
export const generateEmployeeCard = (id: number) => {
  return request.post(`/employees/${id}/generate-card`)
}

// 回填：为未匹配模板的员工自动分配通用模板
export const backfillTemplates = (): Promise<{ updated: number }> => {
  return request.post('/employees/backfill-templates')
}