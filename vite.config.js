import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import posts from './src/mock/posts.js'

function mockApi() {
  const handle = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (req.method === 'GET' && path === '/api/posts') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(posts))
      return
    }
    next()
  }

  return {
    name: 'local-mock-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

function stripOrigin(proxy) {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.removeHeader('origin')
  })
}

/** SSE 代理：关闭缓冲，避免流式响应被攒齐后才下发 */
function configureLlmProxy(proxy) {
  stripOrigin(proxy)
  proxy.on('proxyReq', (proxyReq, req) => {
    if (String(req.url || '').includes('/agent-runs')) {
      console.log('[vite-proxy] →', req.method, req.url)
      proxyReq.setHeader('Accept', 'text/event-stream')
      proxyReq.setHeader('Cache-Control', 'no-cache')
      proxyReq.setHeader('Connection', 'keep-alive')
    }
  })
  proxy.on('proxyRes', (proxyRes, req, res) => {
    const ct = String(proxyRes.headers['content-type'] || '')
    if (String(req.url || '').includes('/agent-runs') || ct.includes('text/event-stream')) {
      console.log('[vite-proxy] ←', req.method, req.url, proxyRes.statusCode, ct)
      // 避免中间层缓冲 SSE
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('X-Accel-Buffering', 'no')
      res.setHeader('Connection', 'keep-alive')
      if (typeof res.flushHeaders === 'function') res.flushHeaders()
    }
  })
  proxy.on('error', (err, req) => {
    console.error('[vite-proxy] error', req?.url, err?.message || err)
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET
  const geoserverTarget = env.VITE_GEOSERVER_TARGET

  const proxy = {}
  if (apiTarget) {
    proxy['/api'] = {
      target: apiTarget,
      changeOrigin: true,
      secure: false,
      configure: stripOrigin,
    }
  }
  // /v1 暂改直连：浏览器请求 VITE_LLM_API_BASE（绝对地址），不走下方代理。
  // const llmTarget = env.VITE_LLM_API_TARGET
  // if (llmTarget) {
  //   proxy['/v1'] = {
  //     target: llmTarget,
  //     changeOrigin: true,
  //     secure: false,
  //     timeout: 0,
  //     proxyTimeout: 0,
  //     configure: configureLlmProxy,
  //   }
  // }
  // /geoserver → http://10.202.210.30:8090/geoserver
  if (geoserverTarget) {
    proxy['/geoserver'] = {
      target: geoserverTarget,
      changeOrigin: true,
      secure: false,
      configure: stripOrigin,
    }
  }

  return {
    plugins: [vue(), basicSsl(), mockApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      https: true,
      port: 5173,
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
    preview: {
      https: true,
      port: 4173,
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  }
})
