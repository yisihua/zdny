import request from './request'

/** 宿主机资源与阈值提示（管理员） */
export function fetchSystemResources() {
  return request.get('/admin/system/resources')
}
