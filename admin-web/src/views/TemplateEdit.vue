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

            <el-form-item label="默认祝福语" prop="default_blessing_id">
              <el-select
                v-model="formData.default_blessing_id"
                placeholder="请选择默认祝福语（可选）"
                clearable
                @clear="handleClearBlessing"
              >
                <el-option
                  v-for="blessing in blessings"
                  :key="blessing.id"
                  :label="blessing.content.length > 30 ? blessing.content.slice(0, 30) + '...' : blessing.content"
                  :value="blessing.id"
                />
              </el-select>
              <div class="hint-text">如果选择，预览和生成卡片时将使用该祝福语替换 {{blessing}} 占位符。</div>
            </el-form-item>

            <el-divider content-position="left">模板内容</el-divider>

            <!-- 使用纯文本编辑贺卡内容（管理员可通过占位符 {{name}} 等进行替换） -->
            <el-form-item label="贺卡文本内容" prop="text_content">
              <el-alert
                v-if="isEdit && !templateHasMarkers"
                title="该模板不支持文本编辑"
                description="此模板没有可编辑区域标记。如需修改内容，请联系管理员在模板 HTML 中添加标记。占位符 {{name}}、{{department}}、{{blessing}} 等仍会在生成贺卡时自动替换。"
                type="info"
                :closable="false"
                show-icon
                style="margin-bottom: 12px"
              />
              <el-input
                v-model="formData.text_content"
                type="textarea"
                :rows="8"
                :placeholder="templateHasMarkers ? '在此输入贺卡文本内容，可使用 {{name}}、{{department}}、{{position}}、{{blessing}} 占位符' : '该模板不支持文本编辑'"
                :disabled="isEdit && !templateHasMarkers"
              />
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
import { getBlessingList } from '@/api/blessings'
import type { Template } from '@/api/templates'
import type { Blessing } from '@/api/blessings'

const route = useRoute()
const router = useRouter()

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
  default_blessing_id: null,
  // 后端仍使用 html_content 字段；前端管理员使用 text_content 编辑，提交时会注入到原始 HTML 模板中
  html_content: '',
  text_content: ''
})

// 保存原始 HTML 结构，编辑时仅替换内容区域
const originalHtml = ref('')

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

// 检查 HTML 模板是否包含可编辑标记
const hasEditableMarkers = (html: string): boolean => {
  if (!html) return false
  return html.includes('<!-- editable-start -->') && html.includes('<!-- editable-end -->')
}

// 模板是否有可编辑标记
const templateHasMarkers = ref(true)

// 从 HTML 模板中提取可编辑区域的文本内容（<!-- editable-start --> 和 <!-- editable-end --> 之间）
const extractEditableText = (html: string): string => {
  if (!html) return ''
  const startMarker = '<!-- editable-start -->'
  const endMarker = '<!-- editable-end -->'
  const startIdx = html.indexOf(startMarker)
  const endIdx = html.indexOf(endMarker)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return ''

  const region = html.substring(startIdx + startMarker.length, endIdx)
  // 提取标签内的文本内容，移除 HTML 标签
  return region
    .replace(/<[^>]*class="[^"]*"[^>]*>(.*?)<\/[^>]+>/gs, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// 从可编辑区域提取包裹标签的名称和属性（保留原始 CSS 结构）
const extractWrapperTag = (region: string): { tag: string; attrs: string } => {
  const match = region.match(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)>/)
  if (match) {
    return { tag: match[1], attrs: match[2] || '' }
  }
  return { tag: 'div', attrs: '' }
}

// 将编辑后的文本注入原始 HTML 模板的可编辑区域（保留 CSS/布局不变）
const injectTextIntoTemplate = (text: string, html: string): string => {
  if (!html) return ''

  const startMarker = '<!-- editable-start -->'
  const endMarker = '<!-- editable-end -->'
  const startIdx = html.indexOf(startMarker)
  const endIdx = html.indexOf(endMarker)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    // 没有标记，直接返回原始 HTML（不破坏模板）
    return html
  }

  const before = html.substring(0, startIdx + startMarker.length)
  const after = html.substring(endIdx)

  // 提取原始可编辑区域的内容，以便保留包裹标签
  const originalRegion = html.substring(startIdx + startMarker.length, endIdx).trim()
  const wrapper = extractWrapperTag(originalRegion)

  // 转义 HTML 特殊字符
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 将文本段落转换为 HTML（双换行分段，单换行用 br）
  const paragraphs = escaped.split(/\n{2,}/).map(p => p.replace(/\n/g, '<br/>'))
  const contentHtml = paragraphs.map(p => `<p>${p}</p>`).join('\n')

  // 用原始包裹标签包裹新内容，保持 CSS 结构不变
  return `${before}\n<${wrapper.tag}${wrapper.attrs}>\n${contentHtml}\n</${wrapper.tag}>\n${after}`
}

// 刷新预览：优先使用纯文本编辑内容，其次回退到后端 html_content
const refreshPreview = async () => {
  const hasText = !!formData.text_content

  if (!hasText && !formData.html_content) return

  if (isEdit.value && route.params.id && !formData.text_content) {
    try {
      previewHtml.value = await previewTemplate(Number(route.params.id))
      return
    } catch (error) {
      console.error('获取后端预览失败，使用本地占位符替换：', error)
    }
  }

  const source = formData.text_content || formData.html_content || ''
  // 将编辑的文本注入原始模板，生成完整 HTML 用于预览
  const rawHtml = formData.text_content && originalHtml.value
    ? injectTextIntoTemplate(source, originalHtml.value)
    : source

  const selectedBlessing = blessings.value.find(b => b.id === formData.default_blessing_id)
  const blessingText = selectedBlessing?.content || '祝您生日快乐，事业蒸蒸日上！'

  previewHtml.value = rawHtml
      .replace(/\{\{name\}\}/g, '张三')
      .replace(/\{\{department\}\}/g, '技术部')
      .replace(/\{\{position\}\}/g, '工程师')
      .replace(/\{\{sender\}\}/g, '公司工会')
      .replace(/\{\{blessing\}\}/g, blessingText)
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
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
    
    originalHtml.value = detail.html_content || ''
    templateHasMarkers.value = hasEditableMarkers(detail.html_content || '')

    Object.assign(formData, {
      name: detail.name,
      description: detail.description || '',
      match_gender: detail.match_gender || 'all',
      match_age_min: detail.match_age_min,
      match_age_max: detail.match_age_max,
      match_interests: detail.match_interests || '',
      default_blessing_id: detail.default_blessing_id ?? null,
      html_content: detail.html_content,
      // 只提取可编辑区域的文本内容（标记之间的部分）
      text_content: extractEditableText(detail.html_content || '')
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
      // 将编辑的文本注入原始 HTML 模板的可编辑区域（保留完整模板结构）
      if (formData.text_content && originalHtml.value && templateHasMarkers.value) {
        ;(formData as any).html_content = injectTextIntoTemplate(
          formData.text_content,
          originalHtml.value
        )
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