import request from './request'

export function fetchTeams(params = {}) {
  return request.get('/teams', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function fetchTeam(id) {
  return request.get(`/teams/${id}`)
}

export function createTeam(body) {
  return request.post('/teams', body)
}

export function fetchTeamMembers(id, params = {}) {
  return request.get(`/teams/${id}/members`, {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function addTeamMember(id, userId) {
  return request.post(`/teams/${id}/members`, { userId: String(userId) })
}

export function removeTeamMember(id, userId) {
  return request.delete(`/teams/${id}/members/${userId}`)
}
