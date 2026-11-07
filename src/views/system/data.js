export function createRoles() {
  return [
    { id: 'super', name: '超级管理员', code: 'super_admin', remark: '可管理全部模块', builtin: true },
    { id: 'guest', name: '游客', code: 'guest', remark: '仅可浏览公开内容', builtin: true },
  ]
}

export function createUsers(account = 'admin') {
  return [
    { id: 1, account, name: account, roleId: 'super' },
    { id: 2, account: 'guest', name: '游客', roleId: 'guest' },
  ]
}
