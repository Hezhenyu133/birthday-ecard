import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresGuest: true } // 未登录才能访问
  },
  {
    path: '/',
    component: () => import('@/components/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('@/views/EmployeeList.vue')
      },
      {
        path: 'employees/add',
        name: 'EmployeeAdd',
        component: () => import('@/views/EmployeeForm.vue')
      },
      {
        path: 'employees/:id/edit',
        name: 'EmployeeEdit',
        component: () => import('@/views/EmployeeForm.vue'),
        props: true
      },
      {
        path: 'employees/import',
        name: 'EmployeeImport',
        component: () => import('@/views/EmployeeImport.vue')
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/TemplateList.vue')
      },
      {
        path: 'templates/add',
        name: 'TemplateAdd',
        component: () => import('@/views/TemplateEdit.vue')
      },
      {
        path: 'templates/:id/edit',
        name: 'TemplateEdit',
        component: () => import('@/views/TemplateEdit.vue'),
        props: true
      },
      {
        path: 'blessings',
        name: 'Blessings',
        component: () => import('@/views/BlessingList.vue')
      },
      {
        path: 'blessings/add',
        name: 'BlessingAdd',
        component: () => import('@/views/BlessingEdit.vue')
      },
      {
        path: 'blessings/:id/edit',
        name: 'BlessingEdit',
        component: () => import('@/views/BlessingEdit.vue'),
        props: true
      },
      {
        path: 'records',
        name: 'SendRecords',
        component: () => import('@/views/SendRecords.vue')
      },
      {
        path: 'operation-logs',
        name: 'OperationLogs',
        component: () => import('@/views/OperationLogs.vue')
      },
      {
        path: 'system-stats',
        name: 'SystemStats',
        component: () => import('@/views/SystemStats.vue')
      }
    ]
  },
  // 404重定向
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  const token = userStore.getToken()

  // 需要登录的页面
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } 
  // 未登录状态才能访问的页面（如登录页）
  else if (to.meta.requiresGuest && token) {
    next('/')
  } 
  // 其他情况正常跳转
  else {
    next()
  }
})

export default router
