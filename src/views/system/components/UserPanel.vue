<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  users: { type: Array, required: true },
  roles: { type: Array, required: true },
})

const emit = defineEmits(['add', 'assign', 'remove'])
const form = reactive({ account: '', name: '', roleId: 'guest' })

function submit() {
  const account = form.account.trim()
  const name = form.name.trim()
  if (!account || !name) {
    ElMessage.warning('请填写账号和姓名')
    return
  }
  if (props.users.some((item) => item.account === account)) {
    ElMessage.warning('账号已存在')
    return
  }
  emit('add', { account, name, roleId: form.roleId })
  form.account = ''
  form.name = ''
  form.roleId = 'guest'
}
</script>

<template>
  <section class="panel">
    <header>
      <h1>用户管理</h1>
      <form @submit.prevent="submit">
        <input v-model="form.account" maxlength="20" placeholder="账号" />
        <input v-model="form.name" maxlength="20" placeholder="姓名" />
        <select v-model="form.roleId">
          <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
        </select>
        <button type="submit">新增</button>
      </form>
    </header>
    <table>
      <thead>
        <tr>
          <th>账号</th>
          <th>姓名</th>
          <th>角色</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.account }}</td>
          <td>{{ user.name }}</td>
          <td>
            <select :value="user.roleId" @change="emit('assign', user.id, $event.target.value)">
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
          </td>
          <td>
            <button type="button" :disabled="user.account === users[0]?.account" @click="emit('remove', user.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="note">列表首位是当前登录账号，不能删除。</p>
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
  flex-wrap: wrap;
  gap: 8px;
}

input,
select,
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

.note {
  margin: 12px 0 0;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
