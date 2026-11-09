<script setup>
import { locale, setLocale, t } from '@/i18n'
</script>

<template>
  <div class="lang" role="group" :aria-label="t('lang.label')">
    <button type="button" :class="{ 'is-on': locale === 'zh' }" @click="setLocale('zh')">中</button>
    <button type="button" :class="{ 'is-on': locale === 'en' }" @click="setLocale('en')">EN</button>
  </div>
</template>

<style scoped>
.lang {
  display: flex;
  padding: 2px;
  border: 1px solid rgba(150, 230, 185, 0.45);
  border-radius: 999px;
  background: rgba(3, 18, 14, 0.35);
}

button {
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  color: rgba(232, 255, 242, 0.82);
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

button.is-on {
  color: #042117;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}
</style>
