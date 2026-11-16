import request from './request'

export function fetchUsers(params = {}) {
  return request.get('/admin/users', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function createUser(body) {
  return request.post('/admin/users', body)
}

export function setUserEnabled(id, enabled) {
  return request.patch(`/admin/users/${id}/enabled`, { enabled })
}

export function setUserRoles(id, roles) {
  return request.patch(`/admin/users/${id}/roles`, { roles })
}

export function deleteUser(id) {
  return request.post(`/admin/users/${id}/delete`)
}
