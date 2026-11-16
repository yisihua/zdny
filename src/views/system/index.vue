<script setup>
import { ref } from 'vue'
import SystemNav from './components/SystemNav.vue'
import RolePanel from './components/RolePanel.vue'
import UserPanel from './components/UserPanel.vue'
import TeamPanel from './components/TeamPanel.vue'
import ProjectPanel from './components/ProjectPanel.vue'
import PermissionPanel from './components/PermissionPanel.vue'
import ServicePanel from './components/ServicePanel.vue'
import LogPanel from './components/LogPanel.vue'
import { createServices } from './data.js'

const active = ref('role')
const services = ref(createServices())

function addService(name) {
  services.value.push({
    id: `svc-${Date.now()}`,
    name,
    code: `custom_${services.value.length + 1}`,
    endpoint: 'svc://custom',
    version: '0.1.0',
    running: false,
    builtin: false,
  })
}

function toggleService(id) {
  const item = services.value.find((service) => service.id === id)
  if (!item) return
  item.running = !item.running
}

function removeService(id) {
  services.value = services.value.filter((service) => service.id !== id)
}
</script>

<template>
  <div class="system">
    <SystemNav :active="active" @change="active = $event" />
    <RolePanel v-if="active === 'role'" />
    <UserPanel v-else-if="active === 'user'" />
    <TeamPanel v-else-if="active === 'team'" />
    <ProjectPanel v-else-if="active === 'project'" />
    <PermissionPanel v-else-if="active === 'permission'" />
    <ServicePanel
      v-else-if="active === 'service'"
      :services="services"
      @add="addService"
      @toggle="toggleService"
      @remove="removeService"
    />
    <LogPanel v-else-if="active === 'log'" />
  </div>
</template>

<style scoped>
.system {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  height: calc(100vh - 104px);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid rgba(140, 220, 175, 0.2);
  border-radius: 16px;
  background: rgba(4, 20, 15, 0.72);
}

@media (max-width: 800px) {
  .system {
    grid-template-columns: 1fr;
    height: auto;
  }
}
</style>
