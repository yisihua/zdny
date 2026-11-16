/** 前端维护的权限目录；后端无独立目录接口，未知码保存时会自动登记。 */
export const permissionCatalog = [
  {
    id: 'session',
    nameKey: 'perm.group.session',
    items: [{ code: 'session:use', nameKey: 'perm.session.use', tipKey: 'perm.session.useTip' }],
  },
  {
    id: 'file',
    nameKey: 'perm.group.file',
    items: [{ code: 'file:use', nameKey: 'perm.file.use', tipKey: 'perm.file.useTip' }],
  },
  {
    id: 'user',
    nameKey: 'perm.group.user',
    items: [
      { code: 'user:read', nameKey: 'perm.user.read', tipKey: 'perm.user.readTip' },
      { code: 'user:write', nameKey: 'perm.user.write', tipKey: 'perm.user.writeTip' },
    ],
  },
  {
    id: 'role',
    nameKey: 'perm.group.role',
    items: [
      { code: 'role:read', nameKey: 'perm.role.read', tipKey: 'perm.role.readTip' },
      { code: 'role:write', nameKey: 'perm.role.write', tipKey: 'perm.role.writeTip' },
    ],
  },
  {
    id: 'breeding',
    nameKey: 'perm.group.breeding',
    items: [
      { code: 'breeding.data.view', nameKey: 'perm.breeding.dataView', tipKey: 'perm.breeding.dataViewTip' },
      { code: 'breeding.task.create', nameKey: 'perm.breeding.taskCreate', tipKey: 'perm.breeding.taskCreateTip' },
    ],
  },
]

export const catalogCodes = permissionCatalog.flatMap((group) => group.items.map((item) => item.code))

export const MAX_ROLE_PERMISSIONS = 64
