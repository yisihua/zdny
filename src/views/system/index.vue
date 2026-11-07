<script setup>
import { ref } from 'vue'
import SystemNav from './components/SystemNav.vue'
import RolePanel from './components/RolePanel.vue'
import UserPanel from './components/UserPanel.vue'
import { createRoles, createUsers } from './data.js'

const active = ref('role')
const roles = ref(createRoles())
const users = ref(createUsers(localStorage.getItem('username') || 'admin'))

function addRole(name) {
  roles.value.push({
    id: `role-${Date.now()}`,
    name,
    code: `custom_${roles.value.length + 1}`,
    remark: '自定义角色',
    builtin: false,
  })
}

function addUser(payload) {
  users.value.push({ id: Date.now(), ...payload })
}

function assignUser(id, roleId) {
  const user = users.value.find((item) => item.id === id)
  if (user) user.roleId = roleId
}

function removeRole(id) {
  roles.value = roles.value.filter((item) => item.id !== id)
}

function removeUser(id) {
  users.value = users.value.filter((item) => item.id !== id)
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
      v-else
      :users="users"
      :roles="roles"
      @add="addUser"
      @assign="assignUser"
      @remove="removeUser"
    />
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
