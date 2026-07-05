<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <aside :class="['sidebar', { collapsed: isCollapsed }]">
      <div class="sidebar-header">
        <h1 v-show="!isCollapsed">生日贺卡管理</h1>
        <h1 v-show="isCollapsed">🎂</h1>
      </div>

      <nav class="sidebar-menu">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapsed"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
          router
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>

          <el-sub-menu index="employees">
            <template #title>
              <el-icon><User /></el-icon>
              <span>人员管理</span>
            </template>
            <el-menu-item index="/employees">
              <el-icon><List /></el-icon>
              <template #title>人员列表</template>
            </el-menu-item>
            <el-menu-item index="/employees/add">
              <el-icon><Plus /></el-icon>
              <template #title>添加人员</template>
            </el-menu-item>
            <el-menu-item index="/employees/import">
              <el-icon><Upload /></el-icon>
              <template #title>批量导入</template>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/templates">
            <el-icon><Picture /></el-icon>
            <template #title>模板管理</template>
          </el-menu-item>

          <el-menu-item index="/blessings">
            <el-icon><ChatDotRound /></el-icon>
            <template #title>祝福语管理</template>
          </el-menu-item>

          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <template #title>发送记录</template>
          </el-menu-item>

          <el-menu-item index="/operation-logs">
            <el-icon><Notebook /></el-icon>
            <template #title>操作日志</template>
          </el-menu-item>

          <el-menu-item index="/system-stats">
            <el-icon><DataAnalysis /></el-icon>
            <template #title>系统监控</template>
          </el-menu-item>
        </el-menu>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 顶部导航栏 -->
      <header class="header">
        <div class="header-left">
          <el-button 
            :icon="isCollapsed ? Expand : Fold" 
            circle 
            @click="toggleSidebar"
            class="collapse-btn"
          />
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" style="background-color: #409EFF">
                {{ userInitial }}
              </el-avatar>
              <span class="username">{{ displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <el-dialog
        title="修改密码"
        :model-value="passwordDialogVisible"
        width="420px"
        @close="resetPasswordForm"
      >
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="100px"
        >
          <el-form-item label="原密码" prop="oldPassword">
            <el-input v-model="passwordForm.oldPassword" type="password" autocomplete="off" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="passwordForm.newPassword" type="password" autocomplete="off" />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="passwordForm.confirmPassword" type="password" autocomplete="off" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="passwordDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitChangePassword">提交</el-button>
        </template>
      </el-dialog>

      <!-- 内容区域 -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  HomeFilled, 
  User, 
  List, 
  Plus, 
  Upload, 
  Picture, 
  ChatDotRound,
  Document,
  Notebook,
  DataAnalysis,
  Fold,
  Expand,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { changePassword, logout as logoutApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 密码修改弹窗
const passwordDialogVisible = ref(false)
const passwordFormRef = ref()
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: any) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 用户信息
const displayName = computed(() => {
  return userStore.userInfo?.display_name || '管理员'
})

const userInitial = computed(() => {
  const name = displayName.value
  return name.charAt(0).toUpperCase()
})

// 切换侧边栏
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const resetPasswordForm = () => {
  passwordForm.value.oldPassword = ''
  passwordForm.value.newPassword = ''
  passwordForm.value.confirmPassword = ''
  passwordFormRef.value?.clearValidate()
}

const submitChangePassword = () => {
  passwordFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return

    try {
      await changePassword({
        oldPassword: passwordForm.value.oldPassword,
        newPassword: passwordForm.value.newPassword
      })
      ElMessage.success('密码修改成功，请重新登录')
      passwordDialogVisible.value = false
      resetPasswordForm()
      userStore.clearAuth()
      router.push('/login')
    } catch (err: any) {
      ElMessage.error(err?.message || '密码修改失败，请重试')
    }
  })
}

// 处理下拉菜单命令
const handleCommand = async (command: string) => {
  switch (command) {
    case 'password':
      resetPasswordForm()
      passwordDialogVisible.value = true
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        // 调用后端登出接口，清除会话记录
        try {
          await logoutApi()
        } catch {
          // 即使后端接口失败，也清除本地状态
        }

        userStore.clearAuth()
        ElMessage.success('已退出登录')
        router.push('/login')
      } catch {
        // 用户取消
      }
      break
  }
}

// ========== 会话超时逻辑 ==========

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 分钟
const CHECK_INTERVAL_MS = 60 * 1000       // 每分钟检查一次

let lastActivityTime = Date.now()
let sessionCheckTimer: ReturnType<typeof setInterval> | null = null

const updateActivityTime = () => {
  lastActivityTime = Date.now()
}

const checkSessionTimeout = () => {
  const elapsed = Date.now() - lastActivityTime
  if (elapsed >= SESSION_TIMEOUT_MS) {
    // 超时：清除认证状态并跳转登录页
    ElMessage.warning('长时间未操作，会话已超时，请重新登录')
    userStore.clearAuth()
    router.push('/login')
  }
}

onMounted(() => {
  // 注册用户活动事件
  window.addEventListener('mousemove', updateActivityTime)
  window.addEventListener('keydown', updateActivityTime)
  window.addEventListener('click', updateActivityTime)

  // 启动定时检查器
  sessionCheckTimer = setInterval(checkSessionTimeout, CHECK_INTERVAL_MS)
})

onUnmounted(() => {
  // 清理事件监听器
  window.removeEventListener('mousemove', updateActivityTime)
  window.removeEventListener('keydown', updateActivityTime)
  window.removeEventListener('click', updateActivityTime)

  // 清除定时器
  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer)
    sessionCheckTimer = null
  }
})
</script>

<style scoped>
.layout-container {
  display: flex;
  height: 100vh;
  width: 100%;
}

/* 侧边栏样式 */
.sidebar {
  width: 240px;
  background-color: #304156;
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #263445;
  padding: 0 16px;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 18px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
}

.sidebar-menu .el-menu {
  border-right: none;
}

/* 主内容区 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部导航栏 */
.header {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
}

.collapse-btn {
  border: none;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #303133;
}

/* 内容区域 */
.content {
  flex: 1;
  background-color: #f0f2f5;
  overflow-y: auto;
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 1000;
    transform: translateX(0);
  }

  .sidebar.collapsed {
    transform: translateX(-100%);
    width: 240px;
  }

  .header {
    padding: 0 12px;
  }

  .username {
    display: none;
  }

  .content {
    padding: 12px;
  }
}

/* 滚动条样式 */
.sidebar-menu::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
