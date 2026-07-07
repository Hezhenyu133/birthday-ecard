<template>
  <div class="dashboard-container">
    <!-- 顶部欢迎区域 -->
    <div class="welcome-section">
      <div class="welcome-text-area">
        <h2>欢迎使用生日贺卡管理系统</h2>
        <p class="welcome-date">今天是 {{ currentDate }}</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" style="--card-accent: var(--primary-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><User /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalEmployees }}</div>
          <div class="stat-label">员工总数</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: var(--accent-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><Star /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.todayBirthdays }}</div>
          <div class="stat-label">今日生日</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: #67C23A">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><CircleCheck /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.successRate }}%</div>
          <div class="stat-label">发送成功率</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: var(--secondary-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><Message /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalSent }}</div>
          <div class="stat-label">总发送数</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-grid">
      <!-- 月度发送趋势 -->
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <span class="chart-title">月度发送趋势</span>
        </template>
        <div ref="monthlyChartRef" class="chart-container"></div>
      </el-card>

      <!-- 发送状态分布 -->
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <span class="chart-title">发送状态分布</span>
        </template>
        <div ref="statusChartRef" class="chart-container"></div>
      </el-card>

      <!-- 模板使用排行 -->
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <span class="chart-title">模板使用排行</span>
        </template>
        <div ref="templateChartRef" class="chart-container"></div>
      </el-card>
    </div>

    <!-- 模板轮播 -->
    <el-card v-if="templates.length > 0" class="carousel-section" shadow="hover">
      <TemplateCarousel :templates="templates" :show-title="true" />
    </el-card>

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
        <el-button style="background-color: var(--accent-color); border-color: var(--accent-color); color: #fff" @click="$router.push('/employees/import')">
          <el-icon><Upload /></el-icon>
          批量导入
        </el-button>
        <el-button style="background-color: var(--secondary-color); border-color: var(--secondary-color); color: #fff" @click="$router.push('/templates')">
          <el-icon><Picture /></el-icon>
          管理模板
        </el-button>
        <el-button type="warning" @click="$router.push('/blessings')">
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
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { User, Star, CircleCheck, Message, Refresh, Plus, Upload, Picture, Document, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getTodayBirthdayEmployees, getEmployeeList } from '@/api/employees'
import { getRecordStats, getMonthlyStats } from '@/api/records'
import { testSend } from '@/api/records'
import { getSystemStats } from '@/api/monitor'
import { getTemplateList } from '@/api/templates'
import type { Template } from '@/api/templates'
import type { Employee } from '@/api/employees'
import TemplateCarousel from '@/components/TemplateCarousel.vue'

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
const sentEmployeeIds = ref<Set<number>>(new Set())
const sendingId = ref<number | null>(null)

// 模板列表（轮播用）
const templates = ref<Template[]>([])

// ECharts 实例
const monthlyChartRef = ref<HTMLElement>()
const statusChartRef = ref<HTMLElement>()
const templateChartRef = ref<HTMLElement>()
let monthlyChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null
let templateChart: echarts.ECharts | null = null

// 品牌色
const BRAND_COLORS = {
  primary: '#0085CC',
  secondary: '#1B83C6',
  accent: '#95C11F',
  success: '#67C23A',
  warning: '#E6A23C',
  danger: '#F56C6C'
}

// 开发模式
const isDevMode = import.meta.env.VITE_USE_MOCK === 'true'

// 初始化月度趋势图
const initMonthlyChart = (monthly: { month: string; total: number; success: number; failed: number }[]) => {
  if (!monthlyChartRef.value) return
  monthlyChart = echarts.init(monthlyChartRef.value)

  const months = monthly.map(m => m.month)
  const totalData = monthly.map(m => m.total)
  const successData = monthly.map(m => m.success)

  monthlyChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      textStyle: { color: '#333' }
    },
    legend: {
      data: ['总发送', '成功'],
      bottom: 0,
      textStyle: { color: '#666' }
    },
    grid: { top: 10, right: 20, bottom: 36, left: 50 },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: '#999', fontSize: 11 },
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        name: '总发送',
        type: 'line',
        smooth: true,
        data: totalData,
        itemStyle: { color: BRAND_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,133,204,0.25)' },
            { offset: 1, color: 'rgba(0,133,204,0.02)' }
          ])
        }
      },
      {
        name: '成功',
        type: 'line',
        smooth: true,
        data: successData,
        itemStyle: { color: BRAND_COLORS.accent },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(149,193,31,0.2)' },
            { offset: 1, color: 'rgba(149,193,31,0.02)' }
          ])
        }
      }
    ]
  })
}

// 初始化状态分布图
const initStatusChart = (sendStats: { success: number; failed: number; pending?: number }) => {
  if (!statusChartRef.value) return
  statusChart = echarts.init(statusChartRef.value)

  statusChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      textStyle: { color: '#333' }
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#666' }
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {c}',
          color: '#666'
        },
        data: [
          { value: sendStats.success, name: '成功', itemStyle: { color: BRAND_COLORS.success } },
          { value: sendStats.failed, name: '失败', itemStyle: { color: BRAND_COLORS.danger } },
          { value: sendStats.pending || 0, name: '待发送', itemStyle: { color: BRAND_COLORS.warning } }
        ].filter(d => d.value > 0)
      }
    ]
  })
}

