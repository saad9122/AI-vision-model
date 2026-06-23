import type { AgentCapability } from "@prisma/client";

export interface AgentCapabilityHandler<TPayload = unknown, TResult = unknown> {
  capability: AgentCapability;
  validatePayload(raw: unknown): TPayload;
  process(jobId: string, payload: TPayload): Promise<TResult>;
}

const handlers = new Map<AgentCapability, AgentCapabilityHandler>();

export function registerCapability(handler: AgentCapabilityHandler): void {
  handlers.set(handler.capability, handler);
}

export function getCapabilityHandler(
  capability: AgentCapability
): AgentCapabilityHandler {
  const handler = handlers.get(capability);
  if (!handler) {
    throw new Error(`No handler registered for capability: ${capability}`);
  }

  return handler;
}

export function getRegisteredCapabilities(): AgentCapability[] {
  return [...handlers.keys()];
}
