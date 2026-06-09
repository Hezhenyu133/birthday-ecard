<template>
  <div class="dashboard-container">
    <!-- 顶部欢迎区域 -->
    <div class="welcome-section">
      <h2>欢迎使用生日贺卡管理系统</h2>
      <p class="welcome-text">今天是 {{ currentDate }}</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: #409EFF">
            <el-icon :size="32"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalEmployees }}</div>
            <div class="stat-label">员工总数</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: #E6A23C">
            <el-icon :size="32"><Star /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.todayBirthdays }}</div>
            <div class="stat-label">今日生日</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: #67C23A">
            <el-icon :size="32"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.successRate }}%</div>
            <div class="stat-label">发送成功率</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-content">
          <div class="stat-icon" style="background: #F56C6C">
            <el-icon :size="32"><Message /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.totalSent }}</div>
            <div class="stat-label">总发送数</div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 今日生日员工列表 -->
    <el-card class="birthday-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>今日生日员工</span>
          <el-button type="primary" size="small" @click="refreshBirthdays">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-empty v-if="todayBirthdays.length === 0" description="今天没有生日的员工" />
      
      <div v-else class="birthday-list">
        <div v-for="employee in todayBirthdays" :key="employee.id" class="birthday-item">
          <div class="employee-info">
            <div class="employee-name">{{ employee.name }}</div>
            <div class="employee-detail">{{ employee.department }} - {{ employee.phone }}</div>
          </div>
          <el-button 
            v-if="employee.id !== undefined"
            :type="sentEmployeeIds.has(employee.id) ? 'info' : 'success'" 
            :disabled="sentEmployeeIds.has(employee.id) || sendingId === employee.id"
            :loading="sendingId === employee.id"
            size="small" 
            @click="handleTestSend(employee.id)"
          >
            {{ sentEmployeeIds.has(employee.id) ? '已发送' : (sendingId === employee.id ? '发送中...' : '测试发送') }}
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 快捷操作 -->
    <el-card class="quick-actions" shadow="hover">
      <template #header>
        <span>快捷操作</span>
      </template>
      <div class="actions-grid">
        <el-button type="primary" @click="$router.push('/employees/add')">
          <el-icon><Plus /></el-icon>
          添加员工
        </el-button>
        <el-button type="success" @click="$router.push('/employees/import')">
          <el-icon><Upload /></el-icon>
          批量导入
        </el-button>
        <el-button type="warning" @click="$router.push('/templates')">
          <el-icon><Picture /></el-icon>
          管理模板
        </el-button>
        <el-button type="danger" @click="$router.push('/blessings')">
          <el-icon><ChatDotRound /></el-icon>
          祝福语管理
        </el-button>
        <el-button type="info" @click="$router.push('/records')">
          <el-icon><Document /></el-icon>
          查看记录
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { User, Star, CircleCheck, Message, Refresh, Plus, Upload, Picture, Document, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getTodayBirthdayEmployees, getEmployeeList } from '@/api/employees'
import { getRecordStats, getRecordList } from '@/api/records'
import { testSend } from '@/api/records'
import type { Employee } from '@/api/employees'

const router = useRouter()

// 模拟数据常量（开发模式使用）
const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: '张三', gender: 'male', birthday: '1990-05-15', phone: '13800138001', department: '技术部', position: '工程师', is_active: 1 },
  { id: 2, name: '李四', gender: 'female', birthday: '1992-05-15', phone: '13900139001', department: '市场部', position: '专员', is_active: 1 },
  { id: 3, name: '王五', gender: 'male', birthday: '1988-05-15', phone: '13700137001', department: '人事部', position: '经理', is_active: 1 }
]

// 当前日期
const currentDate = computed(() => {
  const date = new Date()
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
})

// 统计数据
const stats = ref({
  totalEmployees: 0,
  todayBirthdays: 0,
  successRate: 0,
  totalSent: 0
})

