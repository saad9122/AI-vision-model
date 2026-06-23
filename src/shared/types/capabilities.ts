import { AgentCapability } from "@prisma/client";

export const CAPABILITY_SLUGS = {
  DESCRIPTION_GENERATOR: "description-generator",
} as const;

export type CapabilitySlug =
  (typeof CAPABILITY_SLUGS)[keyof typeof CAPABILITY_SLUGS];

export function toAgentCapability(slug: string): AgentCapability {
  switch (slug) {
    case CAPABILITY_SLUGS.DESCRIPTION_GENERATOR:
      return AgentCapability.DESCRIPTION_GENERATOR;
    default:
      throw new Error(`Unknown capability: ${slug}`);
  }
}

export function fromAgentCapability(capability: AgentCapability): CapabilitySlug {
  switch (capability) {
    case AgentCapability.DESCRIPTION_GENERATOR:
      return CAPABILITY_SLUGS.DESCRIPTION_GENERATOR;
    default: {
      const exhaustive: never = capability;
      throw new Error(`Unknown capability enum: ${exhaustive}`);
    }
  }
}

export function isKnownCapabilitySlug(slug: string): slug is CapabilitySlug {
  return Object.values(CAPABILITY_SLUGS).includes(slug as CapabilitySlug);
}
