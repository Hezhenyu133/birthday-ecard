<template>
  <div class="employee-list-container">
    <el-card>
      <!-- 搜索和筛选区域 -->
      <template #header>
        <div class="card-header">
          <span class="title">员工管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="$router.push('/employees/add')">
              <el-icon><Plus /></el-icon>
              添加员工
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

      <!-- 搜索表单 -->
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="姓名/手机号"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        
        <el-form-item label="部门">
          <el-input
            v-model="searchForm.department"
            placeholder="部门名称"
            clearable
            @clear="handleSearch"
          />
        </el-form-item>
        
        <!-- 状态筛选已移除 -->
        <el-form-item label="生日筛选">
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

      <!-- 数据表格 -->
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="gender" label="性别" width="80">
          <template #default="{ row }">
            {{ row.gender === 'male' ? '男' : '女' }}
          </template>
        </el-table-column>
        <el-table-column prop="birthday" label="生日" width="120" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="department" label="部门" min-width="150" />
        <el-table-column prop="position" label="职位" min-width="150" />
        <!-- 状态列已移除 -->
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="handleSend(row)">
              发送
            </el-button>
            <el-button type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Upload, Search, Refresh, MagicStick } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getEmployeeList, getTodayBirthdayEmployees, deleteEmployee, generateEmployeeCard, backfillTemplates } from '@/api/employees'
import type { Employee, EmployeeQueryParams } from '@/api/employees'

const router = useRouter()

// 搜索表单
const searchForm = reactive({
  keyword: '',
  department: '',
  birthday_filter: 'all' as 'all' | 'today'
})

// 表格数据
const tableData = ref<Employee[]>([])
const loading = ref(false)
const backfilling = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 加载数据
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
      department: searchForm.department,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    const res = await getEmployeeList(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch (error) {
    ElMessage.error('加载数据失败，请稍后重试')
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 重置
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.department = ''
  searchForm.birthday_filter = 'all'
  handleSearch()
}

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

// 页码改变
const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

// 编辑员工
const handleEdit = (row: Employee) => {
  router.push(`/employees/${row.id}/edit`)
}

// 删除员工
const handleDelete = async (row: Employee) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除员工「${row.name}」吗？\n\n⚠️ 该操作不可恢复，同时会删除该员工的所有发送记录。`,
      '提示',
      {
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    await deleteEmployee(row.id!)
    ElMessage.success('删除成功')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
      ElMessage.error('删除失败，请稍后重试')
    }
  }
}

// 发送贺卡
const handleSend = async (row: Employee) => {
  try {
    await generateEmployeeCard(row.id!)
    ElMessage.success('发送请求已触发，请在发送记录中查看状态')
    loadData()
  } catch (error) {
    console.error('发送失败：', error)
    ElMessage.error('发送失败，请稍后重试')
  }
}

// 补配模板（回填未匹配模板的员工）
const handleBackfillTemplates = async () => {
  try {
    await ElMessageBox.confirm(
      '将为所有未匹配模板的员工随机分配一个通用模板，确定继续？',
      '补配模板',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
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
    if (err !== 'cancel') {
      console.error('补配失败：', err)
      ElMessage.error('补配失败，请稍后重试')
    }
  } finally {
    backfilling.value = false
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.employee-list-container {
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

.search-form {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }

  .search-form .el-form-item {
    margin-bottom: 12px;
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

  /* 表格横向滚动 */
  .el-table {
    font-size: 12px;
  }
}
</style>