// 今日生日员工
const todayBirthdays = ref<Employee[]>([])

// 已发送的员工ID集合（含今天已成功发送的 + 本次会话中发送的）
const sentEmployeeIds = ref<Set<number>>(new Set())
// 当前正在发送的员工ID
const sendingId = ref<number | null>(null)

// 开发模式：通过环境变量控制是否使用模拟数据
const isDevMode = import.meta.env.VITE_USE_MOCK === 'true'

// 加载数据
const loadData = async () => {
  try {
    if (isDevMode) {
      // 模拟数据
      stats.value = {
        totalEmployees: 128,
        todayBirthdays: 3,
        successRate: 95,
        totalSent: 1256
      }
      
      todayBirthdays.value = MOCK_EMPLOYEES
      return
    }
    
    // 获取统计数据
    const recordStats = await getRecordStats()
    stats.value.successRate = recordStats.success_rate || 0
    stats.value.totalSent = recordStats.total || 0
    
    // 获取员工总数（通过分页接口获取 total）
    const empList = await getEmployeeList({ page: 1, pageSize: 1 })
    stats.value.totalEmployees = empList.total || 0
    
    // 获取今日已成功发送的记录，预先禁用按钮
    try {
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      // endDate 用明天的日期，避免 UTC 解析截断当天记录
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
      const todayRecords = await getRecordList({ page: 1, pageSize: 1000, status: 'success', startDate: todayStr, endDate: tomorrowStr })
      todayRecords.list.forEach((r: any) => {
        if (r.employee_id) sentEmployeeIds.value.add(r.employee_id)
      })
      console.log('[仪表盘] 今日已发送记录:', todayRecords.list.length, '条, 已发送员工:', [...sentEmployeeIds.value])
    } catch (e) {
      console.error('[仪表盘] 查询今日发送记录失败:', e)
    }

    // 获取今日生日员工
    await refreshBirthdays()
  } catch (error) {
    console.error('加载数据失败：', error)
    // 接口异常时使用默认兜底数据
    stats.value = {
      totalEmployees: 0,
      todayBirthdays: 0,
      successRate: 0,
      totalSent: 0
    }
  }
}

// 刷新生日列表
const refreshBirthdays = async () => {
  try {
    if (isDevMode) {
      todayBirthdays.value = MOCK_EMPLOYEES
      stats.value.todayBirthdays = todayBirthdays.value.length
      return
    }
    
    todayBirthdays.value = await getTodayBirthdayEmployees()
    stats.value.todayBirthdays = todayBirthdays.value.length
  } catch (error) {
    console.error('获取今日生日员工失败：', error)
    todayBirthdays.value = []
    stats.value.todayBirthdays = 0
  }
}

// 测试发送
const handleTestSend = async (employeeId: number) => {
  if (sentEmployeeIds.value.has(employeeId)) return
  sendingId.value = employeeId
  try {
    const res = await testSend(employeeId)
    // 拦截器已解包，res 直接是内层 data
    const isSuccess = res?.smsStatus === 'success'
    if (isSuccess) {
      sentEmployeeIds.value.add(employeeId)
      ElMessage.success('测试发送成功')
    } else {
      ElMessage.warning('贺卡生成成功，但短信发送失败')
    }
  } catch (error) {
    ElMessage.error('测试发送失败')
  } finally {
    sendingId.value = null
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: 24px;
}

.welcome-section h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #303133;
}

.welcome-text {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 8px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.birthday-card {
  margin-bottom: 24px;
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.birthday-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.birthday-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s;
}

.birthday-item:hover {
  background: #ecf5ff;
  transform: translateX(4px);
}

.employee-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.employee-detail {
  font-size: 13px;
  color: #909399;
}

.quick-actions {
  border-radius: 8px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.actions-grid .el-button {
  width: 100%;
  height: 48px;
  font-size: 15px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-value {
    font-size: 24px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }

  .birthday-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .birthday-item .el-button {
    width: 100%;
  }
}
</style>