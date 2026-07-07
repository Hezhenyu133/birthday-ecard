<template>
  <div class="template-carousel">
    <div class="carousel-header" v-if="showTitle">
      <h3 class="carousel-title">贺卡模板预览</h3>
      <span class="carousel-subtitle">共 {{ templates.length }} 个模板</span>
    </div>

    <swiper
      :modules="swiperModules"
      :slides-per-view="slidesPerView"
      :space-between="20"
      :loop="templates.length > 3"
      :autoplay="templates.length > 3 ? { delay: 4000, disableOnInteraction: false } : false"
      :pagination="{ clickable: true }"
      :navigation="templates.length > 3"
      class="carousel-swiper"
    >
      <swiper-slide v-for="template in templates" :key="template.id" class="carousel-slide">
        <div class="slide-card" @click="$emit('select', template)">
          <!-- 预览图或占位 -->
          <div class="slide-preview" :style="getPreviewStyle(template)">
            <div v-if="!template.preview_image" class="preview-placeholder">
              <el-icon :size="36"><Picture /></el-icon>
              <span>{{ template.name }}</span>
            </div>
          </div>
          <!-- 模板信息 -->
          <div class="slide-info">
            <div class="slide-name">{{ template.name }}</div>
            <div class="slide-desc">{{ template.description || '暂无描述' }}</div>
            <div class="slide-tags">
              <span class="tag">{{ getGenderText(template.match_gender) }}</span>
              <span v-if="template.employee_level" class="tag level">
                {{ getLevelText(template.employee_level) }}
              </span>
            </div>
          </div>
        </div>
      </swiper-slide>
    </swiper>

    <el-empty v-if="templates.length === 0 && !loading" description="暂无模板" :image-size="80" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'
import type { Template } from '@/api/templates'

const swiperModules = [Autoplay, Pagination, Navigation]

const props = withDefaults(defineProps<{
  templates: Template[]
  loading?: boolean
  showTitle?: boolean
}>(), {
  loading: false,
  showTitle: true
})

defineEmits<{
  select: [template: Template]
}>()

const slidesPerView = computed(() => {
  if (typeof window === 'undefined') return 3
  if (window.innerWidth < 640) return 1
  if (window.innerWidth < 1024) return 2
  return 3
})

const getGenderText = (gender?: string) => {
  const map: Record<string, string> = { male: '男性', female: '女性', all: '不限' }
  return map[gender || 'all'] || '不限'
}

const getLevelText = (level?: string) => {
  const map: Record<string, string> = {
    management: '管理层',
    manager: '三级经理',
    employee: '普通员工',
    all: '不限'
  }
  return map[level || 'all'] || ''
}

const getPreviewStyle = (template: Template) => {
  if (template.preview_image) {
    return { backgroundImage: `url(${template.preview_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  // 根据模板类型生成不同渐变色
  const gradients: Record<string, string> = {
    official: 'linear-gradient(135deg, #0085CC 0%, #1B83C6 100%)',
    festive: 'linear-gradient(135deg, #E6A23C 0%, #F56C6C 100%)',
    elegant: 'linear-gradient(135deg, #95C11F 0%, #67C23A 100%)',
    modern: 'linear-gradient(135deg, #1B83C6 0%, #95C11F 100%)'
  }
  return { background: gradients[template.template_type || ''] || 'linear-gradient(135deg, #0085CC 0%, #1B83C6 100%)' }
}
</script>

<style scoped>
.template-carousel {
  width: 100%;
}

.carousel-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.carousel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.carousel-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.carousel-swiper {
  padding-bottom: 36px;
}

.slide-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.slide-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.slide-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}

.slide-info {
  padding: 12px 14px;
}

.slide-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slide-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

.slide-tags {
  display: flex;
  gap: 6px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
  color: var(--primary-color);
}

.tag.level {
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: #6d8c17;
}

/* Swiper 分页样式覆盖 */
.carousel-swiper :deep(.swiper-pagination-bullet) {
  background: var(--primary-color);
}

.carousel-swiper :deep(.swiper-pagination-bullet-active) {
  background: var(--primary-color);
}

.carousel-swiper :deep(.swiper-button-next),
.carousel-swiper :deep(.swiper-button-prev) {
  color: var(--primary-color);
  transform: scale(0.7);
}

/* 移动端 */
@media (max-width: 768px) {
  .slide-preview {
    height: 130px;
  }
}
</style>
