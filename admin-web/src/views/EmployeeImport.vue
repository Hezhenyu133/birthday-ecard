<template>
  <div class="employee-import-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">批量导入员工</span>
          <el-button @click="$router.push('/employees')">
            <el-icon><Back /></el-icon>
            返回列表
          </el-button>
        </div>
      </template>

      <div class="import-content">
        <!-- 步骤说明 -->
        <el-alert
          title="导入说明"
          type="info"
          :closable="false"
          show-icon
          class="import-tips"
        >
          <template #default>
            <ol>
              <li>下载 Excel 导入模板</li>
              <li>按照模板格式填写员工数据</li>
              <li>上传填写好的 Excel 文件</li>
              <li>查看导入结果</li>
            </ol>
          </template>
        </el-alert>

        <!-- 下载模板 -->
        <div class="download-section">
          <h3>第一步：下载导入模板</h3>
          <el-button type="primary" @click="downloadTemplate">
            <el-icon><Download /></el-icon>
            下载 Excel 模板
          </el-button>
        </div>

        <!-- 上传文件 -->
        <div class="upload-section">
          <h3>第二步：上传 Excel 文件</h3>
          <el-upload
            class="upload-area"
            drag
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls,.csv"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
            :before-upload="beforeUpload"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                仅支持 .xlsx、.xls 或 .csv 格式，文件大小不超过 10MB
              </div>
            </template>
          </el-upload>
        </div>

        <!-- 导入按钮 -->
        <div class="action-section" v-if="selectedFile">
          <el-button 
            type="success" 
            size="large" 
            @click="handleImport"
            :loading="importing"
          >
            <el-icon><Upload /></el-icon>
            开始导入
          </el-button>
          <el-button size="large" @click="clearFile">
            重新选择文件
          </el-button>
        </div>

        <!-- 导入结果 -->
        <div class="result-section" v-if="importResult">
          <h3>导入结果</h3>
          
          <!-- 统计信息 -->
          <el-descriptions :column="3" border class="result-stats">
            <el-descriptions-item label="成功导入">
              <el-tag type="success">{{ importResult.success }} 条</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="导入失败">
              <el-tag type="danger">{{ importResult.failed }} 条</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="总计">
              <el-tag>{{ importResult.success + importResult.failed }} 条</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 错误详情 -->
          <div v-if="importResult.errors && importResult.errors.length > 0" class="error-details">
            <h4>失败详情</h4>
            <el-table :data="importResult.errors.map((msg, i) => ({ index: i + 1, message: msg }))" border size="small">
              <el-table-column prop="index" label="序号" width="60" />
              <el-table-column prop="message" label="错误信息" />
            </el-table>
          </div>

          <!-- 操作按钮 -->
          <div class="result-actions">
            <el-button type="primary" @click="$router.push('/employees')">
              查看员工列表
            </el-button>
            <el-button @click="resetImport">
              继续导入
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Back, Download, UploadFilled, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { importEmployees } from '@/api/employees'

const router = useRouter()

// 选中的文件
const selectedFile = ref<File | null>(null)

// 导入状态
const importing = ref(false)

// 导入结果
interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

const importResult = ref<ImportResult | null>(null)

// 下载模板
const downloadTemplate = () => {
  // 创建示例数据
  const templateContent = '姓名,性别,生日,手机号,部门,职位\n张三,male,1990-01-01,13800138000,技术部,工程师\n李四,female,1992-05-15,13900139000,市场部,专员'
  
  // 创建 blob 并下载
  const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '员工导入模板.csv'
  link.click()
  URL.revokeObjectURL(link.href)
  
  ElMessage.success('模板下载成功')
}

// 文件改变
const handleFileChange = (file: UploadFile) => {
  selectedFile.value = file.raw || null
}

// 文件超出限制
const handleExceed = () => {
  ElMessage.warning('只能上传一个文件')
}

// 上传前验证
const beforeUpload = (file: File) => {
  const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                  file.type === 'application/vnd.ms-excel' ||
                  file.type === 'text/csv'
  const isLt10M = file.size / 1024 / 1024 < 10

  if (!isExcel) {
    ElMessage.error('只能上传 Excel 或 CSV 文件!')
    return false
  }
  if (!isLt10M) {
    ElMessage.error('文件大小不能超过 10MB!')
    return false
  }
  return true
}

// 清除文件
const clearFile = () => {
  selectedFile.value = null
  importResult.value = null
}

// 开始导入
const handleImport = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  importing.value = true
  try {
    const result = await importEmployees(selectedFile.value)
    
    // 拦截器对成功响应已解包（返回 data），对400验证错误返回完整响应体
    if (result?.code === 400 && result?.data?.errors) {
      // 数据验证失败
      const { message, data } = result
      importResult.value = {
        success: data.valid || 0,
        failed: data.errors.length,
        errors: data.errors.map((e: any) => typeof e === 'string' ? e : `第${e.row}行: ${e.reason}`)
      }
      ElMessage.error(message || '部分数据验证失败')
    } else if (result?.imported !== undefined || result?.code === 200) {
      // 导入成功（拦截器已解包，result 就是 data）
      const imported = result.imported ?? result.data?.imported ?? 0
      importResult.value = {
        success: imported,
        failed: 0,
        errors: []
      }
      ElMessage.success(`成功导入 ${imported} 条数据`)
    } else {
      ElMessage.error('导入失败，请检查文件格式')
    }
  } catch (error: any) {
    console.error('导入失败：', error)
    ElMessage.error('网络错误或服务器异常，请稍后重试')
  } finally {
    importing.value = false
  }
}

// 重置导入
const resetImport = () => {
  selectedFile.value = null
  importResult.value = null
}
</script>

<style scoped>
.employee-import-container {
  max-width: 900px;
  margin: 0 auto;
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

.import-content {
  padding: 20px;
}

.import-tips {
  margin-bottom: 30px;
}

.import-tips ol {
  margin: 8px 0 0 0;
  padding-left: 20px;
  line-height: 1.8;
}

.download-section,
.upload-section {
  margin-bottom: 30px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.download-section h3,
.upload-section h3,
.result-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.upload-area {
  width: 100%;
}

.action-section {
  margin: 30px 0;
  text-align: center;
}

.action-section .el-button {
  min-width: 150px;
}

.result-section {
  margin-top: 30px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.result-stats {
  margin-bottom: 20px;
}

.error-details {
  margin: 20px 0;
}

.error-details h4 {
  margin: 0 0 12px 0;
  color: #f56c6c;
}

.result-actions {
  margin-top: 20px;
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .employee-import-container {
    padding: 0;
  }

  .import-content {
    padding: 12px;
  }

  .download-section,
  .upload-section {
    padding: 16px;
  }

  .result-stats {
    :deep(.el-descriptions__body) {
      flex-direction: column;
    }
  }
}
</style>