// 初始化模板使用排行图
const initTemplateChart = (templateUsage: { template_name: string; count: number }[]) => {
  if (!templateChartRef.value) return
  templateChart = echarts.init(templateChartRef.value)

  // 按使用量排序，取前8
  const sorted = [...templateUsage].sort((a, b) => b.count - a.count).slice(0, 8)
  const names = sorted.map(t => t.template_name || '未知模板')
  const counts = sorted.map(t => t.count)

  templateChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      textStyle: { color: '#333' }
    },
    grid: { top: 10, right: 20, bottom: 10, left: 100, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#666', fontSize: 12 },
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    series: [
      {
        type: 'bar',
        data: counts,
        barWidth: '50%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: BRAND_COLORS.primary },
            { offset: 1, color: BRAND_COLORS.secondary }
          ])
        }
      }
    ]
  })
}

// 窗口resize处理
const handleResize = () => {
  monthlyChart?.resize()
  statusChart?.resize()
  templateChart?.resize()
}

// 加载数据
const loadData = async () => {
  try {
    if (isDevMode) {
      stats.value = {
        totalEmployees: 128,
        todayBirthdays: 3,
        successRate: 95,
        totalSent: 1256
      }
      todayBirthdays.value = MOCK_EMPLOYEES
      return
    }

    // 并行获取所有数据
    const [recordStats, empList, monthlyData, systemData, templateList] = await Promise.all([
      getRecordStats(),
      getEmployeeList({ page: 1, pageSize: 1 }),
      getMonthlyStats(),
      getSystemStats(),
      getTemplateList({ is_active: 1 })
    ])

    stats.value.successRate = recordStats.success_rate || 0
    stats.value.totalSent = recordStats.total || 0
    stats.value.totalEmployees = empList.total || 0
    templates.value = templateList || []

    // 获取今日已发送记录
    try {
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
      const { getRecordList } = await import('@/api/records')
      const todayRecords = await getRecordList({ page: 1, pageSize: 1000, status: 'success', startDate: todayStr, endDate: tomorrowStr })
      todayRecords.list.forEach((r: any) => {
        if (r.employee_id) sentEmployeeIds.value.add(r.employee_id)
      })
    } catch (e) {
      console.error('[仪表盘] 查询今日发送记录失败:', e)
    }

    // 获取今日生日员工
    await refreshBirthdays()

    // 渲染图表
    await nextTick()

    // 月度趋势
    if (monthlyData.monthly.length > 0) {
      initMonthlyChart(monthlyData.monthly)
    }

    // 状态分布
    initStatusChart({
      success: recordStats.success || 0,
      failed: recordStats.failed || 0
    })

    // 模板使用排行
    if (systemData.template_usage && systemData.template_usage.length > 0) {
      initTemplateChart(systemData.template_usage)
    }
  } catch (error) {
    console.error('加载数据失败：', error)
    stats.value = { totalEmployees: 0, todayBirthdays: 0, successRate: 0, totalSent: 0 }
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

onMounted(async () => {
  await loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  monthlyChart?.dispose()
  statusChart?.dispose()
  templateChart?.dispose()
})
</script>

<style scoped>
.dashboard-container {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: 24px;
  padding: 24px 28px;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  border-radius: 12px;
  color: #fff;
}

.welcome-section h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
}

.welcome-date {
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid var(--card-accent);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--card-accent) 12%, transparent);
  color: var(--card-accent);
  flex-shrink: 0;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* 图表区域 */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.chart-card {
  border-radius: 12px;
}

.chart-card:first-child {
  grid-column: 1 / -1;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-container {
  width: 100%;
  height: 280px;
}

/* 轮播区域 */
.carousel-section {
  margin-bottom: 24px;
  border-radius: 12px;
}

/* 生日卡片 */
.birthday-card {
  margin-bottom: 24px;
  border-radius: 12px;
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
  padding: 14px 16px;
  background: var(--bg-color);
  border-radius: 8px;
  transition: all 0.3s;
}

.birthday-item:hover {
  background: color-mix(in srgb, var(--primary-color) 6%, transparent);
  transform: translateX(4px);
}

.employee-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.employee-detail {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 快捷操作 */
.quick-actions {
  border-radius: 12px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.actions-grid .el-button {
  width: 100%;
  height: 44px;
  font-size: 14px;
  border-radius: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 0;
  }

  .welcome-section {
    padding: 16px 20px;
    border-radius: 8px;
  }

  .welcome-section h2 {
    font-size: 18px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 14px;
    gap: 12px;
  }

  .stat-icon-wrap {
    width: 42px;
    height: 42px;
  }

  .stat-value {
    font-size: 22px;
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 240px;
  }

  .actions-grid {
    grid-template-columns: 1fr 1fr;
  }

  .birthday-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .birthday-item .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
