<template>
  <div class="blessing-list-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">祝福语管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加祝福语
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="blessings"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="content" label="祝福内容" min-width="320" />
        <el-table-column prop="match_gender" label="性别" width="100">
          <template #default="{ row }">
            {{ getGenderText(row.match_gender) }}
          </template>
        </el-table-column>
        <el-table-column label="年龄范围" width="140">
          <template #default="{ row }">
            {{ formatAgeRange(row.match_age_min, row.match_age_max) }}
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="引用模板" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.template_count > 0" type="warning" size="small">
              {{ row.template_count }} 个模板
            </el-tag>
            <span v-else style="color: #909399; font-size: 13px;">未引用</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && blessings.length === 0" class="empty-tip">
        <el-empty description="暂无祝福语" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBlessingList, deleteBlessing } from '@/api/blessings'
import type { Blessing } from '@/api/blessings'

const router = useRouter()
const blessings = ref<Blessing[]>([])
const loading = ref(false)

const getGenderText = (gender?: string) => {
  const map: Record<string, string> = {
    male: '男性',
    female: '女性',
    all: '不限'
  }
  return map[gender || 'all'] || '不限'
}

const formatAgeRange = (min?: number | null, max?: number | null) => {
  if (min == null && max == null) {
    return '不限'
  }
  return `${min ?? '-'} - ${max ?? '-'} 岁`
}

const loadBlessings = async () => {
  loading.value = true
  try {
    blessings.value = await getBlessingList()
  } catch (error) {
    console.error('加载祝福语失败：', error)
    blessings.value = []
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  router.push('/blessings/add')
}

const handleEdit = (row: Blessing) => {
  router.push(`/blessings/${row.id}/edit`)
}

const handleDelete = async (row: Blessing) => {
  try {
    const refCount = (row as any).template_count || 0
    const confirmMsg = refCount > 0
      ? `确定要删除此祝福语吗？\n\n⚠️ 警告：该祝福语正在被 ${refCount} 个模板引用，删除后这些模板的默认祝福语将被清空。`
      : '确定要删除此祝福语吗？'
    await ElMessageBox.confirm(confirmMsg, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: refCount > 0 ? 'warning' : 'info',
      confirmButtonClass: refCount > 0 ? 'el-button--danger' : ''
    })
    if (!row.id) return
    await deleteBlessing(row.id)
    ElMessage.success(refCount > 0 ? `删除成功，已解除 ${refCount} 个模板的关联` : '删除成功')
    loadBlessings()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadBlessings()
})
</script>

<style scoped>
.blessing-list-container {
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
}

.empty-tip {
  padding: 40px 0;
  text-align: center;
}
</style>
