<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>工会生日贺卡系统</h1>
        <p>管理员登录</p>
      </div>
      
      <el-form 
        ref="loginFormRef" 
        :model="loginForm" 
        :rules="rules" 
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="请输入用户名"
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="请输入密码"
            :prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            :loading="loading" 
            size="large"
            class="login-button"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { login, changePassword } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()

// 表单引用
const loginFormRef = ref<FormInstance>()

// 加载状态
const loading = ref(false)

// 表单数据
const loginForm = reactive({
  username: '',
  password: ''
})

// 表单验证规则
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

/**
 * 处理强制修改密码（首次登录）
 * 弹出对话框要求设置新密码
 */
const handleMustChangePassword = async (): Promise<boolean> => {
  try {
    const { value: newPassword } = await ElMessageBox.prompt(
      '首次登录需要修改密码。请输入新密码（8-20位，含大小写字母、数字和特殊字符）',
      '修改密码',
      {
        confirmButtonText: '确认修改',
        cancelButtonText: '退出登录',
        inputType: 'password',
        inputPlaceholder: '请输入新密码',
        distinguishCancelAndClose: true
      }
    )

    if (!newPassword) {
      ElMessage.warning('密码不能为空')
      return false
    }

    // 确认密码
    const { value: confirmPassword } = await ElMessageBox.prompt(
      '请再次输入新密码以确认',
      '确认密码',
      {
        confirmButtonText: '确认',
        cancelButtonText: '退出登录',
        inputType: 'password',
        inputPlaceholder: '请再次输入新密码',
        distinguishCancelAndClose: true
      }
    )

    if (newPassword !== confirmPassword) {
      ElMessage.error('两次输入的密码不一致')
      return false
    }

    // 调用修改密码接口（此时旧密码就是登录时用的密码）
    await changePassword({
      oldPassword: loginForm.password,
      newPassword: newPassword
    })

    ElMessage.success('密码修改成功')
    return true
  } catch (err: any) {
    // 用户点了"退出登录"或关闭对话框
    if (err === 'cancel' || err?.action === 'cancel') {
      ElMessage.info('请修改密码后登录')
    }
    return false
  }
}

/**
 * 处理密码过期提醒
 * 弹出提示框建议修改密码，用户可选择继续或去修改
 */
const handlePasswordExpired = async (): Promise<boolean> => {
  try {
    await ElMessageBox.confirm(
      '您的密码已超过90天未修改，建议立即修改密码以确保安全。',
      '密码过期提醒',
      {
        confirmButtonText: '去修改',
        cancelButtonText: '继续使用',
        type: 'warning',
        distinguishCancelAndClose: true
      }
    )
    // 用户点击"去修改" → 弹出修改密码对话框
    return await handleMustChangePassword()
  } catch (err: any) {
    // 用户点击"继续使用" → 放行
    if (err === 'cancel' || err?.action === 'cancel') {
      return true
    }
    // 用户关闭对话框
    return false
  }
}

// 登录处理
const handleLogin = async () => {
  // 验证表单
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    
    try {
      const response = await login({
        username: loginForm.username,
        password: loginForm.password
      })

      userStore.setToken(response.token)
      userStore.setUserInfo(response.user)

      // 检查是否必须修改密码（首次登录）
      if (response.must_change_password) {
        const changed = await handleMustChangePassword()
        if (!changed) {
          // 用户取消修改密码，清除登录状态
          userStore.clearAuth()
          loading.value = false
          return
        }
      }

      // 检查密码是否过期（超过90天）
      if (response.password_expired && !response.must_change_password) {
        const proceed = await handlePasswordExpired()
        if (!proceed) {
          userStore.clearAuth()
          loading.value = false
          return
        }
      }

      ElMessage.success('登录成功')
      router.push('/')
    } catch (error: any) {
      console.error('登录失败：', error)
      ElMessage.error(error?.message || '登录失败，请检查用户名和密码')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.login-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.login-header p {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.login-form {
  margin-top: 30px;
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
}

/* 响应式适配 */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
}
</style>
