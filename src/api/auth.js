import request from './request'

export function getCaptcha() {
  return request.get('/auth/captcha')
}

export function login(body) {
  return request.post('/auth/login', body)
}

export function getCurrentUser() {
  return request.get('/users/me')
}

export function forgotPassword(body) {
  return request.post('/auth/password/forgot', body)
}

export function resetPassword(body) {
  return request.post('/auth/password/reset', body)
}
