import request from './request'

export function fetchProjects(params = {}) {
  return request.get('/projects', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function fetchProject(id) {
  return request.get(`/projects/${id}`)
}

export function createProject(body) {
  return request.post('/projects', body)
}

export function updateProject(id, body) {
  return request.put(`/projects/${id}`, body)
}

export function updateProjectSharing(id, body) {
  return request.patch(`/projects/${id}/sharing`, body)
}

export function fetchProjectMembers(id, params = {}) {
  return request.get(`/projects/${id}/members`, {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function addProjectMember(id, userId) {
  return request.post(`/projects/${id}/members`, { userId: String(userId) })
}

export function removeProjectMember(id, userId) {
  return request.delete(`/projects/${id}/members/${userId}`)
}
