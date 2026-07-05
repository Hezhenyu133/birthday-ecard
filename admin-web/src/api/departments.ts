import request from './request'

// 部门接口
export interface Department {
  id?: number
  name: string
  code: string
  level?: number
  parent_id?: number | null
  sort_order?: number
  description?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  children?: Department[]
}

// 部门树节点（用于 el-tree-select）
export interface DepartmentTreeNode {
  value: number
  label: string
  code: string
  children?: DepartmentTreeNode[]
}

// 获取部门树形结构
export const getDepartmentTree = (isActive?: boolean): Promise<Department[]> => {
  const params: any = {}
  if (isActive !== undefined) {
    params.is_active = isActive ? '1' : '0'
  }
  return request.get('/departments/tree', { params })
}

// 获取部门平铺列表
export const getDepartmentList = (): Promise<Department[]> => {
  return request.get('/departments')
}

// 获取部门详情
export const getDepartmentDetail = (id: number): Promise<Department> => {
  return request.get(`/departments/${id}`)
}

// 新增部门
export const createDepartment = (data: Partial<Department>): Promise<Department> => {
  return request.post('/departments', data)
}

// 修改部门
export const updateDepartment = (id: number, data: Partial<Department>): Promise<void> => {
  return request.put(`/departments/${id}`, data)
}

// 删除部门
export const deleteDepartment = (id: number): Promise<void> => {
  return request.delete(`/departments/${id}`)
}

// 将部门树数据转换为 el-tree-select 需要的格式
export const formatDepartmentTreeForSelect = (departments: Department[]): DepartmentTreeNode[] => {
  return departments.map(dept => ({
    value: dept.id!,
    label: dept.name,
    code: dept.code,
    children: dept.children ? formatDepartmentTreeForSelect(dept.children) : undefined
  }))
}
