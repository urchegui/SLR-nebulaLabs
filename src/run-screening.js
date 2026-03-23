import { runScreeningAgent } from './agents/screening-agent.js'


const RUN_ID = 'b72039ef-26b6-4ff1-800c-6fb6c1cb8557'

const counts = await runScreeningAgent(RUN_ID, {
  confidenceThreshold: 0.70,
  batchSize:           10,
  delayMs:             500
})