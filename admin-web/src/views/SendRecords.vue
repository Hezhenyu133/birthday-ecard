<template>
  <div class="send-records-container">
    <el-card>
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="title">发送记录</span>
        </div>
      </template>

      <!-- 统计卡片 -->
      <div class="stats-section">
        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-total">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总发送数</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-success">
              <div class="stat-value">{{ stats.success }}</div>
              <div class="stat-label">成功</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-failed">
              <div class="stat-value">{{ stats.failed }}</div>
              <div class="stat-label">失败</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-rate">
              <div class="stat-value">{{ stats.success_rate }}%</div>
              <div class="stat-label">成功率</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 筛选表单 -->
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="发送状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable>
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
            <el-option label="待发送" value="pending" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
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
        <el-table-column prop="employee.name" label="员工姓名" width="100" />
        <el-table-column prop="employee.phone" label="手机号" width="130" />
        <el-table-column prop="employee.department" label="部门" width="120" />
        <el-table-column label="短信内容" min-width="280">
          <template #default="{ row }">
            <div class="sms-content">
              <div class="sms-line">{{ row.sms_content || '暂无短信内容' }}</div>
              <div class="sms-line sms-link-line" v-if="row.card_url">
                点击查看贺卡：
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click="handlePreviewCard(row)"
                >
                  <el-icon><Link /></el-icon>
                  打开贺卡
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="template.name" label="使用模板" width="130" />
        <el-table-column prop="send_status" label="发送状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.send_status)">
              {{ getStatusText(row.send_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发送时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.send_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="失败原因" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.error_message" placement="top" v-if="row.error_message">
              <span class="error-text">{{ row.error_message }}</span>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              type="info"
              size="small"
              @click="handlePreviewCard(row)"
              :disabled="!row.card_url"
            >
              <el-icon><View /></el-icon>
              预览
            </el-button>
            <el-button 
              type="primary" 
              size="small" 
              @click="handleTestSend(row.employee_id)"
              :disabled="row.send_status === 'success'"
            >
              重发
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              @click="handleDelete(row)"
            >
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
    <!-- 手机预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="贺卡手机预览"
      width="440px"
      :close-on-click-modal="true"
      class="phone-preview-dialog"
      destroy-on-close
    >
      <div class="phone-frame">
        <div class="phone-notch"></div>
        <div class="phone-status-bar">
          <span class="phone-time">{{ currentTime }}</span>
          <span class="phone-icons">●●●</span>
        </div>
        <iframe
          v-if="previewCardUrl"
          :src="previewCardUrl"
          class="phone-screen"
          sandbox="allow-scripts allow-same-origin"
          frameborder="0"
        ></iframe>
        <div class="phone-home-bar"></div>
      </div>
      <template #footer>
        <div class="preview-footer">
          <el-text type="info" size="small" truncated class="preview-url">{{ previewCardUrl }}</el-text>
          <el-button type="primary" @click="openInNewTab">在新标签页打开</el-button>
          <el-button @click="previewVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Search, Refresh, View, Link } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecordList, getRecordStats, testSend, deleteRecord } from '@/api/records'
import type { SendRecord, RecordQueryParams } from '@/api/records'

// 统计数据
const stats = reactive({
  total: 0,
  success: 0,
  failed: 0,
  pending: 0,
  success_rate: 0
})

// 搜索表单
const searchForm = reactive<RecordQueryParams>({
  status: undefined,
  startDate: undefined,
  endDate: undefined
})

// 日期范围
const dateRange = ref<string[]>([])

// 表格数据
const tableData = ref<SendRecord[]>([])
const loading = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 格式化日期时间：将 ISO 字符串转为 YYYY-MM-DD HH:mm:ss
const formatDateTime = (value: string | Date | null) => {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 获取状态类型
const getStatusType = (status: string) => {
  const typeMap: Record<string, any> = {
    success: 'success',
    failed: 'danger',
    pending: 'warning'
  }
  return typeMap[status] || 'info'
}

// 获取状态文字
const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    success: '成功',
    failed: '失败',
    pending: '待发送'
  }
  return textMap[status] || status
}

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await getRecordStats()
    Object.assign(stats, data)
  } catch (error) {
    console.error('加载统计数据失败：', error)
  }
}

