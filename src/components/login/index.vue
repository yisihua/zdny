<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Lock, RefreshRight, User } from '@element-plus/icons-vue'
import LangSwitch from '@/components/LangSwitch.vue'
import { forgotPassword, getCaptcha, getCurrentUser, login, resetPassword } from '@/api/auth'
import { locale, t } from '@/i18n'
import { sanitizeRedirect } from '@/router/redirect'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const forgotFormRef = ref()
const resetFormRef = ref()
const docVisible = ref(false)
const docKey = ref('')
const forgotVisible = ref(false)
const forgotStep = ref('verify')
const submitting = ref(false)
const captchaLoading = ref(false)
const forgotCaptchaLoading = ref(false)
const resetToken = ref('')
const serverCaptcha = reactive({
  id: '',
  image: '',
})
const forgotCaptcha = reactive({
  id: '',
  image: '',
})

const forgotForm = reactive({
  username: '',
  captchaAnswer: '',
})

const resetForm = reactive({
  securityQuestion: '',
  securityAnswer: '',
  newPassword: '',
  confirmPassword: '',
})

const motes = [
  { left: '6%', size: '2px', delay: '0s', duration: '13s' },
  { left: '14%', size: '3px', delay: '2.4s', duration: '16s' },
  { left: '23%', size: '2px', delay: '5s', duration: '12s' },
  { left: '31%', size: '2px', delay: '1.2s', duration: '18s' },
  { left: '42%', size: '3px', delay: '7s', duration: '15s' },
  { left: '51%', size: '2px', delay: '3.6s', duration: '14s' },
  { left: '63%', size: '2px', delay: '8.2s', duration: '17s' },
  { left: '71%', size: '3px', delay: '0.8s', duration: '13s' },
  { left: '79%', size: '2px', delay: '4.5s', duration: '16s' },
  { left: '88%', size: '2px', delay: '6.1s', duration: '12s' },
  { left: '94%', size: '3px', delay: '9s', duration: '15s' },
  { left: '37%', size: '2px', delay: '10s', duration: '19s' },
]

const form = reactive({
  username: localStorage.getItem('username') || '',
  password: '',
  captcha: '',
  agreed: false,
})

const rules = computed(() => ({
  username: [{ required: true, message: t('login.userRequired'), trigger: 'blur' }],
  password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
  captcha: [{ required: true, message: t('login.captchaRequired'), trigger: 'blur' }],
}))

const forgotRules = computed(() => ({
  username: [{ required: true, message: t('login.userRequired'), trigger: 'blur' }],
  captchaAnswer: [{ required: true, message: t('login.captchaRequired'), trigger: 'blur' }],
}))

