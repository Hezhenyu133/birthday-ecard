<template>
  <div class="employee-form-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">{{ isEdit ? '编辑人员' : '添加人员' }}</span>
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
        label-width="100px"
        v-loading="loading"
        class="form-content"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="formData.name" placeholder="请输入员工姓名" />
        </el-form-item>

        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="formData.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="生日" prop="birthday">
          <el-date-picker
            v-model="formData.birthday"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="手机号" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入手机号" maxlength="11" />
        </el-form-item>

        <el-form-item label="部门" prop="department_id">
          <el-tree-select
            v-model="formData.department_id"
            :data="deptTreeOptions"
            :props="{ label: 'name', children: 'children', value: 'id' }"
            placeholder="选择部门（可选）"
            clearable
            check-strictly
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="职级" prop="level">
          <el-select v-model="formData.level" placeholder="选择职级" clearable style="width: 100%">
            <el-option label="管理层" value="management" />
            <el-option label="经理" value="manager" />
            <el-option label="员工" value="employee" />
          </el-select>
        </el-form-item>

        <el-form-item label="职位" prop="position">
          <el-input v-model="formData.position" placeholder="请输入职位" />
        </el-form-item>

        <el-form-item label="默认模板" prop="default_template_id">
          <el-select
            v-model="formData.default_template_id"
            placeholder="选择默认贺卡模板（可选）"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="template in templates"
              :key="template.id"
              :label="template.name"
              :value="template.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存修改' : '提交' }}
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createEmployee, updateEmployee, getEmployeeDetail } from '@/api/employees'
import { getTemplateList } from '@/api/templates'
import { getDepartmentTree, type Department } from '@/api/departments'
import type { Employee } from '@/api/employees'
import type { Template } from '@/api/templates'

const route = useRoute()
const router = useRouter()

// 是否为编辑模式
const isEdit = computed(() => !!route.params.id)

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = reactive<Partial<Employee>>({
  name: '',
  gender: 'male',
  birthday: '',
  phone: '',
  department: '',
  department_id: null,
  level: 'employee',
  position: '',
  default_template_id: null
})

// 部门树数据
const deptTreeOptions = ref<Department[]>([])

// 加载部门树
const loadDeptTree = async () => {
  try {
    deptTreeOptions.value = await getDepartmentTree()
  } catch {
    // 部门树加载失败不影响主功能
  }
}

// 表单验证规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入员工姓名', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  gender: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ],
  birthday: [
    { required: true, message: '请选择生日', trigger: 'change' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
})

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 模板列表
const templates = ref<Template[]>([])

// 加载模板列表
const loadTemplates = async () => {
  try {
    templates.value = await getTemplateList()
  } catch (error) {
    console.error('加载模板列表失败：', error)
  }
}

// 加载员工详情（编辑模式）
const loadEmployeeDetail = async () => {
  if (!isEdit.value) return
  
  loading.value = true
  try {
    const id = Number(route.params.id)
    const detail = await getEmployeeDetail(id)
    
    Object.assign(formData, {
      name: detail.name,
      gender: detail.gender,
      birthday: detail.birthday,
      phone: detail.phone,
      department: detail.department || '',
      department_id: detail.department_id || null,
      level: detail.level || 'employee',
      position: detail.position || '',
      default_template_id: detail.default_template_id
    })
  } catch (error) {
    console.error('加载员工详情失败：', error)
    ElMessage.error('加载员工详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      if (isEdit.value) {
        await updateEmployee(Number(route.params.id), formData as Employee)
        ElMessage.success('修改成功')
      } else {
        await createEmployee(formData as Employee)
        ElMessage.success('添加成功')
      }
      
      router.push('/employees')
    } catch (error) {
      console.error('提交失败：', error)
      ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
    } finally {
      submitting.value = false
    }
  })
}

// 返回
const handleBack = () => {
  router.back()
}

// 页面加载时获取数据
onMounted(() => {
  loadTemplates()
  loadDeptTree()
  loadEmployeeDetail()
})
</script>

<style scoped>
.employee-form-container {
  max-width: 800px;
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

.form-content {
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .employee-form-container {
    padding: 0;
  }

  .el-form {
    padding: 0 12px;
  }

  .el-form-item__label {
    width: 80px !important;
  }
}
</style>