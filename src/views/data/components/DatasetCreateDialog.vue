<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DATASET_TYPES,
  createDataset,
  createDatasetShare,
} from '@/api/dataset'
import { fetchProjectMembers, fetchProjects, updateProjectSharing } from '@/api/project'
import { t } from '@/i18n'
import '@/styles/system-dialog.css'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'created'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const formRef = ref()
const submitting = ref(false)
const loadingProjects = ref(false)
const projects = ref([])

const form = reactive({
  projectId: '',
  name: '',
  dataType: 'RAW_RGB',
  collectionDate: '',
  batch: '',
  sensor: '',
  shared: false,
})

const selectedProject = computed(() => projects.value.find((item) => String(item.id) === String(form.projectId)) || null)
const shareHint = computed(() => {
  if (!form.shared) return t('data.shareTip')
  if (selectedProject.value?.teamId) return t('data.shareTipTeam')
  return t('data.shareTipMembers')
})

const typeOptions = computed(() =>
  DATASET_TYPES.map((item) => ({
    value: item.value,
    label: t(item.labelKey),
  })),
)

const rules = computed(() => ({
  projectId: [{ required: true, message: t('data.projectRequired'), trigger: 'change' }],
  name: [
    { required: true, message: t('data.datasetNameRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const name = String(value || '').trim()
        if (!name) return callback(new Error(t('data.datasetNameRequired')))
        if (name.length > 256) return callback(new Error(t('data.datasetNameLong')))
        callback()
      },
      trigger: 'blur',
    },
  ],
  dataType: [{ required: true, message: t('data.dataTypeRequired'), trigger: 'change' }],
}))

function projectOptionLabel(item) {
  const bits = [item.name]
  if (item.year != null && item.year !== '') bits.push(String(item.year))
  if (item.location) bits.push(item.location)
  return bits.join(' · ')
}

async function loadProjects() {
  loadingProjects.value = true
  try {
    const page = await fetchProjects({ page: 1, pageSize: 100 })
    projects.value = page?.records || page?.list || page?.content || (Array.isArray(page) ? page : [])
  } catch {
    projects.value = []
  } finally {
    loadingProjects.value = false
  }
}

function reset() {
  form.projectId = ''
  form.name = ''
  form.dataType = 'RAW_RGB'
  form.collectionDate = ''
  form.batch = ''
  form.sensor = ''
  form.shared = false
  formRef.value?.clearValidate?.()
}

async function shareWithProjectMembers(datasetId, project) {
  if (!project?.id) throw new Error(t('data.shareNoMembers'))

  const tasks = []
  if (project.teamId) {
    tasks.push(
      createDatasetShare(datasetId, {
        targetType: 'TEAM',
        targetId: String(project.teamId),
      }),
    )
  }

  const me = String(localStorage.getItem('userId') || '')
  const ownerId = String(project.ownerId || '')
  const memberPage = await fetchProjectMembers(project.id, { page: 1, pageSize: 100 })
  const members = memberPage?.records || memberPage?.list || []
  const sharedUsers = new Set()
  members.forEach((member) => {
    const userId = String(member.userId || '')
    if (!userId || userId === me || userId === ownerId || sharedUsers.has(userId)) return
    sharedUsers.add(userId)
    tasks.push(
      createDatasetShare(datasetId, {
        targetType: 'USER',
        targetId: userId,
      }),
    )
  })

  if (!tasks.length) throw new Error(t('data.shareNoMembers'))

  const results = await Promise.allSettled(tasks)
  const failed = results.filter((item) => item.status === 'rejected').length
  if (failed === results.length) throw new Error(t('data.shareLater'))
  if (failed) ElMessage.warning(t('data.sharePartial', { ok: results.length - failed, fail: failed }))
}

async function ensureProjectShareSwitch(project) {
  if (!form.shared || !project) return
  const needRaw = form.dataType === 'RAW_RGB'
  const shareRaw = needRaw ? true : Boolean(project.shareRaw)
  const shareProcessed = needRaw ? Boolean(project.shareProcessed) : true
  if ((needRaw && project.shareRaw) || (!needRaw && project.shareProcessed)) return
  await updateProjectSharing(project.id, { shareRaw, shareProcessed })
  project.shareRaw = shareRaw
  project.shareProcessed = shareProcessed
}

async function submit() {
  if (submitting.value) return
  const valid = await formRef.value?.validate?.().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const project = selectedProject.value
    await ensureProjectShareSwitch(project)

    const dataset = await createDataset(form.projectId, {
      name: form.name,
      dataType: form.dataType,
      collectionDate: form.collectionDate || null,
      batch: form.batch,
      sensor: form.sensor,
    })

    if (form.shared) {
      try {
        await shareWithProjectMembers(dataset.id, project)
      } catch (error) {
        ElMessage.warning(error?.message || t('data.shareLater'))
      }
    }

    ElMessage.success(t('data.createOnlySuccess'))
    visible.value = false
    emit('created', dataset)
    reset()
  } catch (error) {
    if (!error?.payload && error?.message) ElMessage.error(error.message)
  } finally {
    submitting.value = false
  }
}

