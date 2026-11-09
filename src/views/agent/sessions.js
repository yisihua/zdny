import { createPlotForm } from './plot.js'

export function createSessions() {
  return [
    {
      id: 7,
      titleKey: 'session.plot',
      messages: [
        { id: 71, role: 'user', textKey: 'chat.plotAsk' },
        { id: 72, role: 'assistant', textKey: 'chat.plotIntro' },
        { id: 73, role: 'assistant', type: 'plot', form: createPlotForm(), done: false },
      ],
    },
    {
      id: 1,
      titleKey: 'session.drought',
      messages: [
        { id: 11, role: 'user', textKey: 'chat.droughtAsk' },
        { id: 12, role: 'assistant', textKey: 'chat.droughtReply' },
      ],
    },
    { id: 2, titleKey: 'session.compare', messages: [] },
    { id: 3, titleKey: 'session.wheat', messages: [] },
    { id: 4, titleKey: 'session.maize', messages: [] },
    { id: 5, titleKey: 'session.salt', messages: [] },
    { id: 6, titleKey: 'session.blast', messages: [] },
  ]
}
