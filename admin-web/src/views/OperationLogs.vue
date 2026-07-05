<template>
  <div class="operation-logs-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">操作日志</span>
          <div class="header-actions">
            <el-button type="danger" plain @click="handleCleanup">
              <el-icon><Delete /></el-icon>
              清理过期日志
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-select v-model="filters.action" placeholder="操作类型" clearable style="width: 140px" @change="loadLogs">
          <el-option label="新增" value="create" />
          <el-option label="修改" value="update" />
          <el-option label="删除" value="delete" />
        </el-select>
        <el-select v-model="filters.model" placeholder="操作模型" clearable style="width: 140px" @change="loadLogs">
          <el-option label="员工" value="Employee" />
          <el-option label="模板" value="Template" />
          <el-option label="祝福语" value="Blessing" />
          <el-option label="部门" value="Department" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
          @change="handleDateChange"
        />
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 统计摘要 -->
      <div class="stats-summary" v-if="stats">
        <el-tag type="info">总记录：{{ stats.total_count }}</el-tag>
        <el-tag type="success">今日操作：{{ stats.today_count }}</el-tag>
      </div>

      <!-- 日志表格 -->
      <el-table
        v-loading="loading"
        :data="logs"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="created_at" label="时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="admin_name" label="操作者" width="100" />
        <el-table-column prop="action" label="操作类型" width="90">
          <template #default="{ row }">
            <el-tag :type="getActionTagType(row.action)" size="small">
              {{ getActionText(row.action) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="操作模型" width="100">
          <template #default="{ row }">
            {{ getModelText(row.model) }}
          </template>
        </el-table-column>
        <el-table-column prop="model_id" label="记录ID" width="80" />
        <el-table-column prop="details" label="详情" min-width="200">
          <template #default="{ row }">
            <span v-if="row.details" class="details-text">{{ formatDetails(row.details) }}</span>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="ip_address" label="IP" width="130" />
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>

      <div v-if="!loading && logs.length === 0" class="empty-tip">
        <el-empty description="暂无操作日志" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOperationLogs, getOperationLogStats, cleanupOperationLogs } from '@/api/operationLogs'
import type { OperationLog, OperationLogStats } from '@/api/operationLogs'

const loading = ref(false)
const logs = ref<OperationLog[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const stats = ref<OperationLogStats | null>(null)
const dateRange = ref<[string, string] | null>(null)

const filters = reactive({
  action: '',
  model: '',
  startDate: '',
  endDate: ''
})

const getActionText = (action: string) => {
  const map: Record<string, string> = { create: '新增', update: '修改', delete: '删除' }
  return map[action] || action
}

const getActionTagType = (action: string) => {
  const map: Record<string, string> = { create: 'success', update: 'warning', delete: 'danger' }
  return map[action] || 'info'
}

const getModelText = (model: string) => {
  const map: Record<string, string> = {
    Employee: '员工', Template: '模板', Blessing: '祝福语', Department: '部门'
  }
  return map[model] || model
}

const formatTime = (time: string) => {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const formatDetails = (details: string) => {
  try {
    const obj = JSON.parse(details)
    const parts: string[] = []
    if (obj.name) parts.push(`名称: ${obj.name}`)
    if (obj.content) parts.push(`内容: ${obj.content}`)
    // 对于 update 操作，显示被修改的字段
    const keys = Object.keys(obj).filter(k => !['name', 'content'].includes(k))
    if (keys.length > 0) parts.push(`字段: ${keys.join(', ')}`)
    return parts.join(' | ') || details
  } catch {
    return details
  }
}

const handleDateChange = (val: [string, string] | null) => {
  filters.startDate = val?.[0] || ''
  filters.endDate = val?.[1] || ''
  loadLogs()
}

const handleReset = () => {
  filters.action = ''
  filters.model = ''
  filters.startDate = ''
  filters.endDate = ''
  dateRange.value = null
  currentPage.value = 1
  loadLogs()
}

const loadLogs = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (filters.action) params.action = filters.action
    if (filters.model) params.model = filters.model
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate

    const result = await getOperationLogs(params)
    logs.value = result.list
    total.value = result.total
  } catch (error) {
    console.error('加载操作日志失败：', error)
    logs.value = []
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    stats.value = await getOperationLogStats()
  } catch (error) {
    console.error('加载统计失败：', error)
  }
}

const handleCleanup = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理过期日志吗？将删除超过保留期限的历史记录。',
      '确认清理',
      { confirmButtonText: '确认清理', cancelButtonText: '取消', type: 'warning' }
    )
    const result = await cleanupOperationLogs()
    ElMessage.success(`已清理 ${result.deleted_count} 条日志`)
    loadLogs()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}

onMounted(() => {
  loadLogs()
  loadStats()
})
</script>

<style scoped>
.operation-logs-container {
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
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.stats-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.empty-tip {
  padding: 40px 0;
  text-align: center;
}

.details-text {
  color: #606266;
  font-size: 13px;
}
</style>
