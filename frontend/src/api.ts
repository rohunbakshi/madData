import type { ApiMeta, CoolingType, CountySummary, Project, ScoreResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    throw new Error("Failed to load projects");
  }
  return res.json();
}

export async function fetchProject(projectId: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`);
  if (!res.ok) {
    throw new Error("Failed to load project");
  }
  return res.json();
}

export async function calculateScore(
  projectId: string,
  sizeMw: number,
  coolingType: CoolingType,
): Promise<ScoreResponse> {
  const res = await fetch(`${API_BASE}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      size_mw: sizeMw,
      cooling_type: coolingType,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to calculate score");
  }
  return res.json();
}

export async function fetchMeta(): Promise<ApiMeta> {
  const res = await fetch(`${API_BASE}/meta`);
  if (!res.ok) {
    throw new Error("Failed to load API metadata");
  }
  return res.json();
}

export async function fetchCountySummary(
  sizeMw: number,
  coolingType: CoolingType,
): Promise<CountySummary[]> {
  const params = new URLSearchParams({
    size_mw: String(sizeMw),
    cooling_type: coolingType,
  });
  const res = await fetch(`${API_BASE}/counties/summary?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to load county summary");
  }
  return res.json();
}
