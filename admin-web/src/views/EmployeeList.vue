<template>
  <div class="personnel-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">人员管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="$router.push('/employees/add')">
              <el-icon><Plus /></el-icon>
              添加人员
            </el-button>
            <el-button type="success" @click="$router.push('/employees/import')">
              <el-icon><Upload /></el-icon>
              批量导入
            </el-button>
            <el-button type="warning" @click="handleBackfillTemplates" :loading="backfilling">
              <el-icon><MagicStick /></el-icon>
              补配模板
            </el-button>
          </div>
        </div>
      </template>

      <div class="main-content">
        <!-- 左侧：部门树 -->
        <div class="tree-panel">
          <div class="tree-toolbar">
            <el-button size="small" type="primary" plain @click="handleAddDept">
              <el-icon><Plus /></el-icon>
              新增
            </el-button>
            <el-button size="small" plain @click="handleEditDept" :disabled="!selectedDeptId">
              编辑
            </el-button>
            <el-button size="small" type="danger" plain @click="handleDeleteDept" :disabled="!selectedDeptId">
              删除
            </el-button>
          </div>
          <el-input
            v-model="treeFilterText"
            placeholder="搜索部门"
            clearable
            size="small"
            style="margin-bottom: 8px"
          />
          <el-tree
            ref="treeRef"
            :data="deptTree"
            :props="treeProps"
            node-key="id"
            highlight-current
            default-expand-all
            :filter-node-method="filterNode"
            @node-click="handleNodeClick"
          >
            <template #default="{ data }">
              <span class="tree-node">
                <span>{{ data.name }}</span>
                <span class="tree-count" v-if="data._empCount !== undefined">({{ data._empCount }})</span>
              </span>
            </template>
          </el-tree>
        </div>

        <!-- 右侧：员工表格 -->
        <div class="table-panel">
          <!-- 搜索筛选 -->
          <el-form :model="searchForm" inline class="search-form">
            <el-form-item label="关键词">
              <el-input
                v-model="searchForm.keyword"
                placeholder="姓名/手机号"
                clearable
                @clear="handleSearch"
              />
            </el-form-item>
            <el-form-item label="职级">
              <el-select v-model="searchForm.level" placeholder="全部" clearable @change="handleSearch" style="width: 120px">
                <el-option label="管理层" value="management" />
                <el-option label="经理" value="manager" />
                <el-option label="员工" value="employee" />
              </el-select>
            </el-form-item>
            <el-form-item label="生日">
              <el-select v-model="searchForm.birthday_filter" placeholder="全部" @change="handleSearch">
                <el-option label="全部" value="all" />
                <el-option label="今日生日" value="today" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">
                <el-icon><Search /></el-icon>
                搜索
              </el-button>
              <el-button @click="handleReset">
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
            </el-form-item>
          </el-form>

          <!-- 当前部门提示 -->
          <div class="dept-breadcrumb" v-if="selectedDeptId">
            <span>当前部门：</span>
            <span class="dept-name">{{ selectedDeptName }}</span>
            <span class="dept-hint">（含子部门）</span>
          </div>

          <!-- 数据表格 -->
          <el-table
            :data="tableData"
            v-loading="loading"
            stripe
            border
            style="width: 100%"
          >
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="gender" label="性别" width="70">
              <template #default="{ row }">
                {{ row.gender === 'male' ? '男' : '女' }}
              </template>
            </el-table-column>
            <el-table-column prop="birthday" label="生日" width="110" />
            <el-table-column prop="phone" label="手机号" width="130" />
            <el-table-column label="部门" min-width="140">
              <template #default="{ row }">
                {{ getDeptName(row.department_id) || row.department || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="职级" width="80">
              <template #default="{ row }">
                {{ levelLabel(row.level) }}
              </template>
            </el-table-column>
            <el-table-column prop="position" label="职位" min-width="120" />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="handleSend(row)">发送</el-button>
                <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
                <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :total="pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </el-card>

    <!-- 部门新增/编辑对话框 -->
    <el-dialog
      v-model="deptDialogVisible"
      :title="deptDialogMode === 'add-root' || deptDialogMode === 'add-child' ? '新增部门' : '编辑部门'"
      width="460px"
      @close="resetDeptForm"
    >
      <el-form ref="deptFormRef" :model="deptForm" :rules="deptRules" label-width="90px">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="deptForm.name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="部门编码" prop="code">
          <el-input v-model="deptForm.code" placeholder="唯一编码，如 IT001" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-input :model-value="deptParentName" disabled />
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="deptForm.sort_order" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="deptForm.is_active" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="deptForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDeptForm" :loading="deptSubmitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Upload, Search, Refresh, MagicStick } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { getEmployeeList, getTodayBirthdayEmployees, deleteEmployee, generateEmployeeCard, backfillTemplates } from '@/api/employees'
import type { Employee, EmployeeQueryParams } from '@/api/employees'
import {
  getDepartmentTree,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type Department
} from '@/api/departments'

const router = useRouter()

// ==================== 部门树 ====================
const treeRef = ref()
const deptTree = ref<Department[]>([])
const treeFilterText = ref('')
const treeProps = { children: 'children', label: 'name' }

const selectedDeptId = ref<number | null>(null)
const selectedDeptName = ref('')

// id→name 映射
const deptMap = new Map<number, string>()
const buildDeptMap = (depts: Department[]) => {
  for (const dept of depts) {
    if (dept.id) deptMap.set(dept.id, dept.name)
    if (dept.children) buildDeptMap(dept.children)
  }
}
const getDeptName = (id: number | null | undefined): string => {
  if (!id) return ''
  return deptMap.get(id) || ''
}

const levelLabel = (level?: string): string => {
  const map: Record<string, string> = { management: '管理层', manager: '经理', employee: '员工' }
  return level ? (map[level] || '-') : '-'
}

const loadDeptTree = async () => {
  try {
    deptTree.value = await getDepartmentTree()
    deptMap.clear()
    buildDeptMap(deptTree.value)
  } catch {
    // 部门树加载失败不影响主功能
  }
}

// 搜索过滤
watch(treeFilterText, (val) => {
  treeRef.value?.filter(val)
})
const filterNode = (value: string, data: Department) => {
  if (!value) return true
  return data.name.includes(value) || data.code.includes(value)
}

// 点击树节点
const handleNodeClick = (data: Department) => {
  selectedDeptId.value = data.id ?? null
  selectedDeptName.value = data.name
  handleSearch()
}

// 默认选中第一个顶级部门
const selectFirstDept = () => {
  if (deptTree.value.length > 0) {
    const first = deptTree.value[0]
    nextTick(() => {
      treeRef.value?.setCurrentKey(first.id)
      handleNodeClick(first)
    })
  }
}

// ==================== 部门操作（对话框） ====================
const deptDialogVisible = ref(false)
const deptDialogMode = ref<'add-root' | 'add-child' | 'edit'>('add-root')
const deptSubmitting = ref(false)
const deptFormRef = ref<FormInstance>()

const deptForm = reactive<Partial<Department>>({
  name: '',
  code: '',
  parent_id: null,
  sort_order: 0,
  description: '',
  is_active: true
})

const deptRules = reactive<FormRules>({
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入部门编码', trigger: 'blur' }]
})

const deptParentName = computed(() => {
  if (deptForm.parent_id === null || deptForm.parent_id === undefined) return '无（顶级部门）'
  return deptMap.get(deptForm.parent_id) || '未知'
})

const handleAddDept = () => {
  deptDialogMode.value = selectedDeptId.value ? 'add-child' : 'add-root'
  deptForm.parent_id = selectedDeptId.value
  deptForm.name = ''
  deptForm.code = ''
  deptForm.sort_order = 0
  deptForm.description = ''
  deptForm.is_active = true
  deptDialogVisible.value = true
}

const handleEditDept = () => {
  if (!selectedDeptId.value) return
  // 从树中找到对应节点
  const findDept = (nodes: Department[], id: number): Department | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) { const f = findDept(n.children, id); if (f) return f }
    }
    return null
  }
  const dept = findDept(deptTree.value, selectedDeptId.value)
  if (!dept) return

  deptDialogMode.value = 'edit'
  Object.assign(deptForm, {
    id: dept.id,
    name: dept.name,
    code: dept.code,
    parent_id: dept.parent_id ?? null,
    sort_order: dept.sort_order ?? 0,
    description: dept.description ?? '',
    is_active: dept.is_active ?? true
  })
  deptDialogVisible.value = true
}

