import request from './request'

export function fetchOperationLogs(params = {}) {
  const query = {
    page: params.page || 1,
    pageSize: params.pageSize || 10,
  }
  if (params.actorId) query.actorId = String(params.actorId)
  if (params.start) query.start = params.start
  if (params.end) query.end = params.end

  return request.get('/admin/audit/operations', { params: query })
}
