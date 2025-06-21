import type { Tool } from '../types'

export const vitalsScan: Tool = {
  name: 'vitals_scan',
  description: 'Scan vital signs using device camera',
  inputSchema: {
    type: 'object',
    properties: {
      vitalType: {
        type: 'string',
        enum: ['heart_rate', 'respiratory_rate'],
        description: 'Type of vital to scan',
      },
      duration: {
        type: 'integer',
        minimum: 10,
        maximum: 60,
        description: 'Scan duration in seconds',
      },
    },
    required: ['vitalType'],
  },
  handler: async (params, context) => {
    // Log tool execution
    await context.auditLog('tool_execution', {
      tool: 'vitals_scan',
      params,
    })

    // Return instructions for client-side scanning
    return {
      status: 'ready',
      instructions: `Please position your finger on the camera lens for ${params.duration || 30} seconds`,
      scanUrl: `${context.env.BASE_URL || 'https://api.healthmcp.ai'}/scan/${params.vitalType}`,
      mockResult: {
        value: params.vitalType === 'heart_rate' ? 72 : 16,
        unit: params.vitalType === 'heart_rate' ? 'bpm' : 'breaths/min',
        confidence: 0.95,
      },
    }
  },
}
