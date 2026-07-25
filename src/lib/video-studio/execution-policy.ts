export type VideoExecutionMode = "mock" | "live";

export interface VideoExecutionPolicy {
  mode: VideoExecutionMode;
  mockMode: boolean;
  emergencyStop: boolean;
  liveAllowed: boolean;
  blocker: string | null;
}

export function resolveVideoExecutionPolicy(input: {
  requestedMockMode: boolean;
  deploymentMode?: string;
  emergencyStop?: string;
}): VideoExecutionPolicy {
  const deploymentMode = input.deploymentMode === "live" ? "live" : "mock";
  const emergencyStop = input.emergencyStop !== "false";
  const liveAllowed = deploymentMode === "live" && !emergencyStop;
  const mockMode = input.requestedMockMode || !liveAllowed;
  const blocker = input.requestedMockMode
    ? null
    : deploymentMode !== "live"
      ? "Deployment chỉ cho phép chế độ mock"
      : emergencyStop
        ? "Video emergency stop đang bật"
        : null;

  return {
    mode: mockMode ? "mock" : "live",
    mockMode,
    emergencyStop,
    liveAllowed,
    blocker,
  };
}
