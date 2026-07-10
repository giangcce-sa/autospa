export const gatewayCapabilities = [
  "chat",
  "coding",
  "review",
  "test-generation",
  "repo-analysis",
  "image-generation",
  "image-edit",
  "vision",
  "embedding",
  "rerank",
  "speech-to-text",
  "text-to-speech",
  "spa-chat",
  "workflow"
] as const;

export type GatewayCapability = (typeof gatewayCapabilities)[number];

export const textCapabilities: GatewayCapability[] = [
  "chat",
  "coding",
  "review",
  "test-generation",
  "repo-analysis",
  "spa-chat",
  "workflow"
];

export const imageCapabilities: GatewayCapability[] = ["image-generation", "image-edit"];

export function isTextCapability(capability: GatewayCapability): boolean {
  return textCapabilities.includes(capability);
}

export function isImageCapability(capability: GatewayCapability): boolean {
  return imageCapabilities.includes(capability);
}
