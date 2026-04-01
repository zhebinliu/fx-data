export interface APLProject {
  name: string;
  is_current: boolean;
  has_session: boolean;
  has_req: boolean;
  has_certificate?: boolean;
  status?: string;
  session_valid?: string | boolean;
  session_path: string;
  req_path: string;
}

export interface APLHistoryItem {
  id: string;
  kind: string;
  title: string;
  status: string;
  started_at: string;
  finished_at: string;
  compile_message: string;
  deploy_message: string;
  api_name: string;
  func_name: string;
  req_snapshot: any;
}

export const fetchProjects = async (): Promise<APLProject[]> => {
  const res = await fetch('/data/api/apl/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  const data = await res.json();
  return data.items || [];
};

export const fetchHistory = async (params: Record<string, string> = {}): Promise<APLHistoryItem[]> => {
  const query = new URLSearchParams(params).toString();
  const url = query ? `/api/apl/tasks?${query}` : '/api/apl/tasks';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch history');
  const data = await res.json();
  return data.items || [];
};

export const fetchSession = async (): Promise<any[]> => {
  const res = await fetch('/data/api/apl/session-status');
  if (!res.ok) throw new Error('Failed to fetch session info');
  const data = await res.json();
  return data.items || [];
};

export const fetchSettings = async (): Promise<any> => {
  const res = await fetch('/data/api/apl/dashboard');
  if (!res.ok) throw new Error('Failed to fetch settings');
  const data = await res.json();
  return data.settings || {};
};

export const renewSession = async (project: string): Promise<any> => {
  const res = await fetch('/data/api/apl/session-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project })
  });
  if (!res.ok) throw new Error('Failed to renew session');
  return res.json();
};

export const submitSingleGeneration = async (data: Record<string, any>): Promise<any> => {
  const res = await fetch('/data/api/apl/run/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Single generation failed');
  return res.json();
};

export const submitBatchGeneration = async (data: Record<string, string>): Promise<any> => {
  const res = await fetch('/data/api/apl/run/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Batch generation failed');
  return res.json();
};

export const uploadBatchCsv = async (formData: FormData): Promise<any> => {
    const res = await fetch('/data/api/apl/run/batch-upload', {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) throw new Error('Batch CSV upload failed');
    return res.json();
};

export const saveSettings = async (data: Record<string, string>): Promise<any> => {
  const res = await fetch('/data/api/apl/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
};

export const saveCert = async (project: string, cert: string): Promise<any> => {
  const res = await fetch('/data/api/apl/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ certificate: { project, certificate: cert } })
  });
  if (!res.ok) throw new Error('Failed to save certificate');
  return res.json();
};
