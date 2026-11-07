<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  roles: { type: Array, required: true },
  users: { type: Array, required: true },
})

const emit = defineEmits(['add', 'remove'])
const name = ref('')

function submit() {
  const text = name.value.trim()
  if (!text) {
    ElMessage.warning('请输入角色名称')
    return
  }
  if (props.roles.some((item) => item.name === text)) {
    ElMessage.warning('角色已存在')
    return
  }
  emit('add', text)
  name.value = ''
}

function remove(role) {
  if (role.builtin) {
    ElMessage.warning('内置角色不能删除')
    return
  }
  if (props.users.some((item) => item.roleId === role.id)) {
    ElMessage.warning('该角色下仍有用户')
    return
  }
  emit('remove', role.id)
}
</script>

<template>
  <section class="panel">
    <header>
      <h1>角色管理</h1>
      <form @submit.prevent="submit">
        <input v-model="name" maxlength="20" placeholder="新增角色名称" />
        <button type="submit">新增</button>
      </form>
    </header>
    <table>
      <thead>
        <tr>
          <th>角色</th>
          <th>编码</th>
          <th>说明</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="role in roles" :key="role.id">
          <td>{{ role.name }}<em v-if="role.builtin">内置</em></td>
          <td>{{ role.code }}</td>
          <td>{{ role.remark }}</td>
          <td><button type="button" :disabled="role.builtin" @click="remove(role)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  padding: 18px 20px;
}

header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

h1 {
  margin: 0;
  font-size: 20px;
}

form {
  display: flex;
  gap: 8px;
}

input,
button {
  height: 36px;
  border: 1px solid rgba(140, 220, 175, 0.32);
  border-radius: 8px;
  color: #f3fff8;
  background: rgba(3, 18, 14, 0.55);
  font: inherit;
}

form button,
td button {
  padding: 0 14px;
  cursor: pointer;
}

form button {
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
  font-weight: 700;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.14);
  text-align: left;
}

th {
  color: rgba(214, 245, 228, 0.72);
  font-weight: 600;
}

em {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 999px;
  color: #8dffc8;
  background: rgba(60, 200, 140, 0.16);
  font-size: 12px;
  font-style: normal;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
