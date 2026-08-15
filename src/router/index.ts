import { createRouter, createWebHistory } from 'vue-router'

import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: ROUTE_PATHS[ROUTE_NAMES.LANDING],
      name: ROUTE_NAMES.LANDING,
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.HS_CATEGORY],
      name: ROUTE_NAMES.HS_CATEGORY,
      component: () => import('@/views/HsCategoryView.vue'),
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.HS_ITEM],
      name: ROUTE_NAMES.HS_ITEM,
      component: () => import('@/views/HsItemView.vue'),
      props: true,
    },
    {
      path: ROUTE_PATHS[ROUTE_NAMES.ANALYSIS],
      name: ROUTE_NAMES.ANALYSIS,
      component: () => import('@/views/AnalysisView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: { name: ROUTE_NAMES.LANDING } },
  ],
})

export default router
