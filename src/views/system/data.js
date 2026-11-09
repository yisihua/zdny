export function createRoles() {
  return [
    { id: 'super', nameKey: 'role.super', code: 'super_admin', remarkKey: 'role.superRemark', builtin: true },
    { id: 'guest', nameKey: 'role.guest', code: 'guest', remarkKey: 'role.guestRemark', builtin: true },
  ]
}

export function createUsers(account = 'admin') {
  return [
    { id: 1, account, name: account, roleId: 'super' },
    { id: 2, account: 'guest', nameKey: 'role.guest', roleId: 'guest' },
  ]
}

export const permissionModules = [
  { id: 'agent', nameKey: 'nav.agent' },
  { id: 'data', nameKey: 'nav.data' },
  { id: 'system', nameKey: 'nav.system' },
]

export const permissionActions = [
  { id: 'view', nameKey: 'perm.view' },
  { id: 'edit', nameKey: 'perm.edit' },
  { id: 'manage', nameKey: 'perm.manage' },
]

const allActions = permissionActions.map((item) => item.id)

export function createGrants() {
  return {
    super: {
      agent: [...allActions],
      data: [...allActions],
      system: [...allActions],
    },
    guest: {
      agent: ['view'],
      data: ['view'],
      system: [],
    },
  }
}

export function createServices() {
  return [
    { id: 'pheno', nameKey: 'service.pheno', code: 'pheno-extract', endpoint: 'svc://pheno', version: '1.3.0', running: true, builtin: true },
    { id: 'sim', nameKey: 'service.sim', code: 'material-sim', endpoint: 'svc://similarity', version: '1.1.2', running: true, builtin: true },
    { id: 'resist', nameKey: 'service.resist', code: 'resist-predict', endpoint: 'svc://resistance', version: '0.9.4', running: false, builtin: true },
    { id: 'gs', nameKey: 'service.gs', code: 'genomic-select', endpoint: 'svc://genomic', version: '2.0.1', running: true, builtin: true },
  ]
}

export function createLogs(account = 'admin') {
  return [
    { id: 1, time: '2026-05-09 09:12:08', account, moduleKey: 'log.moduleLogin', actionKey: 'log.login', resultKey: 'log.ok' },
    { id: 2, time: '2026-05-09 09:18:21', account, moduleKey: 'nav.data', actionKey: 'log.viewPublic', resultKey: 'log.ok' },
    { id: 3, time: '2026-05-08 16:42:03', account: 'guest', moduleKey: 'nav.agent', actionKey: 'log.newSession', resultKey: 'log.ok' },
    { id: 4, time: '2026-05-08 11:05:47', account, moduleKey: 'nav.system', actionKey: 'log.viewRoles', resultKey: 'log.ok' },
    { id: 5, time: '2026-05-07 19:26:15', account: 'guest', moduleKey: 'nav.data', actionKey: 'log.upload', resultKey: 'log.deny' },
    { id: 6, time: '2026-05-07 14:08:52', account, moduleKey: 'system.permission', actionKey: 'log.viewPerm', resultKey: 'log.ok' },
  ]
}
