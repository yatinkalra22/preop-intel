// Live agent status panel — shows each specialist agent's progress.
// Why EventSource (not WebSocket)? Unidirectional, auto-reconnects, built-in.
// Source: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
// In demo mode, we simulate the SSE stream with timed state transitions.

'use client';

import type { AgentName, AgentStatus } from '@preop-intel/shared';

interface AgentInfo {
  name: AgentName;
  displayName: string;
  description: string;
  status: AgentStatus;
  durationMs?: number;
}

interface AgentStatusPanelProps {
  agents: AgentInfo[];
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; bgColor: string; label: string }> = {
  idle: { color: 'text-agent-idle', bgColor: 'bg-slate-100', label: 'Waiting' },
  running: { color: 'text-agent-running', bgColor: 'bg-blue-50', label: 'Analyzing...' },
  complete: { color: 'text-agent-complete', bgColor: 'bg-green-50', label: 'Complete' },
  error: { color: 'text-agent-error', bgColor: 'bg-red-50', label: 'Error' },
};

function PulsingDot({ status }: { status: AgentStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-agent-running opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-agent-running" />
      </span>
    );
  }

  const dotColor = status === 'complete' ? 'bg-agent-complete' : status === 'error' ? 'bg-agent-error' : 'bg-agent-idle';
  return <span className={`inline-flex h-3 w-3 rounded-full ${dotColor}`} />;
}

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  return (
    <div className="rounded-xl border border-clinical-border bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-clinical-text-muted">
        Agent Pipeline
      </h3>
      <div className="space-y-3">
        {agents.map((agent) => {
          const config = STATUS_CONFIG[agent.status];
          return (
            <div
              key={agent.name}
              className={`flex items-center gap-4 rounded-lg ${config.bgColor} px-4 py-3 transition-colors duration-300`}
            >
              <PulsingDot status={agent.status} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${config.color}`}>
                  {agent.displayName}
                </p>
                <p className="text-xs text-clinical-text-muted">
                  {agent.description}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
                {agent.durationMs != null && agent.status === 'complete' && (
                  <p className="text-xs text-clinical-text-muted">
                    {(agent.durationMs / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