watch(visible, (open) => {
  if (open) loadProjects()
  else reset()
})
</script>

<template>
  <el-dialog
    v-model="visible"
    class="system-dialog dataset-dialog"
    :title="t('data.createTitle')"
    width="720px"
    destroy-on-close
    append-to-body
  >
    <el-form ref="formRef" class="system-form create-form" :model="form" :rules="rules" label-position="top">
      <section class="block">
        <header class="block-title">{{ t('data.sectionProject') }}</header>
        <div class="grid two">
          <el-form-item :label="t('data.project')" prop="projectId">
            <el-select
              v-model="form.projectId"
              filterable
              :loading="loadingProjects"
              :placeholder="t('data.projectPh')"
              style="width: 100%"
            >
              <el-option
                v-for="item in projects"
                :key="item.id"
                :label="projectOptionLabel(item)"
                :value="String(item.id)"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('data.dataType')" prop="dataType">
            <el-select v-model="form.dataType" style="width: 100%">
              <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item :label="t('data.datasetName')" prop="name">
          <el-input v-model="form.name" maxlength="256" :placeholder="t('data.datasetNamePh')" />
        </el-form-item>
      </section>

      <section class="block">
        <header class="block-title">{{ t('data.sectionCollect') }}</header>
        <div class="grid three">
          <el-form-item :label="t('data.collectionDate')">
            <el-date-picker
              v-model="form.collectionDate"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="t('data.collectionDatePh')"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item :label="t('data.batch')">
            <el-input v-model="form.batch" maxlength="128" :placeholder="t('data.batchPh')" />
          </el-form-item>
          <el-form-item :label="t('data.sensor')">
            <el-input v-model="form.sensor" maxlength="128" :placeholder="t('data.sensorPh')" />
          </el-form-item>
        </div>
      </section>

      <section class="block share-block" :class="{ 'is-on': form.shared }">
        <div class="share-row">
          <div class="share-copy">
            <strong>{{ t('data.share') }}</strong>
            <p>{{ shareHint }}</p>
          </div>
          <label class="share-toggle">
            <span class="share-state" :class="{ on: form.shared }">
              {{ form.shared ? t('data.shareMembers') : t('data.shareOff') }}
            </span>
            <el-switch v-model="form.shared" />
          </label>
        </div>
      </section>
    </el-form>

    <template #footer>
      <button type="button" class="ghost" :disabled="submitting" @click="visible = false">{{ t('system.cancel') }}</button>
      <button type="button" class="primary" :disabled="submitting" @click="submit">
        {{ submitting ? t('data.submitting') : t('data.submitCreate') }}
      </button>
    </template>
  </el-dialog>
</template>

<style scoped>
.create-form {
  display: grid;
  gap: 14px;
}

.block {
  padding: 14px 14px 6px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 12px;
  background: rgba(3, 18, 14, 0.35);
}

.block-title {
  margin: 0 0 10px;
  color: rgba(214, 245, 228, 0.72);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.grid {
  display: grid;
  gap: 0 12px;
}

.grid.two {
  grid-template-columns: 1.2fr 1fr;
}

.grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.share-block {
  padding: 14px;
}

.share-block.is-on {
  border-color: rgba(140, 240, 174, 0.42);
  background: rgba(20, 64, 44, 0.35);
}

.share-row {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.share-copy {
  min-width: 0;
  flex: 1;
}

.share-copy strong {
  display: block;
  color: #f3fff8;
  font-size: 14px;
}

.share-copy p {
  margin: 6px 0 0;
  color: rgba(214, 245, 228, 0.58);
  font-size: 12px;
  line-height: 1.5;
}

.share-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.share-state {
  min-width: 7.5em;
  padding: 4px 10px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 999px;
  color: rgba(214, 245, 228, 0.78);
  background: rgba(3, 18, 14, 0.55);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.share-state.on {
  border-color: transparent;
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.share-toggle :deep(.el-switch.is-checked .el-switch__core) {
  background: #2fbf6a;
  border-color: #2fbf6a;
}

.share-toggle :deep(.el-switch__core) {
  background: rgba(8, 36, 28, 0.92);
  border-color: rgba(140, 220, 175, 0.36);
}

.share-toggle :deep(.el-switch__action) {
  background: #d8f5e6;
}

.share-toggle :deep(.el-switch.is-checked .el-switch__action) {
  background: #042117;
}

@media (max-width: 720px) {
  .grid.two,
  .grid.three {
    grid-template-columns: 1fr;
  }

  .share-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
