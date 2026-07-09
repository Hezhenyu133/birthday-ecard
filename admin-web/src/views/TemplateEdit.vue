<template>
  <div class="template-edit-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">{{ isEdit ? '编辑模板' : '添加模板' }}</span>
          <div class="header-actions">
            <el-button @click="handleBack">
              <el-icon><Back /></el-icon>
              返回
            </el-button>
            <el-button type="primary" @click="togglePreview" v-if="isEdit">
              <el-icon><View /></el-icon>
              {{ showPreview ? '隐藏预览' : '显示预览' }}
            </el-button>
            <el-button type="success" @click="openPreviewWindow" v-if="isEdit">
              <el-icon><Expand /></el-icon>
              新窗口预览
            </el-button>
          </div>
        </div>
      </template>

      <div class="edit-content" :class="{ 'with-preview': showPreview && isEdit }">
        <!-- 左侧编辑区 -->
        <div class="edit-form">
          <el-form
            ref="formRef"
            :model="formData"
            :rules="rules"
            label-width="120px"
            v-loading="loading"
          >
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入模板名称" />
            </el-form-item>

            <el-form-item label="模板描述" prop="description">
              <el-input
                v-model="formData.description"
                type="textarea"
                :rows="2"
                placeholder="请输入模板描述"
              />
            </el-form-item>

            <el-divider content-position="left">匹配规则</el-divider>

            <el-form-item label="匹配性别" prop="match_gender">
              <el-radio-group v-model="formData.match_gender">
                <el-radio value="all">不限</el-radio>
                <el-radio value="male">男性</el-radio>
                <el-radio value="female">女性</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="年龄范围">
              <el-space>
                <el-input-number
                  v-model="formData.match_age_min"
                  :min="0"
                  :max="100"
                  placeholder="最小年龄"
                  controls-position="right"
                  style="width: 120px"
                />
                <span>至</span>
                <el-input-number
                  v-model="formData.match_age_max"
                  :min="0"
                  :max="100"
                  placeholder="最大年龄"
                  controls-position="right"
                  style="width: 120px"
                />
                <span>岁</span>
              </el-space>
            </el-form-item>

            <el-form-item label="兴趣标签">
              <el-input
                v-model="formData.match_interests"
                placeholder="多个标签用逗号分隔（可选）"
              />
            </el-form-item>

            <el-form-item label="适用职级" prop="employee_level">
              <el-select v-model="formData.employee_level" multiple placeholder="请选择适用职级" style="width: 300px">
                <el-option label="管理层" value="management" />
                <el-option label="经理" value="manager" />
                <el-option label="员工" value="employee" />
              </el-select>
              <div class="hint-text">不选择则默认适用所有职级</div>
            </el-form-item>

            <el-form-item label="模板页数" prop="page_count">
              <el-select v-model="formData.page_count" placeholder="请选择页数" style="width: 200px">
                <el-option label="4 页" :value="4" />
                <el-option label="7 页" :value="7" />
              </el-select>
            </el-form-item>

            <el-form-item label="默认祝福语" prop="default_blessing_id">
              <el-select
                v-model="formData.default_blessing_id"
                placeholder="请选择默认祝福语（可选）"
                clearable
                @change="handleBlessingChange"
                @clear="handleClearBlessing"
              >
                <el-option
                  v-for="blessing in blessings"
                  :key="blessing.id"
                  :label="blessing.content.length > 30 ? blessing.content.slice(0, 30) + '...' : blessing.content"
                  :value="blessing.id"
                />
              </el-select>
              <div class="hint-text">如果选择，预览和生成卡片时将使用该祝福语替换 {{ blessingPlaceholder }} 占位符。</div>
            </el-form-item>

            <el-divider content-position="left">模板内容</el-divider>

            <!-- 祝福语内容编辑 -->
            <el-form-item label="祝福语内容" prop="blessing_content">
              <el-input
                v-model="formData.blessing_content"
                type="textarea"
                :rows="4"
                placeholder="输入祝福语文本，将替换模板中的 {{blessing}} 占位符。支持中文逗号断句显示。"
              />
              <div class="hint-text">此文本会在生成贺卡时替换模板中的祝福语占位符。也可通过上方「默认祝福语」下拉框选择已有祝福语。</div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSubmit" :loading="submitting">
                {{ isEdit ? '保存修改' : '提交' }}
              </el-button>
              <el-button @click="handleBack">取消</el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 右侧预览区 -->
        <div class="preview-panel" v-if="showPreview && isEdit">
          <el-card shadow="never">
            <template #header>
              <div class="preview-header">
                <span>实时预览</span>
                <el-button size="small" @click="refreshPreview">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </template>
            <div class="preview-content" v-html="previewHtml"></div>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back, View, Refresh, Expand } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createTemplate, updateTemplate, getTemplateDetail, previewTemplate } from '@/api/templates'
import { getBlessingList, updateBlessing } from '@/api/blessings'
import type { Template } from '@/api/templates'
import type { Blessing } from '@/api/blessings'

const route = useRoute()
const router = useRouter()

// 用于模板中显示占位符名称（避免 Vue 模板解析嵌套花括号）
const blessingPlaceholder = '{{blessing}}'

// 是否为编辑模式
const isEdit = computed(() => !!route.params.id)

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = reactive<Partial<Template>>({
  name: '',
  description: '',
  match_gender: 'all',
  match_age_min: null,
  match_age_max: null,
  match_interests: '',
  employee_level: [] as string[],
  page_count: 4,
  template_type: null,
  default_blessing_id: null,
  html_content: '',
  blessing_content: ''
})

