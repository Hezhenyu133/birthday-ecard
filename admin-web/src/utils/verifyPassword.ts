import { ElMessageBox } from 'element-plus'
import { verifyPassword as apiVerifyPassword } from '@/api/auth'

/**
 * 敏感操作前的密码二次确认
 * 弹出输入框要求输入当前密码，调用后端验证接口
 * @returns Promise<void> - 验证通过时 resolve，取消或验证失败时 reject
 */
export const confirmPassword = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    ElMessageBox.prompt('请输入当前密码以确认操作', '安全验证', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '请输入当前密码',
      type: 'warning'
    }).then(async ({ value }) => {
      if (!value) {
        reject(new Error('密码不能为空'))
        return
      }

      try {
        const result = await apiVerifyPassword(value)
        if (result.valid) {
          resolve()
        } else {
          ElMessageBox.alert('密码验证失败，请重新输入', '提示', { type: 'error' })
          reject(new Error('密码验证失败'))
        }
      } catch (err: any) {
        reject(err)
      }
    }).catch(() => {
      reject(new Error('用户取消'))
    })
  })
}