const handleDeleteDept = async () => {
  if (!selectedDeptId.value) return
  try {
    await ElMessageBox.confirm(
      `确定要删除部门「${selectedDeptName.value}」吗？\n如果有子部门或关联员工将无法删除。`,
      '提示',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteDepartment(selectedDeptId.value)
    ElMessage.success('删除成功')
    selectedDeptId.value = null
    selectedDeptName.value = ''
    await loadDeptTree()
    selectFirstDept()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err?.message || '删除失败')
  }
}

const submitDeptForm = async () => {
  if (!deptFormRef.value) return
  await deptFormRef.value.validate(async (valid) => {
    if (!valid) return
    deptSubmitting.value = true
    try {
      if (deptDialogMode.value === 'edit') {
        await updateDepartment(deptForm.id!, deptForm)
        ElMessage.success('修改成功')
      } else {
        await createDepartment(deptForm)
        ElMessage.success('添加成功')
      }
      deptDialogVisible.value = false
      await loadDeptTree()
      // 编辑后重新选中
      if (deptDialogMode.value === 'edit' && deptForm.id) {
        nextTick(() => {
          treeRef.value?.setCurrentKey(deptForm.id)
          const findDept = (nodes: Department[], id: number): Department | null => {
            for (const n of nodes) {
              if (n.id === id) return n
              if (n.children) { const f = findDept(n.children, id); if (f) return f }
            }
            return null
          }
          const dept = findDept(deptTree.value, deptForm.id!)
          if (dept) {
            selectedDeptName.value = dept.name
          }
        })
      } else {
        selectFirstDept()
      }
    } catch (err: any) {
      ElMessage.error(err?.message || '操作失败')
    } finally {
      deptSubmitting.value = false
    }
  })
}