// 表单验证规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' }
  ],
  // HTML 内容校验已移除（前端不再编辑原始 HTML 文本）
})

// 加载状态
const loading = ref(false)
const submitting = ref(false)

const blessings = ref<Blessing[]>([])

// 预览控制
const showPreview = ref(false)
const previewHtml = ref('')

// 刷新预览
const refreshPreview = async () => {
  if (!isEdit.value || !route.params.id) return

  try {
    const html = await previewTemplate(Number(route.params.id))
    previewHtml.value = html
  } catch (error) {
    console.error('获取后端预览失败：', error)
    ElMessage.warning('预览加载失败')
  }
}

// 切换预览
const openPreviewWindow = async () => {
  if (isEdit.value && route.params.id) {
    try {
      const html = await previewTemplate(Number(route.params.id))
      const previewWindow = window.open('', '_blank')
      if (!previewWindow) {
        ElMessage.error('弹窗被拦截，请允许弹窗')
        return
      }
      previewWindow.document.open()
      previewWindow.document.write(html)
      previewWindow.document.close()
      previewWindow.document.title = formData.name || '模板预览'
      return
    } catch (error) {
      console.error('后端预览打开失败，改为本地预览：', error)
    }
  }

  await refreshPreview()
  if (!previewHtml.value) {
    ElMessage.warning('无法生成预览内容')
    return
  }

  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    ElMessage.error('弹窗被拦截，请允许弹窗')
    return
  }
  previewWindow.document.open()
  previewWindow.document.write(previewHtml.value)
  previewWindow.document.close()
  previewWindow.document.title = formData.name || '模板预览'
}

const togglePreview = () => {
  showPreview.value = !showPreview.value
  if (showPreview.value) {
    refreshPreview()
  }
}

// 加载模板详情（编辑模式）
const loadTemplateDetail = async () => {
  if (!isEdit.value) return
  
  loading.value = true
  try {
    const id = Number(route.params.id)
    const detail = await getTemplateDetail(id)

    Object.assign(formData, {
      name: detail.name,
      description: detail.description || '',
      match_gender: detail.match_gender || 'all',
      match_age_min: detail.match_age_min,
      match_age_max: detail.match_age_max,
      match_interests: detail.match_interests || '',
      employee_level: Array.isArray(detail.employee_level) ? detail.employee_level.filter((l: string) => l !== 'all') : (detail.employee_level && detail.employee_level !== 'all' ? [detail.employee_level] : []),
      page_count: detail.page_count || 4,
      default_blessing_id: detail.default_blessing_id ?? null,
      html_content: detail.html_content,
      blessing_content: detail.default_blessing?.content || ''
    })
  } catch (error) {
    console.error('加载模板详情失败：', error)
    ElMessage.error('加载模板详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 清除祝福语选择
const handleClearBlessing = () => {
  formData.default_blessing_id = null
}

// 选择祝福语时，自动填充到祝福语内容编辑区
const handleBlessingChange = (blessingId: number | null) => {
  if (blessingId) {
    const blessing = blessings.value.find(b => b.id === blessingId)
    if (blessing) {
      formData.blessing_content = blessing.content
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      // 确保清除的祝福语ID正确传递为null
      if (!formData.default_blessing_id) {
        (formData as any).default_blessing_id = null
      }
      // 如果祝福语内容有变化且有关联的祝福语，更新祝福语内容
      if (formData.blessing_content && formData.default_blessing_id) {
        const originalBlessing = blessings.value.find(b => b.id === formData.default_blessing_id)
        if (!originalBlessing || originalBlessing.content !== formData.blessing_content) {
          await updateBlessing(formData.default_blessing_id, { content: formData.blessing_content })
        }
      }
      // 如果没有选择祝福语但有输入内容，创建新祝福语并关联
      if (formData.blessing_content && !formData.default_blessing_id) {
        const { createBlessing } = await import('@/api/blessings')
        const newBlessing = await createBlessing({ content: formData.blessing_content })
        ;(formData as any).default_blessing_id = newBlessing.id
      }

      if (isEdit.value) {
        await updateTemplate(Number(route.params.id), formData as Template)
        ElMessage.success('修改成功')
      } else {
        await createTemplate(formData as Template)
        ElMessage.success('添加成功')
      }
      
      router.push('/templates')
    } catch (error) {
      console.error('提交失败：', error)
      ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
    } finally {
      submitting.value = false
    }
  })
}

const loadBlessings = async () => {
  try {
    blessings.value = await getBlessingList({ is_active: 1 })
  } catch (error) {
    console.error('加载祝福语列表失败：', error)
    blessings.value = []
  }
}

// 返回
const handleBack = () => {
  router.back()
}

// 页面加载时获取数据
onMounted(() => {
  loadBlessings()
  loadTemplateDetail()
})
</script>

<style scoped>
.template-edit-container {
  padding: 0;
}

.hint-text {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
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

.header-actions {
  display: flex;
  gap: 12px;
}

.edit-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  padding: 20px;
}

.edit-content.with-preview {
  grid-template-columns: 1fr 1fr;
}

.html-editor {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.editor-tips {
  margin-top: 8px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.editor-tips p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #606266;
}

.preview-panel {
  position: sticky;
  top: 20px;
  height: fit-content;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-content {
  min-height: 400px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .edit-content.with-preview {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    position: static;
    max-height: none;
  }

  .el-form-item__label {
    width: 100px !important;
  }
}
</style>