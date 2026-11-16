import request from './request'

export function fetchSessions(params = {}) {
  return request.get('/sessions', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function createSession(body) {
  return request.post('/sessions', body)
}

export function renameSession(id, title) {
  return request.post(`/sessions/${id}/rename`, { title })
}

export function deleteSession(id) {
  return request.post(`/sessions/${id}/delete`)
}

export function fetchSessionMessages(id, params = {}) {
  return request.get(`/sessions/${id}/messages`, {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
    },
  })
}

export function createSessionMessage(id, body) {
  return request.post(`/sessions/${id}/messages`, body)
}

export function updateSessionMessage(sessionId, body) {
  return request.post(`/sessions/${sessionId}/messages/update`, body)
}

export const MESSAGE_TYPE_USER = 1
export const MESSAGE_TYPE_SYSTEM = 2
