<script setup>
import { ref } from 'vue'
import SystemNav from './components/SystemNav.vue'
import RolePanel from './components/RolePanel.vue'
import UserPanel from './components/UserPanel.vue'
import PermissionPanel from './components/PermissionPanel.vue'
import ServicePanel from './components/ServicePanel.vue'
import LogPanel from './components/LogPanel.vue'
import { createGrants, createLogs, createRoles, createServices, createUsers } from './data.js'

const account = localStorage.getItem('username') || 'admin'
const active = ref('role')
const roles = ref(createRoles())
const users = ref(createUsers(account))
const grants = ref(createGrants())
const services = ref(createServices())
const logs = ref(createLogs(account))

function pushLog(moduleKey, actionKey, params = {}, resultKey = 'log.ok') {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  logs.value.unshift({
    id: Date.now(),
    time: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    account,
    moduleKey,
    actionKey,
    params,
    resultKey,
  })
}

function roleParams(role) {
  return role?.nameKey ? { roleKey: role.nameKey } : { role: role?.name || '' }
}

function nameParams(item) {
  return item?.nameKey ? { nameKey: item.nameKey } : { name: item?.name || '' }
}

function addRole(name) {
  const id = `role-${Date.now()}`
  roles.value.push({
    id,
    name,
    code: `custom_${roles.value.length + 1}`,
    remarkKey: 'role.custom',
    builtin: false,
  })
  grants.value[id] = { agent: ['view'], data: ['view'], system: [] }
  pushLog('system.role', 'log.addRole', { name })
}

function addUser(payload) {
  users.value.push({ id: Date.now(), ...payload })
  pushLog('system.user', 'log.addUser', { account: payload.account })
}

function assignUser(id, roleId) {
  const user = users.value.find((item) => item.id === id)
  if (!user) return
  user.roleId = roleId
  const role = roles.value.find((item) => item.id === roleId)
  pushLog('system.user', 'log.assignUser', { account: user.account, ...roleParams(role) })
}

function removeRole(id) {
  const role = roles.value.find((item) => item.id === id)
  roles.value = roles.value.filter((item) => item.id !== id)
  delete grants.value[id]
  pushLog('system.role', 'log.removeRole', role?.nameKey ? { nameKey: role.nameKey } : { name: role?.name || id })
}

function removeUser(id) {
  const user = users.value.find((item) => item.id === id)
  users.value = users.value.filter((item) => item.id !== id)
  pushLog('system.user', 'log.removeUser', { account: user?.account || id })
}

function toggleGrant(roleId, moduleId, actionId, checked) {
  if (roleId === 'super') return
  const grant = grants.value[roleId]
  if (!grant) return
  const current = grant[moduleId] || []
  grant[moduleId] = checked ? [...current, actionId] : current.filter((item) => item !== actionId)
  const role = roles.value.find((item) => item.id === roleId)
  pushLog('system.permission', checked ? 'log.grant' : 'log.revoke', {
    ...roleParams(role),
    actionKey: `perm.${actionId}`,
  })
}

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
  pushLog('system.service', 'log.addService', { name })
}

function toggleService(id) {
  const item = services.value.find((service) => service.id === id)
  if (!item) return
  item.running = !item.running
  pushLog('system.service', 'log.toggleService', {
    verbKey: item.running ? 'log.start' : 'log.stop',
    ...nameParams(item),
  })
}

function removeService(id) {
  const item = services.value.find((service) => service.id === id)
  services.value = services.value.filter((service) => service.id !== id)
  pushLog('system.service', 'log.removeService', nameParams(item))
}
</script>

<template>
  <div class="system">
    <SystemNav :active="active" @change="active = $event" />
    <RolePanel
      v-if="active === 'role'"
      :roles="roles"
      :users="users"
      @add="addRole"
      @remove="removeRole"
    />
    <UserPanel
      v-else-if="active === 'user'"
      :users="users"
      :roles="roles"
      @add="addUser"
      @assign="assignUser"
      @remove="removeUser"
    />
    <PermissionPanel
      v-else-if="active === 'permission'"
      :roles="roles"
      :grants="grants"
      @toggle="toggleGrant"
    />
    <ServicePanel
      v-else-if="active === 'service'"
      :services="services"
      @add="addService"
      @toggle="toggleService"
      @remove="removeService"
    />
    <LogPanel v-else-if="active === 'log'" :logs="logs" />
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
