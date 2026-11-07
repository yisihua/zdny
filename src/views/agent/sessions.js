export function createSessions() {
  return [
    {
      id: 1,
      title: '筛选耐旱水稻材料',
      messages: [
        { id: 11, role: 'user', content: '筛选耐旱、适宜长江中下游的水稻材料' },
        { id: 12, role: 'assistant', content: '演示回复：可优先查看浙农稻 18、钱塘籼 6 的耐旱与抗稻瘟记录。模型服务尚未接入。' },
      ],
    },
    { id: 2, title: '比较浙农稻18和钱塘籼6', messages: [] },
    { id: 3, title: '查询小麦抗倒伏材料', messages: [] },
    { id: 4, title: '玉米宜机收性状怎么筛', messages: [] },
    { id: 5, title: '耐盐碱水稻有哪些记录', messages: [] },
    { id: 6, title: '高产抗稻瘟材料怎么配组', messages: [] },
  ]
}
