import request from './request'

export function fetchRoles(params = {}) {
  return request.get('/admin/roles', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function createRole(body) {
  return request.post('/admin/roles', body)
}

export function updateRole(id, body) {
  return request.put(`/admin/roles/${id}`, body)
}

export function deleteRole(id) {
  return request.post(`/admin/roles/${id}/delete`)
}

export function updateRolePermissions(id, permissions) {
  return request.put(`/admin/roles/${id}/permissions`, { permissions })
}

export function isBuiltinRole(name) {
  return name === 'ROLE_ADMIN' || name === 'ROLE_USER'
}
