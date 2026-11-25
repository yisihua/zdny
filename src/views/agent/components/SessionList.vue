<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, Delete, EditPen, FolderAdd, FolderOpened, Top } from '@element-plus/icons-vue'
import { UNGROUPED_ID } from '../sessionGroups.js'
import { t } from '@/i18n'

const props = defineProps({
  sessions: { type: Array, required: true },
  sections: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
  pinnedIds: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits([
  'select',
  'rename',
  'delete',
  'pin',
  'create-group',
  'rename-group',
  'delete-group',
  'toggle-group',
  'move-session',
])

const moveMenu = ref(null)
const rootEl = ref(null)

const hasGroups = computed(() => props.groups.length > 0)
const showGrouped = computed(() => hasGroups.value || props.sections.some((item) => item.id !== UNGROUPED_ID))

function isPinned(id) {
  return props.pinnedIds.includes(String(id))
}

function sectionTitle(section) {
  if (section?.nameKey) return t(section.nameKey)
  return section?.name || t('agent.ungrouped')
}

function openMoveMenu(session, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  moveMenu.value = {
    sessionId: String(session.id),
    groupId: currentGroupId(session.id),
    x: Math.min(rect.left, window.innerWidth - 180),
    y: rect.bottom + 4,
  }
}

function currentGroupId(sessionId) {
  const sid = String(sessionId)
  const found = props.sections.find(
    (section) => section.id !== UNGROUPED_ID && section.sessions.some((item) => String(item.id) === sid),
  )
  return found?.id || UNGROUPED_ID
}

function chooseGroup(groupId) {
  if (!moveMenu.value) return
  emit('move-session', { sessionId: moveMenu.value.sessionId, groupId })
  moveMenu.value = null
}

function onDocPointer(event) {
  if (!moveMenu.value) return
  const target = event.target
  if (rootEl.value?.contains(target)) return
  moveMenu.value = null
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
})
</script>

<template>
  <section ref="rootEl" class="history">
    <div class="label-row">
      <p class="label">{{ t('agent.recent') }}</p>
      <button type="button" class="group-add" :title="t('agent.groupCreate')" @click="emit('create-group')">
        <el-icon :size="14"><FolderAdd /></el-icon>
        <span>{{ t('agent.groupCreateShort') }}</span>
      </button>
    </div>

    <div v-if="loading" class="state">{{ t('system.loading') }}</div>
    <div v-else-if="!sessions.length" class="state">{{ t('agent.sessionEmpty') }}</div>

    <div v-else class="scroll">
      <template v-if="showGrouped">
        <section v-for="section in sections" :key="section.id || 'ungrouped'" class="group">
          <header class="group-head">
            <button type="button" class="group-toggle" @click="emit('toggle-group', section.id)">
              <el-icon class="chevron" :class="{ 'is-collapsed': section.collapsed }" :size="12">
                <ArrowDown />
              </el-icon>
              <el-icon :size="14"><FolderOpened /></el-icon>
              <strong>{{ sectionTitle(section) }}</strong>
              <em>{{ section.sessions.length }}</em>
            </button>
            <div v-if="section.id" class="group-actions">
              <button type="button" :title="t('agent.groupRename')" @click.stop="emit('rename-group', section)">
                <el-icon :size="13"><EditPen /></el-icon>
              </button>
              <button type="button" :title="t('agent.groupDelete')" @click.stop="emit('delete-group', section)">
                <el-icon :size="13"><Delete /></el-icon>
              </button>
            </div>
          </header>

          <ul v-show="!section.collapsed">
            <li v-if="!section.sessions.length" class="empty-group">{{ t('agent.groupEmpty') }}</li>
            <li
              v-for="item in section.sessions"
              :key="item.id"
              :class="{ 'is-pinned': isPinned(item.id) }"
            >
              <button
                type="button"
                class="session"
                :class="{ 'is-active': item.id === activeId }"
                @click="emit('select', item.id)"
              >
                <span>{{ item.title }}</span>
              </button>
              <div class="actions">
                <button
                  type="button"
                  :class="{ 'is-on': isPinned(item.id) }"
                  :title="isPinned(item.id) ? t('agent.unpin') : t('agent.pin')"
                  @click.stop="emit('pin', item)"
                >
                  <el-icon :size="14"><Top /></el-icon>
                </button>
                <button
                  type="button"
                  :title="t('agent.groupMove')"
                  @click.stop="openMoveMenu(item, $event)"
                >
                  <el-icon :size="14"><FolderOpened /></el-icon>
                </button>
                <button type="button" :title="t('agent.rename')" @click.stop="emit('rename', item)">
                  <el-icon :size="14"><EditPen /></el-icon>
                </button>
                <button type="button" :title="t('agent.delete')" @click.stop="emit('delete', item)">
                  <el-icon :size="14"><Delete /></el-icon>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <ul v-else>
        <li v-for="item in sessions" :key="item.id" :class="{ 'is-pinned': isPinned(item.id) }">
          <button
            type="button"
            class="session"
            :class="{ 'is-active': item.id === activeId }"
            @click="emit('select', item.id)"
          >
            <span>{{ item.title }}</span>
          </button>
          <div class="actions">
            <button
              type="button"
              :class="{ 'is-on': isPinned(item.id) }"
              :title="isPinned(item.id) ? t('agent.unpin') : t('agent.pin')"
              @click.stop="emit('pin', item)"
            >
              <el-icon :size="14"><Top /></el-icon>
            </button>
            <button type="button" :title="t('agent.groupMove')" @click.stop="openMoveMenu(item, $event)">
              <el-icon :size="14"><FolderOpened /></el-icon>
            </button>
            <button type="button" :title="t('agent.rename')" @click.stop="emit('rename', item)">
              <el-icon :size="14"><EditPen /></el-icon>
            </button>
            <button type="button" :title="t('agent.delete')" @click.stop="emit('delete', item)">
              <el-icon :size="14"><Delete /></el-icon>
            </button>
          </div>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div
        v-if="moveMenu"
        class="move-menu"
        :style="{ left: `${moveMenu.x}px`, top: `${moveMenu.y}px` }"
        @pointerdown.stop
      >
        <button
          type="button"
          :class="{ 'is-on': moveMenu.groupId === UNGROUPED_ID }"
          @click="chooseGroup(UNGROUPED_ID)"
        >
          {{ t('agent.ungrouped') }}
        </button>
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          :class="{ 'is-on': moveMenu.groupId === group.id }"
          @click="chooseGroup(group.id)"
        >
          {{ group.name }}
        </button>
        <p v-if="!groups.length" class="menu-empty">{{ t('agent.groupNone') }}</p>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.history {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.label-row {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.label {
  margin: 0;
  color: rgba(190, 230, 210, 0.62);
  font-size: 13px;
}

.group-add {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 26px;
  padding: 0 8px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: rgba(214, 245, 228, 0.86);
  background: rgba(8, 36, 28, 0.55);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.group-add:hover {
  color: #8dffc8;
  border-color: rgba(140, 220, 175, 0.5);
}

.state {
  padding: 18px 8px;
  color: rgba(214, 245, 228, 0.55);
  font-size: 13px;
  text-align: center;
}

.scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 0 6px 0 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 210, 160, 0.55) rgba(3, 18, 14, 0.35);
}

.scroll::-webkit-scrollbar {
  width: 8px;
}

.scroll::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background: rgba(120, 210, 160, 0.45);
}

.group {
  display: grid;
  gap: 6px;
}

.group-head {
  display: flex;
  gap: 4px;
  align-items: center;
}

.group-toggle {
  display: flex;
  flex: 1;
  gap: 6px;
  align-items: center;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: rgba(214, 245, 228, 0.86);
  background: rgba(3, 18, 14, 0.28);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.group-toggle:hover {
  border-color: rgba(140, 220, 175, 0.22);
  background: rgba(8, 36, 28, 0.45);
}

.group-toggle strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-toggle em {
  margin-left: auto;
  color: rgba(214, 245, 228, 0.55);
  font-style: normal;
  font-size: 12px;
}

.chevron {
  transition: transform 0.15s ease;
}

.chevron.is-collapsed {
  transform: rotate(-90deg);
}

.group-actions {
  display: flex;
  gap: 2px;
}

.group-actions button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(214, 245, 228, 0.7);
  background: transparent;
  cursor: pointer;
}

.group-actions button:hover {
  color: #8dffc8;
  border-color: rgba(140, 220, 175, 0.28);
  background: rgba(8, 36, 28, 0.55);
}

ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.empty-group {
  padding: 8px 10px;
  color: rgba(214, 245, 228, 0.45);
  font-size: 12px;
}

li {
  position: relative;
}

.session {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(140, 220, 175, 0.16);
  border-radius: 10px;
  color: #e7fff4;
  background: rgba(3, 18, 14, 0.45);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, padding 0.15s ease;
}

.session span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

li:hover .session {
  padding-right: 118px;
}

.session:hover,
.session.is-active {
  border-color: rgba(120, 235, 175, 0.7);
  box-shadow: 0 0 12px rgba(60, 210, 140, 0.18);
}

li.is-pinned .session {
  border-color: rgba(140, 220, 175, 0.36);
  background: rgba(8, 40, 28, 0.58);
}

.actions {
  position: absolute;
  top: 50%;
  right: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
  transition: opacity 0.15s ease;
}

li:hover .actions,
li:focus-within .actions {
  opacity: 1;
  pointer-events: auto;
}

.actions button {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 8px;
  color: rgba(214, 245, 228, 0.86);
  background: rgba(6, 32, 24, 0.92);
  cursor: pointer;
}

.actions button:hover,
.actions button.is-on {
  color: #8dffc8;
  border-color: rgba(140, 220, 175, 0.55);
  background: rgba(12, 48, 34, 0.98);
}

.actions button.is-on {
  color: #042117;
  border-color: transparent;
  background: linear-gradient(180deg, #8cf0ae, #2fbf6a);
}

.move-menu {
  position: fixed;
  z-index: 80;
  display: grid;
  gap: 4px;
  min-width: 148px;
  max-width: 220px;
  padding: 6px;
  border: 1px solid rgba(140, 220, 175, 0.28);
  border-radius: 10px;
  background: rgba(6, 28, 22, 0.98);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
}

.move-menu button {
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  color: #e7fff4;
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.move-menu button:hover,
.move-menu button.is-on {
  color: #042117;
  background: linear-gradient(90deg, #8cf0ae, #2fbf6a);
}

.menu-empty {
  margin: 0;
  padding: 8px;
  color: rgba(214, 245, 228, 0.55);
  font-size: 12px;
}
</style>