const resetDeptForm = () => {
  deptFormRef.value?.resetFields()
}

// ==================== 员工表格 ====================
const searchForm = reactive({
  keyword: '',
  level: '',
  birthday_filter: 'all' as 'all' | 'today'
})

const tableData = ref<Employee[]>([])
const loading = ref(false)
const backfilling = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    if (searchForm.birthday_filter === 'today') {
      const res = await getTodayBirthdayEmployees()
      tableData.value = res
      pagination.total = res.length
      return
    }

    const params: EmployeeQueryParams = {
      keyword: searchForm.keyword,
      departmentId: selectedDeptId.value ?? undefined,
      level: searchForm.level || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize
    }

    const res = await getEmployeeList(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch {
    ElMessage.error('加载数据失败，请稍后重试')
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.level = ''
  searchForm.birthday_filter = 'all'
  handleSearch()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

// ==================== 员工操作 ====================
const handleEdit = (row: Employee) => {
  router.push(`/employees/${row.id}/edit`)
}

const handleDelete = async (row: Employee) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除员工「${row.name}」吗？\n\n该操作不可恢复，同时会删除该员工的所有发送记录。`,
      '提示',
      { confirmButtonText: '永久删除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
    await deleteEmployee(row.id!)
    ElMessage.success('删除成功')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error('删除失败，请稍后重试')
  }
}

const handleSend = async (row: Employee) => {
  try {
    await ElMessageBox.confirm(
      `确定要为 ${row.name} 生成贺卡并发送短信吗？`,
      '发送确认',
      { confirmButtonText: '确定发送', cancelButtonText: '取消', type: 'info' }
    )
    await generateEmployeeCard(row.id!)
    ElMessage.success('发送请求已触发，请在发送记录中查看状态')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error('发送失败，请稍后重试')
  }
}

const handleBackfillTemplates = async () => {
  try {
    await ElMessageBox.confirm(
      '将为所有未匹配模板的员工随机分配一个通用模板，确定继续？',
      '补配模板',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    )
    backfilling.value = true
    const res = await backfillTemplates()
    if (res.updated === 0) {
      ElMessage.info('所有员工均已匹配模板，无需补配')
    } else {
      ElMessage.success(`已为 ${res.updated} 位员工补配模板`)
    }
    loadData()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error('补配失败，请稍后重试')
  } finally {
    backfilling.value = false
  }
}

// ==================== 初始化 ====================
onMounted(async () => {
  await loadDeptTree()
  selectFirstDept()
})
</script>

<style scoped>
.personnel-container {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.main-content {
  display: flex;
  gap: 16px;
  min-height: 520px;
}

/* 左侧部门树 */
.tree-panel {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #ebeef5;
  padding-right: 16px;
  display: flex;
  flex-direction: column;
}

.tree-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.tree-count {
  color: #909399;
  font-size: 12px;
}

/* 右侧表格 */
.table-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.search-form {
  margin-bottom: 12px;
  padding: 12px 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.dept-breadcrumb {
  margin-bottom: 10px;
  font-size: 14px;
  color: #606266;
}

.dept-name {
  font-weight: bold;
  color: #0085CC;
}

.dept-hint {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
}

.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .tree-panel {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #ebeef5;
    padding-right: 0;
    padding-bottom: 12px;
    max-height: 280px;
    overflow-y: auto;
  }

  .table-panel {
    padding-top: 12px;
  }

  .search-form {
    flex-direction: column;
  }

  .search-form .el-form-item {
    margin-bottom: 10px;
    width: 100%;
  }

  .search-form .el-input,
  .search-form .el-select {
    width: 100% !important;
  }

  .header-actions {
    flex-direction: column;
    width: 100%;
  }

  .header-actions .el-button {
    width: 100%;
  }

  .card-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
}
</style>
