# 浙大农业

基于 Vue 3、Vite、Element Plus、Axios 的前端项目（JavaScript）。

## 启动

```bash
npm install
npm run dev
```

## 目录

- `src/api/request.js`：Axios 实例与拦截器
- `src/router`：路由
- `src/layouts`：后台布局
- `src/views`：页面

开发环境的 `VITE_API_BASE_URL` 为 `/api`，列表数据由 Vite 本地模拟接口返回，示例数据在 `src/mock/posts.js`。接入真实后端时，在 `vite.config.js` 中启用 `/api` 代理即可。
