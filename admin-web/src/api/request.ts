import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000
  // 不设置默认 Content-Type，让 axios 根据请求体自动判断
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    const token = userStore.getToken()
    
    // 如果token存在，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    console.error('请求错误：', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    // 处理非 JSON 响应（如模板预览返回的 HTML）
    const contentType = response.headers['content-type'] || ''
    if (contentType.includes('text/html') || typeof response.data === 'string') {
      return response.data
    }

    const { code, message, data } = response.data
    
    // 根据后端响应格式处理
    if (code === 200 || code === 0) {
      return data
    } else {
      ElMessage.error(message || '请求失败')
      return Promise.reject(new Error(message))
    }
  },
  (error) => {
    // 处理HTTP错误
    if (error.response) {
      const { status, data } = error.response

      // 400 且包含验证错误详情时，不弹全局提示，将数据透传给调用方处理
      if (status === 400 && data?.data?.errors) {
        return Promise.resolve(data)
      }
      
      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录')
          // 清除认证信息并跳转登录页
          const userStore = useUserStore()
          userStore.clearAuth()
          window.location.href = '/login'
          break
        case 403:
          ElMessage.error('没有权限访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器错误')
          break
        default:
          ElMessage.error(data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接失败')
    }
    
    return Promise.reject(error)
  }
)

export default request