// 加载记录列表
const loadRecords = async () => {
  loading.value = true
  try {
    const params: RecordQueryParams = {
      ...searchForm,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    const res = await getRecordList(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch (error) {
    console.error('加载记录列表失败：', error)
    // 接口异常时使用默认兜底数据
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 日期改变
const handleDateChange = (dates: string[] | null) => {
  if (dates && dates.length === 2) {
    searchForm.startDate = dates[0]
    searchForm.endDate = dates[1]
  } else {
    searchForm.startDate = undefined
    searchForm.endDate = undefined
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadRecords()
}

// 重置
const handleReset = () => {
  searchForm.status = undefined
  searchForm.startDate = undefined
  searchForm.endDate = undefined
  dateRange.value = []
  handleSearch()
}

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadRecords()
}

// 页码改变
const handlePageChange = (page: number) => {
  pagination.page = page
  loadRecords()
}

// 测试发送
const handleTestSend = async (employeeId: number) => {
  try {
    await testSend(employeeId)
    ElMessage.success('发送成功')
    // 刷新列表和统计
    await Promise.all([loadRecords(), loadStats()])
  } catch (error) {
    ElMessage.error('发送失败')
  }
}

// 删除记录
const handleDelete = async (row: SendRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除员工「${row.employee?.name || '未知'}」的这条发送记录吗？`,
      '提示',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    if (!row.id) return
    await deleteRecord(row.id)
    ElMessage.success('删除成功')
    await Promise.all([loadRecords(), loadStats()])
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
      ElMessage.error('删除失败')
    }
  }
}

// --- 手机预览功能 ---
const previewVisible = ref(false)
const previewCardUrl = ref('')
const currentTime = ref('')

// 获取当前时间（模拟手机状态栏）
const updateTime = () => {
  const now = new Date()
  currentTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// 打开手机预览
const handlePreviewCard = (row: SendRecord) => {
  if (!row.card_url) {
    ElMessage.warning('该记录无贺卡链接')
    return
  }
  previewCardUrl.value = row.card_url
  updateTime()
  previewVisible.value = true
}

// 在新标签页打开
const openInNewTab = () => {
  if (previewCardUrl.value) {
    window.open(previewCardUrl.value, '_blank')
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadStats()
  loadRecords()
})
</script>

<style scoped>
.send-records-container {
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

.stats-section {
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: white;
  margin-bottom: 16px;
}

.stat-total {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-success {
  background: linear-gradient(135deg, #67C23A 0%, #85ce61 100%);
}

.stat-failed {
  background: linear-gradient(135deg, #F56C6C 0%, #f78989 100%);
}

.stat-rate {
  background: linear-gradient(135deg, #E6A23C 0%, #ebb563 100%);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.search-form {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.error-text {
  color: #f56c6c;
  cursor: pointer;
}

/* 短信内容样式 */
.sms-content {
  font-size: 13px;
  line-height: 1.6;
}

.sms-line {
  margin-bottom: 2px;
}

.sms-link-line {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #606266;
}

/* 手机预览对话框 */
:deep(.phone-preview-dialog .el-dialog__body) {
  padding: 16px 20px;
  display: flex;
  justify-content: center;
  background: #f0f2f5;
}

.phone-frame {
  width: 375px;
  height: 680px;
  background: #000;
  border-radius: 40px;
  padding: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3), inset 0 0 0 2px #333;
  position: relative;
  display: flex;
  flex-direction: column;
}

.phone-notch {
  width: 120px;
  height: 28px;
  background: #000;
  border-radius: 0 0 16px 16px;
  margin: 0 auto;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.phone-status-bar {
  height: 36px;
  background: #000;
  border-radius: 28px 28px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.phone-icons {
  font-size: 8px;
  letter-spacing: 2px;
}

.phone-screen {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}

.phone-home-bar {
  height: 28px;
  background: #000;
  border-radius: 0 0 28px 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.phone-home-bar::after {
  content: '';
  width: 100px;
  height: 4px;
  background: #666;
  border-radius: 2px;
}

.preview-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-url {
  flex: 1;
  min-width: 0;
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

  .stat-value {
    font-size: 24px;
  }

  .stat-label {
    font-size: 12px;
  }
}
</style>