<template>
  <div class="template-list-container">
    <el-card>
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="title">贺卡模板管理</span>
          <el-button type="primary" @click="handleBackfillBlessings" :loading="backfilling">
            <el-icon><MagicStick /></el-icon>
            补配祝福语
          </el-button>
        </div>
      </template>

      <!-- 模板卡片网格 -->
      <div v-loading="loading" class="template-grid">
        <el-empty v-if="templates.length === 0 && !loading" description="暂无模板" />
        
        <div v-else class="cards-container">
          <el-card
            v-for="template in templates"
            :key="template.id"
            class="template-card"
            shadow="hover"
          >
            <!-- 模板预览图 -->
            <div class="template-preview">
              <div class="preview-placeholder">
                <el-icon :size="48"><Picture /></el-icon>
                <div class="preview-text">模板预览</div>
              </div>
            </div>

            <!-- 模板信息 -->
            <div class="template-info">
              <h3 class="template-name">{{ template.name }}</h3>
              <p class="template-desc">{{ template.description || '暂无描述' }}</p>
              
              <div class="template-meta">
                <el-tag size="small" type="info">
                  {{ getGenderText(template.match_gender) }}
                </el-tag>
                <el-tag v-if="template.match_age_min || template.match_age_max" size="small">
                  {{ template.match_age_min || '-' }}-{{ template.match_age_max || '-' }}岁
                </el-tag>
              </div>
              <div class="template-blessing" v-if="template.default_blessing">
                <el-tag size="small" type="success" effect="plain">
                  祝福语：{{ template.default_blessing.content.length > 20 ? template.default_blessing.content.slice(0, 20) + '...' : template.default_blessing.content }}
                </el-tag>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="template-actions">
              <el-button type="info" @click="handleOpenPreviewWindow(template)">
                <el-icon><Expand /></el-icon>
                预览
              </el-button>
              <el-button type="warning" @click="handleEdit(template)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" @click="handleDelete(template)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Picture, Edit, Expand, Delete, MagicStick } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTemplateList, previewTemplate, deleteTemplate, backfillBlessings } from '@/api/templates'
import type { Template } from '@/api/templates'

const router = useRouter()

// 模板列表
const templates = ref<Template[]>([])
const loading = ref(false)
const backfilling = ref(false)

// 获取性别文字
const getGenderText = (gender?: string) => {
  const genderMap: Record<string, string> = {
    male: '男性',
    female: '女性',
    all: '不限'
  }
  return genderMap[gender || 'all'] || '不限'
}

// 加载模板列表
const loadTemplates = async () => {
  loading.value = true
  try {
    templates.value = await getTemplateList()
  } catch (error) {
    console.error('加载模板列表失败：', error)
    // 接口异常时使用默认兜底数据
    templates.value = []
  } finally {
    loading.value = false
  }
}

// 编辑模板
const handleEdit = (template: Template) => {
  router.push(`/templates/${template.id}/edit`)
}

// 预览模板
const openPreviewWindow = (html: string, title = '模板预览') => {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    ElMessage.error('弹窗被拦截，请允许弹窗')
    return
  }

  previewWindow.document.open()
  previewWindow.document.write(html)
  previewWindow.document.close()
  previewWindow.document.title = title
}

const handleOpenPreviewWindow = async (template: Template) => {
  if (!template.id) {
    ElMessage.warning('模板ID不存在，无法预览')
    return
  }

  try {
    const html = await previewTemplate(template.id)
    openPreviewWindow(html, template.name || '模板预览')
  } catch (error) {
    console.error('新窗口预览失败：', error)
    ElMessage.error('预览失败，请稍后重试')
  }
}

// 删除模板
const handleDelete = async (template: Template) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板「${template.name}」吗？\n删除后关联的员工将解除默认模板绑定。`,
      '提示',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    if (!template.id) return
    await deleteTemplate(template.id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
      ElMessage.error('删除失败')
    }
  }
}

// 补配祝福语（回填未匹配祝福语的模板）
const handleBackfillBlessings = async () => {
  try {
    await ElMessageBox.confirm(
      '将为所有未匹配祝福语的模板随机分配一条通用祝福语，确定继续？',
      '补配祝福语',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    backfilling.value = true
    const res = await backfillBlessings()
    if (res.updated === 0) {
      ElMessage.info('所有模板均已匹配祝福语，无需补配')
    } else {
      ElMessage.success(`已为 ${res.updated} 个模板补配祝福语`)
    }
    loadTemplates()
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error('补配失败：', err)
      ElMessage.error('补配失败，请稍后重试')
    }
  } finally {
    backfilling.value = false
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.template-list-container {
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

.template-grid {
  min-height: 400px;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.template-card {
  transition: all 0.3s;
}

.template-card:hover {
  transform: translateY(-4px);
}

.template-preview {
  position: relative;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-placeholder {
  text-align: center;
  color: white;
}

.preview-text {
  margin-top: 8px;
  font-size: 14px;
  opacity: 0.9;
}

.template-info {
  margin-bottom: 16px;
}

.template-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.template-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.template-blessing {
  margin-top: 8px;
}

.template-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.template-actions .el-button {
  flex: 1;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: 1fr;
  }

  .template-actions {
    flex-direction: column;
  }

  .template-actions .el-button {
    width: 100%;
  }
}
</style>