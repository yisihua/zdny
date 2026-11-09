<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { locale, t } from '@/i18n'

const route = useRoute()
const epLocale = computed(() => (locale.value === 'en' ? en : zhCn))

watch(
  [locale, () => route.meta.titleKey],
  () => {
    const page = route.meta.titleKey ? t(route.meta.titleKey) : ''
    document.title = page ? `${page} - ${t('app.name')}` : t('app.name')
  },
  { immediate: true },
)
</script>

<template>
  <el-config-provider :locale="epLocale">
    <router-view />
  </el-config-provider>
</template>
