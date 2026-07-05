<template>
  <div class="system-stats">
    <h2 class="page-title">系统监控</h2>

    <!-- 顶部：服务健康状态 -->
    <el-row :gutter="20" class="section">
      <el-col :xs="12" :sm="6" v-for="item in healthCards" :key="item.key">
        <el-card shadow="hover" class="health-card">
          <div class="health-indicator">
            <span
              class="status-dot"
              :class="item.statusClass"
            ></span>
            <span class="status-text" :class="item.statusClass">{{ item.label }}</span>
          </div>
          <div class="health-value">{{ item.value }}</div>
          <div class="health-desc">{{ item.desc }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 中间：发送统计 -->
    <el-row :gutter="20" class="section">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="总发送量" :value="stats.send_stats.total" />
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="成功数" :value="stats.send_stats.success">
            <template #suffix>
              <span style="color: #67C23A; font-size: 14px">&#10003;</span>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="失败数" :value="stats.send_stats.failed">
            <template #suffix>
              <span style="color: #F56C6C; font-size: 14px">&#10007;</span>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="成功率" :value="stats.send_stats.success_rate" :precision="2">
            <template #suffix>%</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 今日发送 -->
    <el-row :gutter="20" class="section">
      <el-col :span="24">
        <el-card shadow="hover" class="today-card">
          <template #header>
            <span>今日发送</span>
          </template>
          <el-statistic title="今日已发送贺卡数" :value="stats.today_count" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 底部：数据表格 -->
    <el-row :gutter="20" class="section">
      <!-- 模板使用统计 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover">
          <template #header>
            <span>模板使用统计</span>
          </template>
          <el-table
            :data="stats.template_usage"
            stripe
            style="width: 100%"
            empty-text="暂无数据"
          >
            <el-table-column prop="template_name" label="模板名称" />
            <el-table-column prop="count" label="使用次数" width="120" />
          </el-table>
          <!-- 后续可在此处集成 ECharts 饼图 -->
        </el-card>
      </el-col>

      <!-- 等级发送统计 -->
      <el-col :xs="24" :sm="12">
        <el-card shadow="hover">
          <template #header>
            <span>员工等级发送统计</span>
          </template>
          <el-table
            :data="stats.level_stats"
            stripe
            style="width: 100%"
            empty-text="暂无数据"
          >
            <el-table-column prop="level" label="等级">
              <template #default="{ row }">
                <el-tag :type="levelTagType(row.level)">
                  {{ levelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="发送次数" width="120" />
          </el-table>
          <!-- 后续可在此处集成 ECharts 柱状图 -->
        </el-card>
      </el-col>
    </el-row>

    <!-- 刷新状态提示 -->
    <div class="refresh-info">
      <el-tag type="info" size="small">
        每 30 秒自动刷新 | 上次更新: {{ lastRefresh }}
      </el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSystemHealth, getSystemStats } from '@/api/monitor'
import type { SystemHealth, SystemStats } from '@/api/monitor'
import { ElMessage } from 'element-plus'

// 健康状态数据
const health = ref<SystemHealth>({
  sender_service: 'unknown',
  monitor_service: 'unknown',
  database: 'unknown',
  last_heartbeat: ''
})

// 统计数据
const stats = ref<SystemStats>({
  send_stats: { total: 0, success: 0, failed: 0, success_rate: 0 },
  template_usage: [],
  today_count: 0,
  level_stats: []
})

const lastRefresh = ref('--')

// 健康状态卡片配置
const healthCards = computed(() => [
  {
    key: 'sender',
    label: '发送服务',
    value: statusLabel(health.value.sender_service),
    desc: '生日贺卡发送进程',
    statusClass: statusClass(health.value.sender_service)
  },
  {
    key: 'monitor',
    label: '监控服务',
    value: statusLabel(health.value.monitor_service),
    desc: '系统监控进程',
    statusClass: statusClass(health.value.monitor_service)
  },
  {
    key: 'database',
    label: '数据库',
    value: statusLabel(health.value.database),
    desc: 'MySQL 连接状态',
    statusClass: health.value.database === 'connected' ? 'status-healthy' : 'status-unhealthy'
  },
  {
    key: 'heartbeat',
    label: '最后心跳',
    value: health.value.last_heartbeat ? formatTime(health.value.last_heartbeat) : '暂无',
    desc: '发送服务最后活跃时间',
    statusClass: health.value.last_heartbeat ? 'status-healthy' : 'status-unhealthy'
  }
])

// 辅助函数
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: '正常',
    unhealthy: '异常',
    connected: '已连接',
    disconnected: '未连接',
    unknown: '未知'
  }
  return map[status] || status
}

function statusClass(status: string): string {
  if (status === 'healthy' || status === 'connected') return 'status-healthy'
  if (status === 'unhealthy' || status === 'disconnected') return 'status-unhealthy'
  return 'status-unknown'
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function levelLabel(level: string): string {
  const map: Record<string, string> = {
    management: '高管',
    manager: '中层管理',
    employee: '普通员工',
    unknown: '未知'
  }
  return map[level] || level
}

function levelTagType(level: string): '' | 'success' | 'warning' | 'info' {
  const map: Record<string, '' | 'success' | 'warning' | 'info'> = {
    management: 'warning',
    manager: '',
    employee: 'info',
    unknown: 'info'
  }
  return map[level] || 'info'
}

// 数据加载
const fetchHealth = async () => {
  try {
    const data = await getSystemHealth()
    health.value = data
  } catch {
    // 请求拦截器已处理错误提示
  }
}

const fetchStats = async () => {
  try {
    const data = await getSystemStats()
    stats.value = data
  } catch {
    // 请求拦截器已处理错误提示
  }
}

const fetchAll = async () => {
  await Promise.all([fetchHealth(), fetchStats()])
  lastRefresh.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

// 自动刷新（30秒）
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchAll()
  refreshTimer = setInterval(fetchAll, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.system-stats {
  padding: 0;
}

.page-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.section {
  margin-bottom: 20px;
}

/* 健康状态卡片 */
.health-card {
  text-align: center;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.health-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.status-healthy,
.status-text.status-healthy {
  color: #67C23A;
}

.status-dot.status-healthy {
  background-color: #67C23A;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.status-dot.status-unhealthy,
.status-text.status-unhealthy {
  color: #F56C6C;
}

.status-dot.status-unhealthy {
  background-color: #F56C6C;
  box-shadow: 0 0 6px rgba(245, 108, 108, 0.5);
}

.status-dot.status-unknown,
.status-text.status-unknown {
  color: #909399;
}

.status-dot.status-unknown {
  background-color: #909399;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
}

.health-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.health-desc {
  font-size: 12px;
  color: #909399;
}

/* 统计卡片 */
.stat-card {
  text-align: center;
}

.stat-card :deep(.el-statistic) {
  justify-content: center;
}

/* 今日发送 */
.today-card {
  text-align: center;
}

.today-card :deep(.el-statistic) {
  justify-content: center;
}

/* 刷新提示 */
.refresh-info {
  text-align: center;
  margin-top: 16px;
}
</style>