const resetRules = computed(() => ({
  securityAnswer: [
    { required: true, message: t('login.securityAnswerRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (String(value || '').trim().length > 128) {
          callback(new Error(t('login.fieldLong')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  newPassword: [
    { required: true, message: t('login.passwordRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const password = String(value || '')
        if (password.length < 8 || password.length > 72 || new TextEncoder().encode(password).length > 72) {
          callback(new Error(t('login.passwordRule')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: t('login.passwordConfirm'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== resetForm.newPassword) {
          callback(new Error(t('login.passwordMismatch')))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

const forgotDialogTitle = computed(() =>
  forgotStep.value === 'reset' ? t('login.resetTitle') : t('login.forgotTitle'),
)

function captchaSrc(imageBase64) {
  if (!imageBase64) return ''
  if (String(imageBase64).startsWith('data:')) return imageBase64
  return `data:image/png;base64,${imageBase64}`
}

async function loadCaptcha() {
  if (captchaLoading.value) return
  captchaLoading.value = true
  try {
    const data = await getCaptcha()
    serverCaptcha.id = data?.captchaId ? String(data.captchaId) : ''
    serverCaptcha.image = captchaSrc(data?.imageBase64)
    form.captcha = ''
  } catch {
    serverCaptcha.id = ''
    serverCaptcha.image = ''
  } finally {
    captchaLoading.value = false
  }
}

async function loadForgotCaptcha() {
  if (forgotCaptchaLoading.value) return
  forgotCaptchaLoading.value = true
  try {
    const data = await getCaptcha()
    forgotCaptcha.id = data?.captchaId ? String(data.captchaId) : ''
    forgotCaptcha.image = captchaSrc(data?.imageBase64)
    forgotForm.captchaAnswer = ''
  } catch {
    forgotCaptcha.id = ''
    forgotCaptcha.image = ''
  } finally {
    forgotCaptchaLoading.value = false
  }
}

async function onSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid || submitting.value) return
  if (!form.agreed) {
    ElMessage.warning(t('login.agreeRequired'))
    return
  }
  if (!serverCaptcha.id) {
    ElMessage.warning(t('login.captchaRequired'))
    await loadCaptcha()
    return
  }

  submitting.value = true
  try {
    const data = await login({
      username: form.username.trim(),
      password: form.password,
      captchaId: serverCaptcha.id,
      captchaAnswer: form.captcha.trim(),
    })
    const username = data?.username ? String(data.username) : form.username.trim()
    localStorage.setItem('token', data?.token ? String(data.token) : '')
    localStorage.setItem('username', username)
    if (data?.userId != null) localStorage.setItem('userId', String(data.userId))
    if (data?.expiresAt) localStorage.setItem('expiresAt', String(data.expiresAt))

    try {
      const me = await getCurrentUser()
      if (me) localStorage.setItem('user', JSON.stringify(me))
    } catch {
      // Token 已保存；资料拉取失败不阻断进入系统
    }

    ElMessage.success(t('login.ok'))
    const redirect = sanitizeRedirect(
      typeof route.query.redirect === 'string' ? route.query.redirect : '',
    )
    router.replace(redirect || '/agent')

  } catch {
    await loadCaptcha()
  } finally {
    submitting.value = false
  }
}

async function openForgot() {
  forgotStep.value = 'verify'
  resetToken.value = ''
  forgotForm.username = form.username.trim()
  forgotForm.captchaAnswer = ''
  resetForm.securityQuestion = ''
  resetForm.securityAnswer = ''
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
  forgotVisible.value = true
  await loadForgotCaptcha()
}

function closeForgot() {
  forgotVisible.value = false
  forgotStep.value = 'verify'
  resetToken.value = ''
  forgotFormRef.value?.resetFields?.()
  resetFormRef.value?.resetFields?.()
}

async function submitForgot() {
  const valid = await forgotFormRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return
  if (!forgotCaptcha.id) {
    ElMessage.warning(t('login.captchaRequired'))
    await loadForgotCaptcha()
    return
  }

  submitting.value = true
  try {
    const data = await forgotPassword({
      username: forgotForm.username.trim(),
      captchaId: forgotCaptcha.id,
      captchaAnswer: forgotForm.captchaAnswer.trim(),
    })
    resetToken.value = data?.token ? String(data.token) : ''
    resetForm.securityQuestion = data?.securityQuestion || ''
    resetForm.securityAnswer = ''
    resetForm.newPassword = ''
    resetForm.confirmPassword = ''
    forgotStep.value = 'reset'
  } catch {
    await loadForgotCaptcha()
  } finally {
    submitting.value = false
  }
}

async function submitReset() {
  const valid = await resetFormRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return
  if (!resetToken.value) {
    ElMessage.warning(t('login.forgotHint'))
    forgotStep.value = 'verify'
    await loadForgotCaptcha()
    return
  }

  submitting.value = true
  try {
    await resetPassword({
      token: resetToken.value,
      securityAnswer: resetForm.securityAnswer.trim(),
      newPassword: resetForm.newPassword,
    })
    form.username = forgotForm.username.trim()
    ElMessage.success(t('login.resetOk'))
    closeForgot()
    await loadCaptcha()
  } catch {
    // 凭证可能仍有效；锁定或失效时由接口提示
  } finally {
    submitting.value = false
  }
}

function onRegister() {
  ElMessage.info(t('login.registerTip'))
}

function openDoc(key) {
  docKey.value = key
  docVisible.value = true
}

loadCaptcha()
</script>

<template>
  <div class="login-page">
    <div class="veil"></div>
    <div class="aurora" aria-hidden="true"></div>
    <div class="grid" aria-hidden="true"></div>
    <span
      v-for="(mote, index) in motes"
      :key="index"
      class="mote"
      :style="{
        left: mote.left,
        width: mote.size,
        height: mote.size,
        animationDelay: mote.delay,
        animationDuration: mote.duration,
      }"
      aria-hidden="true"
    ></span>

    <div class="lang-slot">
      <LangSwitch />
    </div>

    <header class="brand">
      <span class="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#1faf62" />
          <path d="M16 24.5V13.5" stroke="#f3fff8" stroke-width="1.7" stroke-linecap="round" />
          <path d="M16 18.2c-4.2-.8-6.4-3.8-6.8-7.4 3.2.2 5.4 2.1 6.8 5.4" fill="#e7ffef" />
          <path d="M16 16.4c3.4-.5 5.8-2.8 6.4-6.6-3 .4-5 2.2-6.4 4.8" fill="#bdf6d4" />
        </svg>
      </span>
      <span class="brand-text">
        <strong>{{ t('app.name') }}</strong>
        <em>{{ locale === 'zh' ? 'Breeding Material Screening Agent' : '育种材料筛选智能体平台' }}</em>
      </span>
    </header>

    <div class="stage">
      <section class="panel">
        <h1>{{ t('login.welcome') }}</h1>
        <p class="subtitle">{{ t('app.name') }}</p>

        <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="onSubmit">
          <el-form-item prop="username">
            <el-input v-model="form.username" :placeholder="t('login.user')" autocomplete="username">
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              :placeholder="t('login.password')"
              autocomplete="current-password"
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="captcha">
            <div class="captcha-row">
              <el-input
                v-model="form.captcha"
                :placeholder="t('login.captchaAnswer')"
                maxlength="16"
                autocomplete="off"
              >
                <template #prefix>
                  <svg class="shield" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 3.2 5.5 5.6v5.3c0 4.2 2.7 7.2 6.5 8.9 3.8-1.7 6.5-4.7 6.5-8.9V5.6L12 3.2Z"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linejoin="round"
                    />
                    <path d="m9 12 2 2 4-4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                  </svg>
                </template>
              </el-input>
              <button type="button" class="captcha captcha-image" :title="t('login.captchaRefresh')" @click="loadCaptcha">
                <img v-if="serverCaptcha.image" :src="serverCaptcha.image" alt="" />
              </button>
              <button type="button" class="refresh" :title="t('login.captchaRefresh')" @click="loadCaptcha">
                <el-icon><RefreshRight /></el-icon>
              </button>
            </div>
          </el-form-item>

          <div class="agreement">
            <el-checkbox v-model="form.agreed" />
            <span>
              {{ t('login.agree') }}
              <button type="button" class="link" @click="openDoc('service')">{{ t('login.service') }}</button>
              {{ t('login.and') }}
              <button type="button" class="link" @click="openDoc('privacy')">{{ t('login.privacy') }}</button>
            </span>
          </div>

          <button class="submit" type="submit" :disabled="submitting">
            <span>{{ t('login.submit') }}</span>
            <el-icon><ArrowRight /></el-icon>
          </button>

          <div class="action-row">
            <button type="button" class="ghost" @click="onRegister">{{ t('login.register') }}</button>
            <button type="button" class="ghost" @click="openForgot">{{ t('login.forgot') }}</button>
          </div>
        </el-form>

        <el-dialog v-model="docVisible" :title="t(docKey === 'privacy' ? 'login.privacy' : 'login.service')" width="480px" append-to-body>
          <p class="doc-text">{{ t(docKey === 'privacy' ? 'login.privacyText' : 'login.serviceText') }}</p>
        </el-dialog>

        <el-dialog
          v-model="forgotVisible"
          class="login-dialog"
          modal-class="login-dialog-modal"
          :title="forgotDialogTitle"
          width="480px"
          append-to-body
          destroy-on-close
          align-center
          @closed="closeForgot"
        >
          <el-form
            v-if="forgotStep === 'verify'"
            ref="forgotFormRef"
            class="login-form"
            :model="forgotForm"
            :rules="forgotRules"
            label-position="top"
            @submit.prevent="submitForgot"
          >
            <p class="dialog-hint">{{ t('login.forgotHint') }}</p>
            <el-form-item :label="t('login.user')" prop="username" required>
              <el-input v-model="forgotForm.username" maxlength="64" :placeholder="t('login.user')" autocomplete="username">
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item :label="t('login.captchaAnswer')" prop="captchaAnswer" required>
              <div class="captcha-row">
                <el-input
                  v-model="forgotForm.captchaAnswer"
                  maxlength="16"
                  :placeholder="t('login.captchaAnswer')"
                  autocomplete="off"
                />
                <button type="button" class="captcha captcha-image" :title="t('login.captchaRefresh')" @click="loadForgotCaptcha">
                  <img v-if="forgotCaptcha.image" :src="forgotCaptcha.image" alt="" />
                </button>
                <button type="button" class="refresh" :title="t('login.captchaRefresh')" @click="loadForgotCaptcha">
                  <el-icon><RefreshRight /></el-icon>
                </button>
              </div>
            </el-form-item>
          </el-form>

          <el-form
            v-else
            ref="resetFormRef"
            class="login-form"
            :model="resetForm"
            :rules="resetRules"
            label-position="top"
            @submit.prevent="submitReset"
          >
            <div class="question">
              <span>{{ t('login.securityQuestion') }}</span>
              {{ resetForm.securityQuestion }}
            </div>
            <el-form-item :label="t('login.securityAnswer')" prop="securityAnswer" required>
              <el-input
                v-model="resetForm.securityAnswer"
                maxlength="128"
                :placeholder="t('login.securityAnswer')"
                autocomplete="off"
              />
            </el-form-item>
            <el-form-item :label="t('login.newPassword')" prop="newPassword" required>
              <el-input
                v-model="resetForm.newPassword"
                type="password"
                show-password
                maxlength="72"
                :placeholder="t('login.newPassword')"
                autocomplete="new-password"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item :label="t('login.passwordConfirm')" prop="confirmPassword" required>
              <el-input
                v-model="resetForm.confirmPassword"
                type="password"
                show-password
                maxlength="72"
                :placeholder="t('login.passwordConfirm')"
                autocomplete="new-password"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-form>

          <template #footer>
            <button type="button" class="ghost" @click="closeForgot">{{ t('login.cancel') }}</button>
            <button
              v-if="forgotStep === 'verify'"
              type="button"
              class="primary"
              :disabled="submitting"
              @click="submitForgot"
            >
              {{ t('login.forgotSubmit') }}
            </button>
            <button v-else type="button" class="primary" :disabled="submitting" @click="submitReset">
              {{ t('login.resetSubmit') }}
            </button>
          </template>
        </el-dialog>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: #edfff6;
  background: #04140f url('/login/bg.jpg') 18% center / cover no-repeat;
}

.veil,
.aurora,
.grid,
.mote {
  position: absolute;
  pointer-events: none;
}

.veil {
  inset: 0;
  background:
    linear-gradient(90deg, rgba(3, 18, 12, 0.05) 0%, rgba(3, 16, 12, 0.12) 42%, rgba(2, 14, 10, 0.34) 100%),
    linear-gradient(180deg, rgba(3, 16, 12, 0.18), transparent 18%, transparent 78%, rgba(2, 12, 9, 0.35));
}

.aurora {
  top: 12%;
  left: 4%;
  width: 46vw;
  height: 46vw;
  background: radial-gradient(circle, rgba(48, 210, 130, 0.28), transparent 68%);
  filter: blur(6px);
  animation: drift 14s ease-in-out infinite;
}

.grid {
  inset: 0;
  background-image:
    linear-gradient(rgba(150, 235, 190, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(150, 235, 190, 0.08) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at 62% 48%, #000 8%, transparent 72%);
  animation: grid-shift 18s linear infinite;
}

.mote {
  bottom: -8px;
  border-radius: 50%;
  background: #d8ffe9;
  box-shadow: 0 0 8px rgba(125, 255, 195, 0.85);
  animation-name: rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.brand,
.stage {
  position: relative;
  z-index: 1;
}

.lang-slot {
  position: absolute;
  top: 28px;
  right: 26px;
  z-index: 2;
}

.brand {
  position: absolute;
  top: 22px;
  left: 26px;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 14px 8px 8px;
  border: 1px solid rgba(130, 220, 170, 0.28);
  border-radius: 14px;
  background: rgba(6, 32, 22, 0.42);
  backdrop-filter: blur(10px);
}

.brand-logo {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
}

.brand-logo svg {
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 0 8px rgba(40, 220, 120, 0.45));
  animation: glow 3.2s ease-in-out infinite;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-text strong {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.brand-text em {
  color: rgba(214, 240, 224, 0.72);
  font-size: 12px;
  font-style: normal;
  letter-spacing: 0.02em;
}

.stage {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 76px 7vw 28px 28vw;
}

.panel {
  position: relative;
  width: 440px;
  max-height: 100%;
  padding: 28px 26px 22px;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid rgba(128, 214, 168, 0.38);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(12, 58, 42, 0.78), rgba(7, 36, 27, 0.84));
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  animation: enter 0.7s ease both;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16%;
  width: 28%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #e7fff4, transparent);
  animation: sweep 3.6s ease-in-out infinite;
}

.panel::-webkit-scrollbar {
  width: 0;
}

h1 {
  margin: 0;
  color: #f4fff9;
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.08em;
}

.subtitle {
  margin: 8px 0 22px;
  color: rgba(214, 236, 224, 0.72);
  font-size: 13px;
  text-align: center;
}

.panel :deep(.el-form-item) {
  margin-bottom: 16px;
}

.panel :deep(.el-input__wrapper) {
  height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(3, 22, 16, 0.45);
  box-shadow: 0 0 0 1px rgba(138, 214, 176, 0.32) inset;
}

.panel :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.panel :deep(.el-input__inner) {
  color: #f3fff8;
  color-scheme: dark;
}

.panel :deep(.el-input__inner::placeholder) {
  color: rgba(198, 224, 210, 0.55);
}

.panel :deep(.el-input__wrapper:has(input:-webkit-autofill)) {
  background: #102e26;
}

.panel :deep(.el-input__wrapper:has(input:autofill)) {
  background: #102e26;
}

.panel :deep(input:-webkit-autofill),
.panel :deep(input:-webkit-autofill:hover),
.panel :deep(input:-webkit-autofill:focus),
.panel :deep(input:-webkit-autofill:active) {
  -webkit-text-fill-color: #f3fff8 !important;
  caret-color: #f3fff8;
  box-shadow: 0 0 0 1000px #102e26 inset !important;
  transition: background-color 99999s ease-out;
}

.panel :deep(input:autofill) {
  -webkit-text-fill-color: #f3fff8 !important;
  caret-color: #f3fff8;
  box-shadow: 0 0 0 1000px #102e26 inset !important;
}

.panel :deep(.el-input__prefix),
.panel :deep(.el-input__suffix),
.panel :deep(.el-input__password) {
  color: rgba(198, 232, 214, 0.8);
}

.shield {
  width: 16px;
  height: 16px;
}

.captcha-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.captcha-row :deep(.el-input) {
  flex: 1;
}

.captcha,
.refresh,
.submit,
.ghost,
.link {
  font: inherit;
  cursor: pointer;
}

.captcha {
  display: flex;
  flex: 0 0 112px;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  background: #f7fff9;
  user-select: none;
}

.captcha-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.refresh {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: none;
  border-radius: 50%;
  color: rgba(214, 240, 224, 0.85);
  background: transparent;
}

.refresh:hover,
.ghost:hover {
  color: #fff;
}

.refresh:hover :deep(.el-icon) {
  animation: spin 0.55s linear;
}

.agreement {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 2px 0 16px;
  color: rgba(226, 244, 234, 0.88);
  font-size: 13px;
  line-height: 1.6;
}

.agreement :deep(.el-checkbox) {
  height: 22px;
}

.link {
  border: none;
  padding: 0;
  color: #7dffc3;
  background: transparent;
  font-size: inherit;
}

.link:hover {
  color: #b6ffe0;
}

.panel :deep(.el-checkbox__label) {
  color: rgba(226, 244, 234, 0.86);
  font-size: 13px;
}

.panel :deep(.el-checkbox__inner) {
  background: transparent;
  border-color: #3dce7c;
}

.panel :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background: #2fbf6a;
  border-color: #2fbf6a;
}

.submit {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  overflow: hidden;
  border: none;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(90deg, #67e48c 0%, #3ad7a8 46%, #24d0c8 100%);
  box-shadow: 0 10px 22px rgba(36, 200, 170, 0.28);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.08em;
}

.submit::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.42) 50%, transparent 70%);
  transform: translateX(-130%);
  animation: sheen 4.6s ease-in-out infinite;
}

.submit .el-icon {
  position: absolute;
  right: 18px;
  font-size: 18px;
  transition: transform 0.25s ease;
}

.submit:hover {
  filter: brightness(1.06);
}

.submit:disabled {
  cursor: wait;
  opacity: 0.72;
}

.submit:hover .el-icon {
  transform: translateX(4px);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.ghost {
  height: 44px;
  border: 1px solid rgba(138, 214, 176, 0.45);
  border-radius: 8px;
  color: #e7fff4;
  background: rgba(4, 28, 20, 0.35);
  font-size: 15px;
}

.doc-text {
  margin: 0;
  color: #31423b;
  line-height: 1.7;
}

@keyframes drift {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(8%, 6%, 0) scale(1.08); }
}

@keyframes grid-shift {
  from { background-position: 0 0; }
  to { background-position: 56px 56px; }
}

@keyframes rise {
  0% { transform: translateY(0); opacity: 0; }
  12% { opacity: 0.85; }
  100% { transform: translateY(-100vh); opacity: 0; }
}

@keyframes glow {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(40, 220, 120, 0.35)); }
  50% { filter: drop-shadow(0 0 14px rgba(80, 255, 170, 0.85)); }
}

@keyframes enter {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes sweep {
  0% { transform: translateX(-90%); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateX(280%); opacity: 0; }
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

@keyframes sheen {
  0%, 58% { transform: translateX(-130%); }
  82%, 100% { transform: translateX(130%); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .aurora,
  .grid,
  .mote,
  .brand-logo svg,
  .panel,
  .panel::before,
  .submit::before {
    animation: none;
  }
}

@media (max-width: 1100px) {
  .login-page {
    height: auto;
    min-height: 100%;
    overflow: auto;
  }

  .stage {
    justify-content: center;
    padding: 96px 16px 20px;
  }

  .panel {
    width: min(440px, 100%);
  }
}
</style>

<style>
.login-dialog-modal {
  background: rgba(2, 12, 9, 0.72);
  backdrop-filter: blur(4px);
}

.login-dialog.el-dialog {
  border: 1px solid rgba(128, 214, 168, 0.38);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(12, 58, 42, 0.96), rgba(7, 36, 27, 0.98));
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.login-dialog .el-dialog__header {
  margin: 0;
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(140, 220, 175, 0.14);
}

.login-dialog .el-dialog__title {
  color: #f3fff8;
  font-size: 18px;
  font-weight: 700;
}

.login-dialog .el-dialog__headerbtn {
  top: 18px;
  right: 16px;
  width: 28px;
  height: 28px;
}

.login-dialog .el-dialog__headerbtn .el-dialog__close {
  color: rgba(214, 245, 228, 0.72);
}

.login-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #8dffc8;
}

.login-dialog .el-dialog__body {
  padding: 16px 20px 8px;
  color: #edfff6;
}

.login-dialog .el-dialog__footer {
  padding: 12px 20px 18px;
  border-top: 1px solid rgba(140, 220, 175, 0.14);
}

.login-dialog .dialog-hint {
  margin: 0 0 14px;
  color: rgba(214, 236, 224, 0.72);
  font-size: 13px;
  line-height: 1.6;
}

.login-dialog .question {
  margin: 0 0 16px;
  padding: 12px 14px;
  border: 1px solid rgba(138, 214, 176, 0.32);
  border-radius: 8px;
  background: rgba(3, 22, 16, 0.35);
  color: #f3fff8;
  line-height: 1.6;
}

.login-dialog .question span {
  display: block;
  margin-bottom: 4px;
  color: rgba(214, 236, 224, 0.62);
  font-size: 12px;
}

.login-dialog .login-form .el-form-item__label {
  color: rgba(214, 245, 228, 0.78);
  font-weight: 600;
}

.login-dialog .login-form .el-input__wrapper {
  height: 44px;
  border-radius: 8px;
  background: rgba(3, 22, 16, 0.45);
  box-shadow: 0 0 0 1px rgba(138, 214, 176, 0.32) inset;
}

.login-dialog .login-form .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px #3dce7c inset, 0 0 0 3px rgba(61, 206, 124, 0.16);
}

.login-dialog .login-form .el-input__inner {
  color: #f3fff8;
  color-scheme: dark;
}

.login-dialog .login-form .el-input__inner::placeholder {
  color: rgba(198, 224, 210, 0.55);
}

.login-dialog .login-form .el-input__prefix,
.login-dialog .login-form .el-input__suffix,
.login-dialog .login-form .el-input__password {
  color: rgba(198, 232, 214, 0.8);
}

.login-dialog .login-form .el-form-item__error {
  color: #ff9b9b;
}

.login-dialog .captcha-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.login-dialog .captcha-row .el-input {
  flex: 1;
}

.login-dialog .captcha {
  display: flex;
  flex: 0 0 112px;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  background: #f7fff9;
  cursor: pointer;
}

.login-dialog .captcha img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-dialog .refresh {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: none;
  border-radius: 50%;
  color: rgba(214, 240, 224, 0.85);
  background: transparent;
  cursor: pointer;
}

.login-dialog .refresh:hover {
  color: #fff;
}

.login-dialog .ghost,
.login-dialog .primary {
  height: 40px;
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.login-dialog .ghost {
  margin-right: 8px;
  padding: 0 16px;
  border: 1px solid rgba(138, 214, 176, 0.45);
  color: #e7fff4;
  background: rgba(4, 28, 20, 0.35);
}

.login-dialog .primary {
  padding: 0 16px;
  border: none;
  color: #042117;
  background: linear-gradient(90deg, #67e48c 0%, #3ad7a8 46%, #24d0c8 100%);
  font-weight: 700;
}

.login-dialog .primary:disabled {
  cursor: wait;
  opacity: 0.72;
}
</style>
