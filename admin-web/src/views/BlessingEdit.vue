<template>
  <div class="blessing-edit-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">{{ isEdit ? '编辑祝福语' : '添加祝福语' }}</span>
          <el-button @click="handleBack">
            <el-icon><Back /></el-icon>
            返回
          </el-button>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="120px"
        class="edit-form"
      >
        <el-form-item label="祝福内容" prop="content">
          <el-input
            type="textarea"
            v-model="formData.content"
            :rows="6"
            placeholder="请输入祝福语内容，支持常规文字"
          />
        </el-form-item>

        <el-form-item label="适用性别" prop="match_gender">
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

        <el-form-item label="启用状态" prop="is_active">
          <el-switch v-model="formData.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存' : '添加' }}
          </el-button>
          <el-button @click="handleBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { createBlessing, updateBlessing, getBlessingDetail } from '@/api/blessings'
import type { Blessing } from '@/api/blessings'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const formRef = ref()
const submitting = ref(false)

const formData = reactive<Partial<Blessing>>({
  content: '',
  match_gender: 'all',
  match_age_min: null,
  match_age_max: null,
  is_active: true
})

const rules = {
  content: [
    { required: true, message: '请输入祝福内容', trigger: 'blur' }
  ]
}

const loadBlessingDetail = async () => {
  if (!isEdit.value) return
  try {
    const id = Number(route.params.id)
    const detail = await getBlessingDetail(id)
    Object.assign(formData, {
      content: detail.content,
      match_gender: detail.match_gender || 'all',
      match_age_min: detail.match_age_min,
      match_age_max: detail.match_age_max,
      is_active: detail.is_active
    })
  } catch (error) {
    console.error('加载祝福详情失败：', error)
    ElMessage.error('加载祝福详情失败')
    router.back()
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    submitting.value = true
    try {
      if (isEdit.value) {
        await updateBlessing(Number(route.params.id), formData as Blessing)
        ElMessage.success('修改成功')
      } else {
        await createBlessing(formData as Blessing)
        ElMessage.success('添加成功')
      }
      router.push('/blessings')
    } catch (error) {
      console.error('提交失败：', error)
      ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
    } finally {
      submitting.value = false
    }
  })
}

const handleBack = () => {
  router.back()
}

onMounted(() => {
  loadBlessingDetail()
})
</script>

<style scoped>
.blessing-edit-container {
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

.edit-form {
  margin-top: 20px;
}
</style>
