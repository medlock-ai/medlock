import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Bindings } from './types'

type State = {
  lastAccessTime: number
  toolExecutionCount: number
}

type Props = {
  userId: string
  username: string
  email?: string
  accessToken: string
}

export class MedlockMcpAgent extends McpAgent<Bindings, State, Props> {
  // The props will be automatically initialized by the McpAgent.serve() method
  // through the ctx.props passed from the main handler, so we don't need to
  // override fetch() anymore
  server = new McpServer({
    name: 'medlock-server',
    version: 'v0.1.0',
  })

  initialState: State = {
    lastAccessTime: Date.now(),
    toolExecutionCount: 0,
  }

  async init() {
    // Register tools
    this.server.tool(
      'solid_fetch_vitals',
      "Fetch latest vitals from the user's Solid Pod",
      {},
      async () => {
        // Update state
        this.setState({
          ...this.state,
          lastAccessTime: Date.now(),
          toolExecutionCount: this.state.toolExecutionCount + 1,
        })

        // Log to audit
        await this.env.AUDIT.put(
          `audit:${crypto.randomUUID()}`,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: this.props.userId,
            action: 'tool_execution',
            details: {
              tool: 'solid_fetch_vitals',
              executionCount: this.state.toolExecutionCount,
            },
          }),
          { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
        )

        // Return mock data for now (KV-based implementation)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  heart_rate: { value: 72, unit: 'bpm', timestamp: '2024-01-21T10:00:00Z' },
                  blood_pressure: {
                    systolic: 120,
                    diastolic: 80,
                    unit: 'mmHg',
                    timestamp: '2024-01-21T10:00:00Z',
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }
    )

    this.server.tool(
      'vitals_scan',
      'Trigger camera-based vitals scan.',
      {
        device: z.enum(['front', 'rear']),
      },
      async ({ device }) => {
        // Update state
        this.setState({
          ...this.state,
          lastAccessTime: Date.now(),
          toolExecutionCount: this.state.toolExecutionCount + 1,
        })

        // Log to audit
        await this.env.AUDIT.put(
          `audit:${crypto.randomUUID()}`,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: this.props.userId,
            action: 'tool_execution',
            details: {
              tool: 'vitals_scan',
              device,
              executionCount: this.state.toolExecutionCount,
            },
          }),
          { expirationTtl: 30 * 24 * 60 * 60 }
        )

        // Return scan instructions
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'ready',
                  instructions: 'Please position your finger on the camera lens',
                  scanUrl: `${this.env.BASE_URL}/scan/${device}`,
                  mockResult: {
                    heart_rate: 72,
                    confidence: 0.95,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }
    )

    // Add a resource to track session state
    this.server.resource('session-info', 'mcp://resource/session-info', () => ({
      contents: [
        {
          uri: 'mcp://resource/session-info',
          text: JSON.stringify(
            {
              userId: this.props.userId,
              username: this.props.username,
              lastAccessTime: this.state.lastAccessTime,
              toolExecutionCount: this.state.toolExecutionCount,
            },
            null,
            2
          ),
        },
      ],
    }))
  }

  onStateUpdate(state: State) {
    console.log('State updated:', {
      userId: this.props.userId,
      state,
    })
  }
}
